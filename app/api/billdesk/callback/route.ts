import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fulfillOrder } from "@/lib/fulfill-order";
import { verifyJwsToken, getBillDeskTransactionStatus } from "@/lib/billdesk";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hakeemrestro.shop";

export const dynamic = "force-dynamic";

function redirectTo(path: string): NextResponse {
  return NextResponse.redirect(`${APP_URL}${path}`, { status: 303 });
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient();
  let transactionResponse: string | null = null;

  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    transactionResponse = params.get("transaction_response");
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }

  if (!transactionResponse) {
    console.warn("[billdesk:callback] missing transaction_response in form post");
    return redirectTo("/courses?payment=failed");
  }

  // 1. Verify and decode JWS
  let payload;
  try {
    const verified = await verifyJwsToken(transactionResponse);
    payload = verified.payload;
  } catch (err) {
    console.error("[billdesk:callback] JWS verification failed", err);
    return redirectTo("/courses?payment=failed");
  }

  const orderId = payload.orderid;
  const callbackStatus = payload.auth_status; // 0300 = success, 0399 = failure, 0002 = pending
  const callbackTxnId = payload.transactionid;

  if (!orderId) {
    console.error("[billdesk:callback] payload missing orderid");
    return redirectTo("/courses?payment=failed");
  }

  // 2. Re-verify with Status Query API (Retrieve Transaction)
  let sq;
  try {
    sq = await getBillDeskTransactionStatus(orderId);
  } catch (err) {
    console.error("[billdesk:callback] status query failed", { orderId, error: String(err) });
    return redirectTo("/courses?payment=failed");
  }

  const sqStatus = sq.auth_status;
  const verifiedTxnId = sq.transactionid ?? callbackTxnId;
  
  // 3. Idempotency Check
  const callbackEventId = `billdesk_${orderId}_${verifiedTxnId ?? "no-txn"}`;
  const { error: eventErr } = await supabase
    .from("webhook_events")
    .insert({
      stripe_event_id: callbackEventId, // re-using column name
      type: `billdesk.${sqStatus}`,
      payload: payload,
    });

  if (eventErr) {
    if ((eventErr as { code?: string }).code === "23505") {
      // Duplicate
      return sqStatus === "0300" && verifiedTxnId
        ? redirectTo(`/thank-you?payment_intent=${verifiedTxnId}`)
        : redirectTo("/courses?payment=failed");
    }
    console.error("[billdesk:callback] webhook_events insert failed", eventErr);
    return redirectTo("/courses?payment=failed");
  }

  const isSuccess = sqStatus === "0300" && callbackStatus === "0300";
  const isPending = sqStatus === "0002";

  // Fetch pending order
  const { data: pending, error: pendingErr } = await supabase
    .from("pending_orders")
    .select("*")
    .eq("order_id", orderId)
    .single();

  if (pendingErr || !pending) {
    console.error("[billdesk:callback] pending_orders lookup miss:", orderId);
    return redirectTo("/courses?payment=failed");
  }

  if (isPending) {
    console.warn("[billdesk:callback] payment is pending", { orderId });
    return redirectTo("/courses?payment=pending");
  }

  // Verify amount matches
  const receivedAmount = Math.round(parseFloat(sq.amount) * 100);
  if (isSuccess && receivedAmount !== pending.amount_cents) {
    console.error("[billdesk:callback] Amount mismatch", {
      orderId,
      expected: pending.amount_cents,
      received: receivedAmount
    });
    // Mark failed due to amount mismatch
    await supabase
      .from("pending_orders")
      .update({
        status: "failed",
        resp_code: "AMOUNT_MISMATCH",
        resp_msg: "Received amount does not match expected amount",
        txn_id: verifiedTxnId ?? null,
      })
      .eq("order_id", orderId);
      
    return redirectTo("/courses?payment=failed");
  }

  if (!isSuccess) {
    console.error("[billdesk:callback] payment not successful", {
      orderId,
      callbackStatus,
      sqStatus,
      errorDesc: sq.transaction_error_desc
    });
    
    await supabase
      .from("pending_orders")
      .update({
        status: "failed",
        resp_code: sq.transaction_error_code ?? null,
        resp_msg: sq.transaction_error_desc ?? null,
        txn_id: verifiedTxnId ?? null,
      })
      .eq("order_id", orderId);
      
    return redirectTo("/courses?payment=failed");
  }

  const txnId = sq.transactionid;
  if (!txnId) {
    console.error("[billdesk:callback] success path missing transactionid");
    return redirectTo("/courses?payment=failed");
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
    console.error("[billdesk:callback] FULFILLMENT FAILED", { orderId, msg });
    await supabase
      .from("pending_orders")
      .update({
        resp_msg: `fulfillment_error: ${msg}`.slice(0, 500),
      })
      .eq("order_id", orderId);
  }

  return redirectTo(`/thank-you?payment_intent=${txnId}`);
}
