export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth: require signed-in admin
  const ssr = await createClient();
  const {
    data: { user },
  } = await ssr.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await ssr
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, status, stripe_payment_intent_id, parent_order_id")
    .eq("id", id)
    .single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.parent_order_id) {
    return NextResponse.json(
      { error: "Refund the parent order, not a bundle child." },
      { status: 400 },
    );
  }
  if (order.status !== "paid") {
    return NextResponse.json(
      { error: `Order is ${order.status}, cannot refund.` },
      { status: 400 },
    );
  }

  try {
    await stripe.refunds.create({
      payment_intent: order.stripe_payment_intent_id,
    });
  } catch (err) {
    console.error("Stripe refund failed:", err);
    const msg = err instanceof Error ? err.message : "Refund failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // charge.refunded webhook will mark all rows refunded; flip status now too
  // so the admin UI updates immediately.
  await supabase
    .from("orders")
    .update({ status: "refunded" })
    .eq("stripe_payment_intent_id", order.stripe_payment_intent_id);

  return NextResponse.json({ ok: true });
}
