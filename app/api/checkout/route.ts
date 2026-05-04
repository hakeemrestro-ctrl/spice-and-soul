export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { CheckoutInputSchema } from "@/lib/validations/checkout";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CheckoutInputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { courseId, email, name, couponCode, acquisitionSource, utmSource, utmMedium, utmCampaign, utmContent, utmTerm } = parsed.data;
  const supabase = createAdminClient();

  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select("id, title, price_cents")
    .eq("id", courseId)
    .eq("published", true)
    .single();

  if (courseErr || !course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  let finalCents = course.price_cents;
  let resolvedCouponCode: string | undefined;

  if (couponCode) {
    const { data: coupon } = await supabase
      .from("coupons")
      .select("id, code, discount_percent, discount_cents, max_uses, uses_count, expires_at, applies_to_course_ids, is_active")
      .eq("is_active", true)
      .ilike("code", couponCode)
      .single();

    const couponValid =
      coupon &&
      (!coupon.expires_at || new Date(coupon.expires_at) >= new Date()) &&
      (coupon.max_uses == null || coupon.uses_count < coupon.max_uses) &&
      (!coupon.applies_to_course_ids?.length || coupon.applies_to_course_ids.includes(courseId));

    if (couponValid) {
      const discountCents = coupon.discount_percent
        ? Math.round((course.price_cents * coupon.discount_percent) / 100)
        : Math.min(coupon.discount_cents ?? 0, course.price_cents);
      finalCents = Math.max(course.price_cents - discountCents, 50); // Stripe min: 50 cents
      resolvedCouponCode = coupon.code;
    }
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: finalCents,
    currency: "usd",
    receipt_email: email,
    metadata: {
      courseId,
      email,
      name,
      courseTitle: course.title,
      ...(resolvedCouponCode ? { couponCode: resolvedCouponCode } : {}),
      ...(acquisitionSource ? { acquisitionSource } : {}),
      ...(utmSource ? { utmSource } : {}),
      ...(utmMedium ? { utmMedium } : {}),
      ...(utmCampaign ? { utmCampaign } : {}),
      ...(utmContent ? { utmContent } : {}),
      ...(utmTerm ? { utmTerm } : {}),
    },
  });

  return NextResponse.json({ clientSecret: paymentIntent.client_secret });
}
