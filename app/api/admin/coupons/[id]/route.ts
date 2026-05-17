export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const PatchSchema = z.object({
  discountPercent: z.number().int().min(1).max(100).nullable().optional(),
  maxUses: z.number().int().min(1).nullable().optional(),
  expiresAt: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth-gate: must be admin via public.users.is_admin (not user_metadata,
  // which is never populated and would be a future auth-bypass vector).
  const userClient = await createClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabaseAuthCheck = createAdminClient();
  const { data: profile } = await supabaseAuthCheck
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (profile?.is_admin !== true) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.discountPercent !== undefined) update.discount_percent = parsed.data.discountPercent;
  if (parsed.data.maxUses !== undefined) update.max_uses = parsed.data.maxUses;
  if (parsed.data.expiresAt !== undefined) {
    update.expires_at = parsed.data.expiresAt
      ? new Date(parsed.data.expiresAt).toISOString()
      : null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("coupons").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: "Update failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
