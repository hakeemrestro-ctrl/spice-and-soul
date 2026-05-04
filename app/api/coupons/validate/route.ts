export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ValidateCouponSchema } from "@/lib/validations/coupon";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = ValidateCouponSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { code, courseId } = parsed.data;
  const supabase = createAdminClient();

  const { data: coupon } = await supabase
    .from("coupons")
    .select("*")
    .eq("is_active", true)
    .ilike("code", code)
    .single();

  if (!coupon) {
    return NextResponse.json({ error: "Invalid or expired coupon" }, { status: 404 });
  }

  // Expiry check
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return NextResponse.json({ error: "Coupon has expired" }, { status: 410 });
  }

  // Max-uses check
  if (coupon.max_uses != null && coupon.uses_count >= coupon.max_uses) {
    return NextResponse.json({ error: "Coupon has reached its usage limit" }, { status: 410 });
  }

  // Course restriction check
  if (coupon.applies_to_course_ids?.length && !coupon.applies_to_course_ids.includes(courseId)) {
    return NextResponse.json({ error: "Coupon does not apply to this course" }, { status: 422 });
  }

  // Fetch course price to compute discount
  const { data: course } = await supabase
    .from("courses")
    .select("price_cents")
    .eq("id", courseId)
    .single();

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  let discountCents: number;
  if (coupon.discount_percent) {
    discountCents = Math.round((course.price_cents * coupon.discount_percent) / 100);
  } else {
    discountCents = Math.min(coupon.discount_cents, course.price_cents);
  }

  const finalCents = course.price_cents - discountCents;

  return NextResponse.json({
    valid: true,
    couponId: coupon.id,
    code: coupon.code,
    discountCents,
    finalCents,
    discountPercent: coupon.discount_percent ?? null,
  });
}
