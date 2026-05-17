export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ValidateCouponSchema } from "@/lib/validations/coupon";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = ValidateCouponSchema.safeParse(body);

  // Single uniform failure response for ALL coupon-validation rejections.
  // Distinct status/error per failure mode (was 404/410/422) was an
  // enumeration oracle: an attacker could brute-force valid codes by
  // distinguishing "expired" from "wrong course" from "doesn't exist".
  const reject = () =>
    NextResponse.json({ error: "Invalid or expired coupon" }, { status: 400 });

  if (!parsed.success) return reject();

  const { code, courseId } = parsed.data;
  const supabase = createAdminClient();

  // Use exact-match on uppercase. Coupons are stored uppercase per admin
  // creation route, and `ilike` would honor SQL `%`/`_` wildcards (Zod regex
  // blocks them — defense in depth).
  const { data: coupon } = await supabase
    .from("coupons")
    .select("*")
    .eq("is_active", true)
    .eq("code", code.toUpperCase())
    .single();

  if (!coupon) return reject();
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return reject();
  if (coupon.max_uses != null && coupon.uses_count >= coupon.max_uses) return reject();
  if (
    coupon.applies_to_course_ids?.length &&
    !coupon.applies_to_course_ids.includes(courseId)
  ) {
    return reject();
  }

  // Fetch course price to compute discount. Distinct error here is OK —
  // course IDs are server-side UUIDs, not user-guessable.
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
