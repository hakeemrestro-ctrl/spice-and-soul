/**
 * POST /api/payglocal/initiate
 *
 * PayGlocal PayCollect — server step 1.
 *
 * 1. Audit PayGlocal config (throws if PAYGLOCAL_API_KEY missing)
 * 2. Validate input (courseId, email, name, optional couponCode + UTM)
 * 3. Apply coupon → compute final amount
 * 4. Persist `pending_orders` row keyed by our merchantTxnId (gateway=payglocal)
 * 5. POST /gl/v1/payments/initiate/paycollect (x-gl-auth) → { gid, redirectUrl }
 * 6. Return `redirectUrl` to the client, which redirects to PayGlocal's page
 *
 * PayGlocal redirects/POSTs back to /api/payglocal/callback after payment.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CheckoutInputSchema } from "@/lib/validations/checkout";
import {
  PAYGLOCAL,
  generatePayglocalOrderId,
  paiseToAmount,
  initiatePayCollect,
  auditPayglocalConfig,
} from "@/lib/payglocal";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hakeemrestro.shop";

export async function POST(req: NextRequest) {
  try {
    console.info("[payglocal:initiate] config audit", auditPayglocalConfig());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[payglocal:initiate] config not loadable", { error: msg });
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

  // 2. Coupon (identical rules to the Paytm path)
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

  // 3. Persist pending order. metadata.gateway lets the shared infra know which
  // processor owns this row; order_id IS the PayGlocal merchantTxnId.
  const orderId = generatePayglocalOrderId();
  const metadata: Record<string, string> = {
    courseTitle: course.title,
    gateway: "payglocal",
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
    console.error("[payglocal:initiate] pending_orders insert failed", {
      orderId,
      code: (insertErr as { code?: string }).code ?? null,
      message: insertErr.message,
    });
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }

  // 4. Call PayGlocal PayCollect
  const callbackUrl = `${APP_URL}/api/payglocal/callback`;
  let result;
  try {
    result = await initiatePayCollect({
      merchantTxnId: orderId,
      amountRupees: paiseToAmount(finalCents),
      callbackUrl,
      email,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[payglocal:initiate] PayGlocal fetch failed", {
      orderId,
      host: PAYGLOCAL.host,
      error: msg,
    });
    return NextResponse.json({ error: "Payment gateway unreachable" }, { status: 502 });
  }

  const redirectUrl = result.body.data?.redirectUrl;
  const gid = result.body.gid;

  if (!redirectUrl) {
    console.error("[payglocal:initiate] PayGlocal rejected initiate", {
      orderId,
      httpStatus: result.httpStatus,
      payglocalStatus: result.body.status,
      reasonCode: result.body.reasonCode,
      message: result.body.message,
      detailedMessage: result.body.errors?.detailedMessage,
      displayMessage: result.body.errors?.displayMessage,
    });
    return NextResponse.json(
      {
        error: "Payment gateway rejected the request",
        payglocal: {
          reasonCode: result.body.reasonCode,
          message: result.body.errors?.displayMessage ?? result.body.message,
        },
      },
      { status: 502 },
    );
  }

  // 5. Stash the GID (best-effort) for later status query / refund.
  if (gid) {
    await supabase
      .from("pending_orders")
      .update({ metadata: { ...metadata, gid } })
      .eq("order_id", orderId);
  }

  console.info("[payglocal:initiate] redirectUrl issued", {
    orderId,
    gid: gid ?? null,
  });

  return NextResponse.json({
    orderId,
    gateway: "payglocal",
    redirectUrl,
  });
}
