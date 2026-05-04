export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const SubmitReviewSchema = z.object({
  reviewId: z.string().uuid(),
  token: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  body: z.string().max(2000).nullable().optional(),
  customerName: z.string().min(1).max(100),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = SubmitReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { reviewId, token, rating, body: reviewBody, customerName } = parsed.data;
  const supabase = createAdminClient();

  // Verify the token matches the reviewId and review hasn't been submitted
  const { data: existing } = await supabase
    .from("reviews")
    .select("id, body")
    .eq("id", reviewId)
    .eq("token", token)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Invalid or expired review link" }, { status: 404 });
  }

  if (existing.body !== null) {
    return NextResponse.json({ error: "Review already submitted" }, { status: 409 });
  }

  const { error } = await supabase
    .from("reviews")
    .update({
      rating,
      body: reviewBody ?? null,
      customer_name: customerName,
    })
    .eq("id", reviewId)
    .eq("token", token);

  if (error) {
    return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
