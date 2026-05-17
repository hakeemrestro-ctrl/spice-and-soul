/**
 * POST /api/paytm/initiate
 *
 * V2 All-in-One Checkout — server step 1.
 *
 * 1. Audit Paytm config (throws if PAYTM_MID / PAYTM_MERCHANT_KEY undefined/empty)
 * 2. Validate input (courseId, email, name, optional couponCode + UTM)
 * 3. Apply coupon → compute final amount
 * 4. Persist `pending_orders` row keyed by our generated orderId
 * 5. Build V2 payload (stringified body + signature wrapped as { head, body })
 * 6. POST server-to-server to `/theia/api/v1/initiateTransaction`
 * 7. Extract `txnToken` from Paytm response, return to client
 *
 * Client uses txnToken with Paytm's All-in-One JS SDK to open payment modal.
 * Paytm POSTs back to /api/paytm/callback on completion.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CheckoutInputSchema } from "@/lib/validations/checkout";
import {
  PAYTM,
  generateOrderId,
  paiseToTxnAmount,
  buildV2InitiatePayload,
  emailToCustId,
  auditPaytmConfig,
} from "@/lib/paytm";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hakeemrestro.shop";

type PaytmInitiateResponse = {
  head?: { responseTimestamp?: string; version?: string; signature?: string };
  body?: {
    resultInfo?: { resultStatus?: string; resultCode?: string; resultMsg?: string };
    txnToken?: string;
    isPromoCodeValid?: boolean;
    authenticated?: boolean;
  };
};

export async function POST(req: NextRequest) {
  try {
    console.info("[paytm:initiate] config audit", auditPaytmConfig());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[paytm:initiate] Paytm config not loadable", { error: msg });
    return NextResponse.json(
      { error: "Payment gateway misconfigured. Contact support." },
      { status: 500 },
    );
  }

  const reqBody = await req.json();
  const parsed = CheckoutInputSchema.safeParse(reqBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    courseId,
    email,
    name,
    couponCode,
    acquisitionSource,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
  } = parsed.data;

  const supabase = createAdminClient();

  // 1. Load course
  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select("id, title, price_cents")
    .eq("id", courseId)
    .eq("published", true)
    .single();

  if (courseErr || !course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // 2. Coupon
  let finalCents = course.price_cents;
  let resolvedCouponCode: string | undefined;

  if (couponCode) {
    const { data: coupon } = await supabase
      .from("coupons")
      .select(
        "id, code, discount_percent, discount_cents, max_uses, uses_count, expires_at, applies_to_course_ids, is_active",
      )
      .eq("is_active", true)
      .ilike("code", couponCode)
      .single();

    const couponValid =
      coupon &&
      (!coupon.expires_at || new Date(coupon.expires_at) >= new Date()) &&
      (coupon.max_uses == null || coupon.uses_count < coupon.max_uses) &&
      (!coupon.applies_to_course_ids?.length ||
        coupon.applies_to_course_ids.includes(courseId));

    if (couponValid) {
      const discountCents = coupon.discount_percent
        ? Math.round((course.price_cents * coupon.discount_percent) / 100)
        : Math.min(coupon.discount_cents ?? 0, course.price_cents);
      finalCents = Math.max(course.price_cents - discountCents, 100);
      resolvedCouponCode = coupon.code;
    }
  }

  // 3. Persist pending order
  const orderId = generateOrderId();
  const metadata = {
    courseTitle: course.title,
    ...(resolvedCouponCode ? { couponCode: resolvedCouponCode } : {}),
    ...(acquisitionSource ? { acquisitionSource } : {}),
    ...(utmSource ? { utmSource } : {}),
    ...(utmMedium ? { utmMedium } : {}),
    ...(utmCampaign ? { utmCampaign } : {}),
    ...(utmContent ? { utmContent } : {}),
    ...(utmTerm ? { utmTerm } : {}),
  };

  const { error: insertErr } = await supabase.from("pending_orders").insert({
    order_id: orderId,
    course_id: courseId,
    amount_cents: finalCents,
    customer_email: email,
    customer_name: name,
    metadata,
    status: "pending",
  });

  if (insertErr) {
    console.error("[paytm:initiate] pending_orders insert failed", {
      orderId,
      code: (insertErr as { code?: string }).code ?? null,
      message: insertErr.message,
    });
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }

  // 4. Build V2 payload
  const callbackUrl = `${APP_URL}/api/paytm/callback`;
  let built;
  try {
    built = await buildV2InitiatePayload({
      orderId,
      amountRupees: paiseToTxnAmount(finalCents),
      custId: emailToCustId(email),
      callbackUrl,
      email,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[paytm:initiate] buildV2InitiatePayload failed", {
      orderId,
      error: msg,
    });
    return NextResponse.json({ error: "Failed to prepare payment" }, { status: 500 });
  }

  // 5. POST server-to-server to Paytm
  let paytmRes: Response;
  let paytmJson: PaytmInitiateResponse;
  try {
    paytmRes = await fetch(built.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(built.payload),
    });
    paytmJson = (await paytmRes.json()) as PaytmInitiateResponse;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[paytm:initiate] Paytm fetch failed", {
      orderId,
      url: built.url,
      error: msg,
    });
    return NextResponse.json({ error: "Payment gateway unreachable" }, { status: 502 });
  }

  const resultStatus = paytmJson.body?.resultInfo?.resultStatus;
  const resultCode = paytmJson.body?.resultInfo?.resultCode;
  const resultMsg = paytmJson.body?.resultInfo?.resultMsg;
  const txnToken = paytmJson.body?.txnToken;

  if (!txnToken || resultStatus !== "S") {
    console.error("[paytm:initiate] Paytm rejected initiate request", {
      orderId,
      httpStatus: paytmRes.status,
      paytmResultStatus: resultStatus,
      paytmResultCode: resultCode,
      paytmResultMsg: resultMsg,
      hasTxnToken: !!txnToken,
    });
    return NextResponse.json(
      {
        error: "Payment gateway rejected the request",
        paytm: { resultCode, resultMsg },
      },
      { status: 502 },
    );
  }

  console.info("[paytm:initiate] txnToken issued", {
    orderId,
    tokenLen: txnToken.length,
  });

  return NextResponse.json({
    orderId,
    mid: PAYTM.mid,
    amount: paiseToTxnAmount(finalCents),
    txnToken,
    callbackUrl,
    host: PAYTM.host,
  });
}
