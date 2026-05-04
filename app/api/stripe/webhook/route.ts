export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { resend } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCourseEmail } from "@/lib/send-course-email";
import { generateCertificatePdf } from "@/lib/generate-certificate-pdf";
import type { Course, Recipe } from "@/types";
import type Stripe from "stripe";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://spiceandsoul.com";

function generateInvoiceNumber(paymentIntentId: string): string {
  const year = new Date().getFullYear();
  return `INV-${year}-${paymentIntentId.replace("pi_", "").slice(0, 8).toUpperCase()}`;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 400 }
    );
  }

  // Idempotency + audit log: unique constraint on stripe_event_id rejects duplicates
  const _supabase = createAdminClient();
  const { error: eventErr } = await _supabase
    .from("webhook_events")
    .insert({
      stripe_event_id: event.id,
      type: event.type,
      payload: event.data.object,
    });

  if (eventErr) {
    if ((eventErr as { code?: string }).code === "23505") {
      return NextResponse.json({ received: true }); // already processed
    }
    console.warn("webhook_events insert error:", eventErr.message);
  }

  if (event.type === "charge.refunded") {
    return handleRefund(event.data.object as Stripe.Charge);
  }

  if (event.type === "invoice.paid") {
    return handleInvoicePaid(event.data.object as Stripe.Invoice);
  }

  if (event.type === "invoice.payment_failed") {
    return handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
  }

  if (event.type !== "payment_intent.succeeded") {
    return NextResponse.json({ received: true });
  }

  return handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const { courseId, email, name } = paymentIntent.metadata;

  if (!courseId || !email) {
    return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Get or create user — .maybeSingle() so zero rows returns null instead of throwing
  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  let userId: string;

  if (existingUser) {
    userId = existingUser.id;
  } else {
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),
      user_metadata: { full_name: name },
      email_confirm: true,
    });
    if (authErr || !authData.user) {
      console.error("Failed to create user:", authErr);
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500 }
      );
    }
    userId = authData.user.id;
  }

  // Fetch the purchased course
  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single<Course>();

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // Extract last4 from the charge (best effort)
  let last4: string | undefined;
  try {
    const expanded = await stripe.paymentIntents.retrieve(paymentIntent.id, {
      expand: ["latest_charge.payment_method_details"],
    });
    const charge = expanded.latest_charge as Stripe.Charge | null;
    last4 = charge?.payment_method_details?.card?.last4 ?? undefined;
  } catch (err) {
    console.warn("Failed to fetch last4:", err);
  }

  const invoiceNumber = generateInvoiceNumber(paymentIntent.id);

  // Bundle expansion: collect child courses if applicable
  type CoursePayload = { course: Course; recipes: Recipe[] };
  const childCourses: CoursePayload[] = [];

  if (course.is_bundle && course.bundle_course_ids?.length) {
    const { data: children } = await supabase
      .from("courses")
      .select("*")
      .in("id", course.bundle_course_ids)
      .returns<Course[]>();

    if (children && children.length > 0) {
      const recipesByCourse = await Promise.all(
        children.map((c) =>
          supabase
            .from("recipes")
            .select("*")
            .eq("course_id", c.id)
            .order("sort_order", { ascending: true })
            .returns<Recipe[]>(),
        ),
      );
      children.forEach((c, idx) => {
        childCourses.push({
          course: c,
          recipes: recipesByCourse[idx].data ?? [],
        });
      });
    }
  } else {
    const { data: recipes } = await supabase
      .from("recipes")
      .select("*")
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true })
      .returns<Recipe[]>();
    childCourses.push({ course, recipes: recipes ?? [] });
  }

  // Insert parent order row first (course_id = the purchased SKU; for bundles
  // this is the bundle id itself). Then insert one child row per included course.
  const couponCode = paymentIntent.metadata.couponCode ?? null;
  const acquisitionSource = paymentIntent.metadata.acquisitionSource ?? null;
  const utmSource = paymentIntent.metadata.utmSource ?? null;
  const utmMedium = paymentIntent.metadata.utmMedium ?? null;
  const utmCampaign = paymentIntent.metadata.utmCampaign ?? null;
  const utmContent = paymentIntent.metadata.utmContent ?? null;
  const utmTerm = paymentIntent.metadata.utmTerm ?? null;
  const isGift = paymentIntent.metadata.isGift === "true";
  const giftRecipientEmail = paymentIntent.metadata.giftRecipientEmail ?? null;
  const giftRecipientName = paymentIntent.metadata.giftRecipientName ?? null;
  const giftMessage = paymentIntent.metadata.giftMessage ?? null;

  // Increment coupon uses_count atomically via RPC (race-safe).
  if (couponCode) {
    void (async () => {
      try {
        const { error } = await supabase.rpc("increment_coupon_use", { p_code: couponCode });
        if (error) console.warn("Failed to increment coupon uses:", error);
      } catch (err) {
        console.warn("Failed to increment coupon uses:", err);
      }
    })();
  }

  const { data: parentOrder, error: parentErr } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      course_id: courseId,
      stripe_payment_intent_id: paymentIntent.id,
      amount_cents: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: "paid",
      invoice_number: invoiceNumber,
      customer_email: email,
      customer_name: name ?? "",
      stripe_last4: last4 ?? null,
      coupon_code: couponCode,
      acquisition_source: acquisitionSource,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm,
    })
    .select("id")
    .single();

  if (parentErr || !parentOrder) {
    console.error("Failed to save parent order:", parentErr);
    return NextResponse.json(
      { error: "Failed to save order" },
      { status: 500 }
    );
  }

  // Bundle: insert child order rows so dashboard / analytics / refunds work per course
  if (course.is_bundle && childCourses.length > 0) {
    const childRows = childCourses.map((c) => ({
      user_id: userId,
      course_id: c.course.id,
      stripe_payment_intent_id: paymentIntent.id,
      amount_cents: 0, // monetary value lives on parent row
      currency: paymentIntent.currency,
      status: "paid",
      invoice_number: invoiceNumber,
      customer_email: email,
      customer_name: name ?? "",
      stripe_last4: last4 ?? null,
      parent_order_id: parentOrder.id,
      coupon_code: couponCode,
      acquisition_source: acquisitionSource,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm,
    }));
    const { error: childErr } = await supabase.from("orders").insert(childRows);
    if (childErr) {
      console.error("Failed to save bundle child orders:", childErr);
      // Don't fail webhook — parent is saved; child rows can be reconciled later.
    }
  }

  // Send email — single message with N course PDFs + 1 invoice
  try {
    await sendCourseEmail({
      customerEmail: email,
      customerName: name ?? email,
      course,
      recipes: course.is_bundle ? [] : childCourses[0].recipes,
      priceCents: paymentIntent.amount,
      invoiceNumber,
      last4,
      resendUrl: `${process.env.NEXT_PUBLIC_APP_URL}/resend`,
      bundleChildren: course.is_bundle ? childCourses : undefined,
    });
  } catch (emailErr) {
    console.error("Failed to send email:", emailErr);
    // Don't fail webhook — order is saved, customer can re-trigger via /resend
  }

  // Gift: create gift_orders row and email the recipient their PDFs
  if (isGift && giftRecipientEmail) {
    createGiftOrderAndEmail({
      senderOrderId: parentOrder.id,
      senderEmail: email,
      senderName: name ?? email,
      recipientEmail: giftRecipientEmail,
      recipientName: giftRecipientName,
      courseId: courseId,
      course,
      childCourses,
      message: giftMessage,
      resendUrl: `${BASE}/resend`,
    }).catch((err) => console.error("Gift order creation failed:", err));
  }

  // Generate and email certificate for non-bundle courses (best effort)
  if (!course.is_bundle) {
    generateAndEmailCertificate({
      orderId: parentOrder.id,
      courseId: courseId,
      courseTitle: course.title,
      customerEmail: email,
      customerName: name ?? email.split("@")[0],
    }).catch((err) => console.error("Certificate generation failed:", err));
  }

  return NextResponse.json({ received: true });
}

async function createGiftOrderAndEmail({
  senderOrderId,
  senderEmail,
  senderName,
  recipientEmail,
  recipientName,
  courseId,
  course,
  childCourses,
  message,
  resendUrl,
}: {
  senderOrderId: string;
  senderEmail: string;
  senderName: string;
  recipientEmail: string;
  recipientName: string | null;
  courseId: string;
  course: Course;
  childCourses: { course: Course; recipes: Recipe[] }[];
  message: string | null;
  resendUrl: string;
}) {
  const supabase = createAdminClient();

  // Create gift_orders row
  const { data: giftRow } = await supabase
    .from("gift_orders")
    .insert({
      sender_order_id: senderOrderId,
      sender_email: senderEmail,
      sender_name: senderName,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      course_id: courseId,
      message,
    })
    .select("redemption_token")
    .single();

  if (!giftRow) return;

  const invoiceNumber = `GIFT-${senderOrderId.slice(0, 8).toUpperCase()}`;
  const recipientDisplayName = recipientName ?? recipientEmail.split("@")[0];

  await sendCourseEmail({
    customerEmail: recipientEmail,
    customerName: recipientDisplayName,
    course,
    recipes: course.is_bundle ? [] : childCourses[0]?.recipes ?? [],
    priceCents: 0,
    invoiceNumber,
    resendUrl,
    bundleChildren: course.is_bundle ? childCourses : undefined,
    gift: { senderName, message },
  });
}

async function generateAndEmailCertificate({
  orderId,
  courseId,
  courseTitle,
  customerEmail,
  customerName,
}: {
  orderId: string;
  courseId: string;
  courseTitle: string;
  customerEmail: string;
  customerName: string;
}) {
  const supabase = createAdminClient();

  // Idempotency
  const { data: existing } = await supabase
    .from("certificates")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (existing) return;

  const pdfBuffer = await generateCertificatePdf({
    customerName,
    courseTitle,
    certificateId: orderId,
  });

  const { data: certRow } = await supabase
    .from("certificates")
    .insert({
      order_id: orderId,
      course_id: courseId,
      customer_name: customerName,
      customer_email: customerEmail,
    })
    .select("id")
    .single();

  if (!certRow) return;

  await resend.emails.send({
    from: "Spice & Soul Academy <hello@spiceandsoul.com>",
    replyTo: "support@spiceandsoul.com",
    to: customerEmail,
    subject: `Your Spice & Soul Certificate — ${courseTitle}`,
    html: `<p>Hi ${customerName.split(" ")[0]},</p>
<p>Welcome to <strong>${courseTitle}</strong>! Your enrollment certificate is attached — a keepsake for your kitchen.</p>
<p>Happy cooking — Hakeem's kitchen is always open.</p>
<p style="color:#9a7a5a;font-size:12px">Spice &amp; Soul Academy · by Hakeem's, Indore</p>`,
    attachments: [
      {
        filename: `spice-and-soul-certificate-${courseTitle.toLowerCase().replace(/\s+/g, "-")}.pdf`,
        content: pdfBuffer.toString("base64"),
      },
    ],
  });
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const sub = (invoice as unknown as { subscription?: string | { id: string } }).subscription;
  const subscriptionId = typeof sub === "string" ? sub : sub?.id;

  if (!subscriptionId) return NextResponse.json({ received: true });

  const supabase = createAdminClient();

  // Upsert subscription row and increment installments_paid
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id, installments_paid, installments_total, course_id, customer_email, customer_name")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (!existing) {
    // First invoice — fetch subscription metadata to bootstrap the row
    const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
    const { courseId, email, name, installmentCount } = stripeSub.metadata;
    const monthlyCents = (stripeSub.items.data[0]?.price.unit_amount) ?? 0;
    const total = parseInt(installmentCount ?? "3", 10);

    // Upsert or create user
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: authData } = await supabase.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        user_metadata: { full_name: name },
        email_confirm: true,
      });
      userId = authData.user?.id ?? "";
    }

    if (!userId) return NextResponse.json({ received: true });

    await supabase.from("subscriptions").insert({
      user_id: userId,
      course_id: courseId,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: typeof stripeSub.customer === "string" ? stripeSub.customer : stripeSub.customer?.id ?? "",
      status: "active",
      monthly_cents: monthlyCents,
      total_cents: monthlyCents * total,
      installments_total: total,
      installments_paid: 1,
      customer_email: email,
      customer_name: name ?? "",
    });
  } else {
    await supabase
      .from("subscriptions")
      .update({
        installments_paid: existing.installments_paid + 1,
        status: "active",
      })
      .eq("stripe_subscription_id", subscriptionId);
  }

  return NextResponse.json({ received: true });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const sub2 = (invoice as unknown as { subscription?: string | { id: string } }).subscription;
  const subscriptionId = typeof sub2 === "string" ? sub2 : sub2?.id;

  if (!subscriptionId) return NextResponse.json({ received: true });

  const supabase = createAdminClient();

  await supabase
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", subscriptionId);

  return NextResponse.json({ received: true });
}

async function handleRefund(charge: Stripe.Charge) {
  if (!charge.payment_intent) {
    return NextResponse.json({ received: true });
  }

  const supabase = createAdminClient();
  const paymentIntentId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent.id;

  const { error } = await supabase
    .from("orders")
    .update({ status: "refunded" })
    .eq("stripe_payment_intent_id", paymentIntentId);

  if (error) {
    console.error("Failed to mark orders refunded:", error);
    return NextResponse.json(
      { error: "Failed to update orders" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
