export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAYTM, generateSignature, paiseToTxnAmount } from "@/lib/paytm";

/**
 * Paytm refund flow:
 *   POST https://{host}/refund/apply
 *   body: { mid, txnType: "REFUND", orderId, txnId, refId, refundAmount, comments }
 *   head: { signature, clientId: "C11", version: "v1" }
 *
 * Docs: https://business.paytm.com/docs/refund
 *
 * We look up the original `pending_orders.order_id` from `pending_orders.txn_id`
 * because the original `orderId` Paytm requires is OUR orderId, not the TXNID.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ssr = await createClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await ssr
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, stripe_payment_intent_id, amount_cents, parent_order_id")
    .eq("id", id)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.parent_order_id) {
    return NextResponse.json(
      { error: "Refund the parent order, not a bundle child." },
      { status: 400 },
    );
  }
  if (order.status !== "paid") {
    return NextResponse.json(
      { error: `Order is ${order.status}, cannot refund.` },
      { status: 400 },
    );
  }

  const txnId = order.stripe_payment_intent_id;

  // Recover original Paytm orderId from pending_orders
  const { data: pending } = await supabase
    .from("pending_orders")
    .select("order_id, metadata")
    .eq("txn_id", txnId)
    .single();

  if (!pending) {
    return NextResponse.json(
      { error: "Original Paytm orderId not found — cannot refund." },
      { status: 400 },
    );
  }

  // This route is deliberately Paytm-only. Older Paytm rows predate the
  // gateway marker, so the absence of metadata continues to mean Paytm.
  // Never submit a BillDesk or PayGlocal transaction ID to Paytm's refund API.
  const metadata = pending.metadata as
    | { gateway?: unknown; paymentGateway?: unknown }
    | null;
  const gateway = metadata?.paymentGateway ?? metadata?.gateway ?? "paytm";
  if (gateway !== "paytm") {
    return NextResponse.json(
      { error: "This payment must be refunded through its original provider." },
      { status: 400 },
    );
  }

  const refundBody = {
    mid: PAYTM.mid,
    txnType: "REFUND",
    orderId: pending.order_id,
    txnId,
    refId: `REF_${order.id.slice(0, 8)}_${Date.now()}`,
    refundAmount: paiseToTxnAmount(order.amount_cents),
    comments: "Customer refund",
  };
  const signature = await generateSignature(JSON.stringify(refundBody));

  let paytmResp: {
    body?: { resultInfo?: { resultStatus?: string; resultCode?: string; resultMsg?: string } };
  };

  try {
    const res = await fetch(`https://${PAYTM.host}/refund/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: refundBody,
        head: { signature, clientId: "C11", version: "v1" },
      }),
    });
    paytmResp = await res.json();
  } catch (err) {
    console.error("Paytm refund network error:", err);
    return NextResponse.json({ error: "Payment provider unreachable" }, { status: 502 });
  }

  const status = paytmResp.body?.resultInfo?.resultStatus;
  // Paytm refund returns "TXN_SUCCESS" immediate-refund, "PENDING" or "ACCEPTED" for async
  if (status !== "TXN_SUCCESS" && status !== "PENDING" && status !== "ACCEPTED") {
    const msg = paytmResp.body?.resultInfo?.resultMsg ?? "Refund rejected";
    console.error("Paytm refund failed:", paytmResp.body?.resultInfo);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Mark all related order rows refunded (parent + bundle children)
  await supabase
    .from("orders")
    .update({ status: "refunded" })
    .eq("stripe_payment_intent_id", txnId);

  return NextResponse.json({ ok: true, paytm: paytmResp.body?.resultInfo });
}
