/**
 * POST|GET /api/payglocal/callback
 *
 * PayGlocal PayCollect — server step 2.
 *
 * After the customer finishes (or abandons) payment on PayGlocal's hosted page,
 * PayGlocal returns control to this URL (form POST, sometimes a GET redirect).
 *
 * We NEVER trust the callback body. We extract the merchantTxnId / gid, then
 * call the PayGlocal Status API (server-to-server, x-gl-auth) which is the
 * authoritative source of truth. Only on a verified SENT_FOR_CAPTURE — with a
 * matching amount — do we mark the order paid and fulfill.
 *
 * Reuses the shared fulfillOrder() so delivery is identical to the Paytm path.
 *
 * Redirects:
 *   success → /thank-you?payment_intent=<gid>
 *   failure → /courses?payment=failed
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PAYGLOCAL,
  getPayglocalStatus,
  isPayglocalSuccess,
} from "@/lib/payglocal";
import { fulfillOrder, type PendingOrderRow } from "@/lib/fulfill-order";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hakeemrestro.shop";

function redirectTo(path: string): NextResponse {
  // PayGlocal returns control from its own domain → 303 so POST becomes GET.
  return NextResponse.redirect(`${APP_URL}${path}`, { status: 303 });
}

/** Pull params from either a form/JSON POST body or the URL query string. */
async function readParams(req: NextRequest): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  // Query string first (GET redirects, and PayGlocal sometimes appends here).
  req.nextUrl.searchParams.forEach((v, k) => (out[k] = v));
  // Then body (POST). Support urlencoded + JSON.
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (req.method === "POST") {
      if (ct.includes("application/json")) {
        const j = await req.json().catch(() => ({}));
        if (j && typeof j === "object") {
          for (const [k, v] of Object.entries(j)) out[k] = String(v);
        }
      } else {
        const text = await req.text();
        new URLSearchParams(text).forEach((v, k) => (out[k] = v));
      }
    }
  } catch {
    /* ignore — query params may be enough */
  }
  return out;
}

// PayGlocal callback field names vary by product; check the known aliases.
function pickMerchantTxnId(p: Record<string, string>): string | undefined {
  return (
    p.merchantTxnId ||
    p.merchantUniqueId ||
    p.merchant_txn_id ||
    p.muid ||
    undefined
  );
}
function pickGid(p: Record<string, string>): string | undefined {
  return p.gid || p.GID || p.x_gl_gid || p["x-gl-gid"] || undefined;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const supabase = createAdminClient();
  const params = await readParams(req);

  const merchantTxnId = pickMerchantTxnId(params);
  const gidFromCallback = pickGid(params);

  if (!merchantTxnId && !gidFromCallback) {
    console.warn("[payglocal:callback] no identifier in callback", {
      keys: Object.keys(params).sort(),
    });
    return redirectTo("/courses?payment=failed");
  }

  // 1. Authoritative verification via Status API. Prefer GID; fall back to our
  // merchantTxnId (the status endpoint accepts either).
  const statusId = gidFromCallback ?? merchantTxnId!;
  const sq = await getPayglocalStatus(statusId);
  if (!sq.ok) {
    console.error("[payglocal:callback] status query unreachable", {
      statusId,
      host: PAYGLOCAL.host,
    });
    return redirectTo("/courses?payment=failed");
  }

  const verifiedTxnId = sq.gid ?? gidFromCallback ?? merchantTxnId!;
  const lookupOrderId = sq.merchantTxnId ?? merchantTxnId;

  if (!lookupOrderId) {
    console.error("[payglocal:callback] no merchantTxnId to look up order", {
      statusId,
      sqStatus: sq.status,
    });
    return redirectTo("/courses?payment=failed");
  }

  // 2. Fetch the pending order we stashed at initiate.
  const { data: pending, error: pendingErr } = await supabase
    .from("pending_orders")
    .select("*")
    .eq("order_id", lookupOrderId)
    .single();

  if (pendingErr || !pending) {
    console.error("[payglocal:callback] pending_orders lookup miss", {
      lookupOrderId,
      message: pendingErr?.message,
    });
    return redirectTo("/courses?payment=failed");
  }

  // 3. Idempotency — keyed on the verified gid. Insert AFTER status verify so a
  // forged callback can't poison the dedup table.
  const eventKey = `payglocal_${verifiedTxnId}`;
  const { error: eventErr } = await supabase.from("webhook_events").insert({
    stripe_event_id: eventKey,
    type: `payglocal.${(sq.status ?? "unknown").toLowerCase()}`,
    payload: { ...params, _verifiedStatus: sq.status, _amount: sq.amount },
  });

  if (eventErr) {
    if ((eventErr as { code?: string }).code === "23505") {
      // Already processed this verified txn — idempotent redirect.
      return isPayglocalSuccess(sq.status)
        ? redirectTo(`/thank-you?payment_intent=${verifiedTxnId}`)
        : redirectTo("/courses?payment=failed");
    }
    console.error("[payglocal:callback] webhook_events insert failed", {
      lookupOrderId,
      code: (eventErr as { code?: string }).code,
      message: eventErr.message,
    });
    return redirectTo("/courses?payment=failed");
  }

  // 4. Not successful → mark failed, redirect.
  if (!isPayglocalSuccess(sq.status)) {
    console.error("[payglocal:callback] payment not successful", {
      lookupOrderId,
      statusId,
      payglocalStatus: sq.status,
      reasonCode: sq.reasonCode,
      detailedMessage: sq.detailedMessage,
    });
    await supabase
      .from("pending_orders")
      .update({
        status: "failed",
        resp_code: sq.reasonCode ?? null,
        resp_msg: sq.detailedMessage ?? sq.status ?? null,
        txn_id: verifiedTxnId,
      })
      .eq("order_id", lookupOrderId);
    return redirectTo("/courses?payment=failed");
  }

  // 5. Amount tamper check — the captured amount must match what we recorded.
  if (sq.amount != null) {
    const capturedCents = Math.round(parseFloat(sq.amount) * 100);
    if (Number.isFinite(capturedCents) && capturedCents !== pending.amount_cents) {
      console.error("[payglocal:callback] AMOUNT MISMATCH — refusing fulfillment", {
        lookupOrderId,
        expectedCents: pending.amount_cents,
        capturedCents,
      });
      await supabase
        .from("pending_orders")
        .update({
          status: "failed",
          resp_msg: `amount_mismatch expected=${pending.amount_cents} got=${capturedCents}`,
          txn_id: verifiedTxnId,
        })
        .eq("order_id", lookupOrderId);
      return redirectTo("/courses?payment=failed");
    }
  }

  // 6. Mark paid + fulfill (shared with Paytm).
  await supabase
    .from("pending_orders")
    .update({
      status: "paid",
      txn_id: verifiedTxnId,
      resp_code: sq.reasonCode ?? null,
      resp_msg: sq.status ?? null,
    })
    .eq("order_id", lookupOrderId);

  try {
    await fulfillOrder({
      pending: pending as PendingOrderRow,
      txnId: verifiedTxnId,
      paymentMode: sq.paymentMethod ?? null,
      bankName: null,
      supabase,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[payglocal:callback] FULFILLMENT FAILED", {
      lookupOrderId,
      txnId: verifiedTxnId,
      error: msg,
    });
    await supabase
      .from("pending_orders")
      .update({ resp_msg: `fulfillment_error: ${msg}`.slice(0, 500) })
      .eq("order_id", lookupOrderId);
    // Customer still lands on /thank-you; admin can remediate via /resend.
  }

  return redirectTo(`/thank-you?payment_intent=${verifiedTxnId}`);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
