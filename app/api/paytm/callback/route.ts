/**
 * POST /api/paytm/callback
 *
 * Server step 2 of the Paytm All-in-One JS Checkout flow.
 *
 * Paytm POSTs an `application/x-www-form-urlencoded` body to this URL after the
 * customer finishes (or cancels) payment. We MUST NOT trust the body alone —
 * we verify the checksum AND call the Status Query API server-to-server before
 * fulfilling the order.
 *
 * Returns a 302 redirect:
 *   - On success → /thank-you?payment_intent=<TXNID>
 *   - On failure → /checkout/<slug>?status=failed
 *
 * Replaces the Stripe webhook handler.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PAYTM, generateSignature, verifySignature } from "@/lib/paytm";
import { fulfillOrder } from "@/lib/fulfill-order";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hakeemrestro.shop";

// Sanitized callback-params summary — Paytm-standard system fields only.
// Omits CUST_ID / EMAIL / MOBILE_NO so structured logs are safe to ship to
// Vercel runtime logs and grep across without leaking customer PII.
function safeFormSummary(p: Record<string, string>): Record<string, unknown> {
  return {
    ORDERID: p.ORDERID,
    TXNID: p.TXNID,
    STATUS: p.STATUS,
    RESPCODE: p.RESPCODE,
    RESPMSG: p.RESPMSG,
    TXNAMOUNT: p.TXNAMOUNT,
    PAYMENTMODE: p.PAYMENTMODE,
    BANKTXNID: p.BANKTXNID,
    BANKNAME: p.BANKNAME,
    CURRENCY: p.CURRENCY,
    GATEWAYNAME: p.GATEWAYNAME,
    MID: p.MID,
    TXNDATE: p.TXNDATE,
    fieldKeys: Object.keys(p).sort(),
    hasChecksum: "CHECKSUMHASH" in p,
    checksumLen: p.CHECKSUMHASH?.length ?? 0,
  };
}

async function callStatusQuery(orderId: string): Promise<{
  ok: boolean;
  status?: string;
  txnId?: string;
  amount?: string;
  resultCode?: string;
  resultMsg?: string;
  paymentMode?: string;
  bankName?: string;
}> {
  const reqBody = { mid: PAYTM.mid, orderId };
  const reqBodyString = JSON.stringify(reqBody);
  const signature = await generateSignature(reqBodyString);

  try {
    const res = await fetch(`https://${PAYTM.host}/v3/order/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reqBody, head: { signature } }),
    });
    const json = (await res.json()) as {
      body?: {
        resultInfo?: { resultStatus?: string; resultCode?: string; resultMsg?: string };
        txnId?: string;
        txnAmount?: string;
        paymentMode?: string;
        bankName?: string;
      };
    };
    return {
      ok: true,
      status: json.body?.resultInfo?.resultStatus,
      txnId: json.body?.txnId,
      amount: json.body?.txnAmount,
      resultCode: json.body?.resultInfo?.resultCode,
      resultMsg: json.body?.resultInfo?.resultMsg,
      paymentMode: json.body?.paymentMode,
      bankName: json.body?.bankName,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[paytm:callback] status query fetch failed", {
      orderId,
      host: PAYTM.host,
      error: msg,
    });
    return { ok: false };
  }
}

function redirectTo(path: string): NextResponse {
  // Paytm posts from its own domain → respond with a 302 redirect HTML that the
  // browser follows back into our app. NextResponse.redirect handles this for
  // POST → GET correctly when status 303 is set.
  return NextResponse.redirect(`${APP_URL}${path}`, { status: 303 });
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient();
  const formParams: Record<string, string> = {};

  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    params.forEach((v, k) => (formParams[k] = v));
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }

  const orderId = formParams.ORDERID;
  const checksum = formParams.CHECKSUMHASH;
  const callbackStatus = formParams.STATUS;
  const callbackTxnId = formParams.TXNID;

  if (!orderId || !checksum) {
    console.warn("[paytm:callback] missing required fields", safeFormSummary(formParams));
    return redirectTo("/courses?payment=failed");
  }

  // 1. Verify checksum FIRST. Idempotency must key off verified data — if we
  // dedup on raw form params before verification, an attacker who knows an
  // ORDERID could POST a forged TXN_SUCCESS, poisoning the webhook_events
  // table; the real callback would then hit the dedup branch and redirect
  // the user to an attacker-controlled TXNID.
  const { CHECKSUMHASH: _drop, ...verifyParams } = formParams;
  void _drop;
  const checksumOk = await verifySignature(verifyParams, checksum);

  if (!checksumOk) {
    console.error("[paytm:callback] checksum verification failed", {
      orderId,
      midTail: PAYTM.mid.slice(-4),
      ...safeFormSummary(formParams),
    });
    return redirectTo("/courses?payment=failed");
  }

  // 2. Always re-verify with the Status Query API. Don't trust the callback
  // body alone — Paytm's authoritative source-of-truth for txn state.
  const sq = await callStatusQuery(orderId);
  if (!sq.ok) {
    console.error("[paytm:callback] status query unreachable", {
      orderId,
      host: PAYTM.host,
    });
    return redirectTo("/courses?payment=failed");
  }

  // 3. Idempotency — only AFTER checksum + status query confirm authenticity.
  // Key uses the Status Query txnId (Paytm's server) over the callback body
  // when available, so attacker-controlled callbackTxnId can't pre-poison.
  const verifiedTxnId = sq.txnId ?? callbackTxnId;
  const callbackEventId = `paytm_${orderId}_${verifiedTxnId ?? "no-txn"}`;
  const { error: eventErr } = await supabase
    .from("webhook_events")
    .insert({
      stripe_event_id: callbackEventId,
      type: `paytm.${callbackStatus?.toLowerCase() ?? "unknown"}`,
      payload: formParams,
    });

  if (eventErr) {
    if ((eventErr as { code?: string }).code === "23505") {
      // Duplicate verified callback → already processed. Idempotent redirect.
      return sq.status === "TXN_SUCCESS" && verifiedTxnId
        ? redirectTo(`/thank-you?payment_intent=${verifiedTxnId}`)
        : redirectTo("/courses?payment=failed");
    }
    // Non-duplicate insert error = idempotency table broken. Fail loud.
    console.error("[paytm:callback] webhook_events insert failed", {
      orderId,
      code: (eventErr as { code?: string }).code,
      message: eventErr.message,
    });
    return redirectTo("/courses?payment=failed");
  }

  const isSuccess =
    sq.status === "TXN_SUCCESS" && callbackStatus === "TXN_SUCCESS";

  // Fetch the pending order metadata we stashed during initiate.
  const { data: pending, error: pendingErr } = await supabase
    .from("pending_orders")
    .select("*")
    .eq("order_id", orderId)
    .single();

  if (pendingErr || !pending) {
    console.error("pending_orders lookup miss:", orderId, pendingErr?.message);
    return redirectTo("/courses?payment=failed");
  }

  if (!isSuccess) {
    // Paytm rejected the txn. Log the canonical reason from both the callback
    // body and the Status Query response so prod debugging has both signals.
    console.error("[paytm:callback] payment not successful", {
      orderId,
      callbackStatus,
      statusQueryStatus: sq.status,
      callbackRespCode: formParams.RESPCODE,
      callbackRespMsg: formParams.RESPMSG,
      sqResultCode: sq.resultCode,
      sqResultMsg: sq.resultMsg,
    });
    await supabase
      .from("pending_orders")
      .update({
        status: "failed",
        resp_code: sq.resultCode ?? formParams.RESPCODE ?? null,
        resp_msg: sq.resultMsg ?? formParams.RESPMSG ?? null,
        txn_id: sq.txnId ?? callbackTxnId ?? null,
      })
      .eq("order_id", orderId);
    return redirectTo("/courses?payment=failed");
  }

  // Mark pending paid and store the verified TXNID. Final status flips to
  // either "paid" (fulfillment succeeded) or "paid_unfulfilled" below, so
  // admin/cron can find and retry the failed deliveries.
  const txnId = sq.txnId;
  if (!txnId) {
    // Should never happen given isSuccess gate above, but guard anyway —
    // never persist a falsy TXNID into the orders ledger.
    console.error("[paytm:callback] verified-success path missing sq.txnId", {
      orderId,
      callbackTxnId,
    });
    return redirectTo("/courses?payment=failed");
  }

  await supabase
    .from("pending_orders")
    .update({
      status: "paid",
      txn_id: txnId,
      resp_code: sq.resultCode ?? null,
      resp_msg: sq.resultMsg ?? null,
    })
    .eq("order_id", orderId);

  // 3. Run fulfillment (port of the old Stripe webhook handler). AWAIT it so
  // we know whether the customer actually got their email/PDFs before they
  // land on /thank-you. On failure, mark pending_orders so it shows up in
  // admin retry queue (instead of silently appearing "paid" with no order).
  try {
    await fulfillOrder({
      pending,
      txnId,
      paymentMode: sq.paymentMode ?? formParams.PAYMENTMODE ?? null,
      bankName: sq.bankName ?? formParams.BANKNAME ?? null,
      supabase,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[paytm:callback] FULFILLMENT FAILED", {
      orderId,
      txnId,
      error: msg,
    });
    // Keep status="paid" (CHECK constraint pre-0017 doesn't allow
    // 'paid_unfulfilled') but flag via resp_msg so admin can query
    //   WHERE status='paid' AND resp_msg LIKE 'fulfillment_error:%'
    // and remediate. After migration 0017 applies, switch this back to
    // status='paid_unfulfilled' for a cleaner enum.
    await supabase
      .from("pending_orders")
      .update({
        resp_msg: `fulfillment_error: ${msg}`.slice(0, 500),
      })
      .eq("order_id", orderId);
    // User still lands on /thank-you with their TXNID — they can use /resend
    // to redeliver. Admin gets resp_msg signal in the pending_orders table.
  }

  return redirectTo(`/thank-you?payment_intent=${txnId}`);
}
