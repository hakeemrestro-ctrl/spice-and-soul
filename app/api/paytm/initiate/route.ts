/**
 * POST /api/paytm/initiate
 *
 * Legacy form-redirect — server step 1.
 *
 * 1. Audit Paytm config (throws if env var undefined/empty)
 * 2. Validate input (courseId, email, name, optional couponCode + UTM)
 * 3. Apply coupon → compute final amount
 * 4. Persist a `pending_orders` row keyed by our generated orderId
 * 5. Build signed legacy form payload via buildLegacyForm
 * 6. Return `{ orderId, mid, amount, action, fields }` to the client
 *
 * The client auto-submits the form to Paytm's hosted page. Paytm POSTs back
 * to /api/paytm/callback on completion.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CheckoutInputSchema } from "@/lib/validations/checkout";
import {
  PAYTM,
  generateOrderId,
  paiseToTxnAmount,
  buildLegacyForm,
  emailToCustId,
  auditPaytmConfig,
} from "@/lib/paytm";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hakeemrestro.shop";

export async function POST(req: NextRequest) {
  // STRICT: env audit fires first. Throws if PAYTM_MID / PAYTM_MERCHANT_KEY
  // is undefined or empty. Surfaces non-PII config snapshot in vercel logs so
  // misconfiguration is impossible to miss.
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

  // 4. Build legacy form payload
  const callbackUrl = `${APP_URL}/api/paytm/callback`;
  let action: string;
  let fields: Record<string, string>;
  try {
    const built = await buildLegacyForm({
      orderId,
      customerId: emailToCustId(email),
      amountRupees: paiseToTxnAmount(finalCents),
      customerEmail: email,
      callbackUrl,
    });
    action = built.action;
    fields = built.fields;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[paytm:initiate] buildLegacyForm failed", { orderId, error: msg });
    return NextResponse.json({ error: "Failed to prepare payment" }, { status: 500 });
  }

  return NextResponse.json({
    orderId,
    mid: PAYTM.mid,
    amount: paiseToTxnAmount(finalCents),
    action,
    fields,
  });
}
