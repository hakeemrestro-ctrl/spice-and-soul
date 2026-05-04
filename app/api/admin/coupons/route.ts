export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const CreateCouponSchema = z.object({
  code: z.string().min(1).max(50),
  discountPercent: z.number().int().min(1).max(100).nullable(),
  discountCents: z.number().int().min(1).nullable(),
  maxUses: z.number().int().min(1).nullable(),
  expiresAt: z.string().datetime().nullable(),
}).refine(
  (d) => d.discountPercent != null || d.discountCents != null,
  { message: "Either discountPercent or discountCents is required" }
);

async function assertAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data: profile } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  return profile?.is_admin === true;
}

export async function POST(req: NextRequest) {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = CreateCouponSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { code, discountPercent, discountCents, maxUses, expiresAt } = parsed.data;
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("coupons")
    .insert({
      code: code.toUpperCase(),
      discount_percent: discountPercent,
      discount_cents: discountCents,
      max_uses: maxUses,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Coupon code already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create coupon" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
