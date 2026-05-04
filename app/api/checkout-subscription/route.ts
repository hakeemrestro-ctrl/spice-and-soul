export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const SubscriptionCheckoutSchema = z.object({
  courseId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

// Monthly installment price for the bundle in cents: $1999 / 3 ≈ $666.34
// We use 66634 × 3 = $1999.02 — negligible rounding, transparently disclosed.
const INSTALLMENT_COUNT = 3;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = SubscriptionCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { courseId, email, name } = parsed.data;
  const supabase = createAdminClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, price_cents, is_bundle")
    .eq("id", courseId)
    .eq("published", true)
    .single();

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  if (!course.is_bundle) {
    return NextResponse.json({ error: "Installment plans are only available for the bundle" }, { status: 422 });
  }

  const monthlyCents = Math.ceil(course.price_cents / INSTALLMENT_COUNT);

  // Get or create Stripe customer
  const existingCustomers = await stripe.customers.list({ email, limit: 1 });
  let customer = existingCustomers.data[0];
  if (!customer) {
    customer = await stripe.customers.create({ email, name });
  }

  // Reuse existing active Price for this course + amount to avoid Stripe dashboard bloat
  const existingPrices = await stripe.prices.search({
    query: `metadata['course_id']:'${courseId}' AND metadata['type']:'installment' AND active:'true'`,
  });
  const matchingPrice = existingPrices.data.find(
    (p) => p.unit_amount === monthlyCents && p.currency === "usd"
  );

  let price: import("stripe").Stripe.Price;
  if (matchingPrice) {
    price = matchingPrice;
  } else {
    price = await stripe.prices.create({
      currency: "usd",
      unit_amount: monthlyCents,
      recurring: { interval: "month" },
      product_data: {
        name: `${course.title} — Installment Plan (${INSTALLMENT_COUNT}× monthly)`,
        metadata: { course_id: courseId, type: "installment" },
      },
      metadata: { course_id: courseId, type: "installment" },
    });
  }

  // Create subscription with cancel_at after INSTALLMENT_COUNT months
  const cancelAt = Math.floor(Date.now() / 1000) + INSTALLMENT_COUNT * 30 * 24 * 60 * 60;

  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [{ price: price.id }],
    cancel_at: cancelAt,
    metadata: {
      courseId,
      email,
      name,
      courseTitle: course.title,
      installmentCount: String(INSTALLMENT_COUNT),
    },
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice.payment_intent"],
  });

  const invoice = subscription.latest_invoice as { payment_intent?: { client_secret?: string | null } } | null;
  const clientSecret = invoice?.payment_intent?.client_secret;

  if (!clientSecret) {
    return NextResponse.json({ error: "Failed to create payment intent" }, { status: 500 });
  }

  return NextResponse.json({
    clientSecret,
    subscriptionId: subscription.id,
    monthlyCents,
    installmentCount: INSTALLMENT_COUNT,
  });
}
