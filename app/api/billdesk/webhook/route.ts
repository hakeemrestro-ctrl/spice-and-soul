import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fulfillOrder } from "@/lib/fulfill-order";
import { verifyJwsToken, getBillDeskTransactionStatus } from "@/lib/billdesk";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = createAdminClient();
  let jwsToken: string | null = null;

  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/jose") || contentType.includes("text/plain")) {
      jwsToken = await req.text();
    } else if (contentType.includes("application/json")) {
      const body = await req.json();
      jwsToken = body.transaction_response || null;
    } else {
      const text = await req.text();
      const params = new URLSearchParams(text);
      jwsToken = params.get("transaction_response") || text;
    }
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }

  if (!jwsToken) {
    console.warn("[billdesk:webhook] missing token in body");
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  // 1. Verify and decode JWS
  let payload;
  try {
    const verified = await verifyJwsToken(jwsToken);
    payload = verified.payload;
  } catch (err) {
    console.error("[billdesk:webhook] JWS verification failed", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const orderId = payload.orderid;
  const webhookStatus = payload.auth_status;
  const webhookTxnId = payload.transactionid;

  if (!orderId) {
    console.error("[billdesk:webhook] payload missing orderid");
    return NextResponse.json({ error: "Missing orderid" }, { status: 400 });
  }

  // 2. Re-verify with Status Query API (Retrieve Transaction)
  let sq;
  try {
    sq = await getBillDeskTransactionStatus(orderId);
  } catch (err) {
    console.error("[billdesk:webhook] status query failed", { orderId, error: String(err) });
    return NextResponse.json({ error: "Status check failed" }, { status: 502 });
  }

  const sqStatus = sq.auth_status;
  const verifiedTxnId = sq.transactionid ?? webhookTxnId;

  // 3. Idempotency Check
  const webhookEventId = `billdesk_wh_${orderId}_${verifiedTxnId ?? "no-txn"}_${sqStatus}`;
  const { error: eventErr } = await supabase
    .from("webhook_events")
    .insert({
      stripe_event_id: webhookEventId, 
      type: `billdesk.webhook.${sqStatus}`,
      payload: payload,
    });

  if (eventErr) {
    if ((eventErr as { code?: string }).code === "23505") {
      // Duplicate
      return new NextResponse("OK", { status: 200 });
    }
    console.error("[billdesk:webhook] webhook_events insert failed", eventErr);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  const isSuccess = sqStatus === "0300" && webhookStatus === "0300";

  // Fetch pending order
  const { data: pending, error: pendingErr } = await supabase
    .from("pending_orders")
    .select("*")
    .eq("order_id", orderId)
    .single();

  if (pendingErr || !pending) {
    console.error("[billdesk:webhook] pending_orders lookup miss:", orderId);
    return new NextResponse("OK", { status: 200 });
  }

  // If it's already paid, skip fulfillment
  if (pending.status === "paid") {
    return new NextResponse("OK", { status: 200 });
  }

  // Verify amount matches
  const receivedAmount = Math.round(parseFloat(sq.amount) * 100);
  if (isSuccess && receivedAmount !== pending.amount_cents) {
    console.error("[billdesk:webhook] Amount mismatch", {
      orderId,
      expected: pending.amount_cents,
      received: receivedAmount
    });
    
    if (pending.status === "pending") {
      await supabase
        .from("pending_orders")
        .update({
          status: "failed",
          resp_code: "AMOUNT_MISMATCH",
          resp_msg: "Received amount does not match expected amount",
          txn_id: verifiedTxnId ?? null,
        })
        .eq("order_id", orderId);
    }
    return new NextResponse("OK", { status: 200 });
  }

  if (!isSuccess) {
    console.error("[billdesk:webhook] payment not successful", {
      orderId,
      webhookStatus,
      sqStatus,
      errorDesc: sq.transaction_error_desc
    });
    
    // Only update if it is currently pending to avoid overriding a paid state
    if (pending.status === "pending") {
      await supabase
        .from("pending_orders")
        .update({
          status: "failed",
          resp_code: sq.transaction_error_code ?? null,
          resp_msg: sq.transaction_error_desc ?? null,
          txn_id: verifiedTxnId ?? null,
        })
        .eq("order_id", orderId);
    }
      
    return new NextResponse("OK", { status: 200 });
  }

  const txnId = sq.transactionid;
  if (!txnId) {
    console.error("[billdesk:webhook] success path missing transactionid");
    return new NextResponse("OK", { status: 200 });
  }

  // Mark as paid
  await supabase
    .from("pending_orders")
    .update({
      status: "paid",
      txn_id: txnId,
      resp_code: "0300",
      resp_msg: "SUCCESS",
    })
    .eq("order_id", orderId);

  // Fulfill
  try {
    await fulfillOrder({
      pending,
      txnId,
      paymentMode: sq.payment_method_type ?? "billdesk",
      bankName: null,
      supabase,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[billdesk:webhook] FULFILLMENT FAILED", { orderId, msg });
    await supabase
      .from("pending_orders")
      .update({
        resp_msg: `fulfillment_error: ${msg}`.slice(0, 500),
      })
      .eq("order_id", orderId);
  }

  return new NextResponse("OK", { status: 200 });
}
