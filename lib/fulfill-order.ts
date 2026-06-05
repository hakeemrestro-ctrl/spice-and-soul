/**
 * Shared post-payment fulfillment — gateway-agnostic.
 *
 * Extracted from the Paytm callback so both Paytm and PayGlocal (and any
 * future processor) run identical fulfillment: create user, insert parent +
 * bundle-child order rows, send course/invoice emails, generate certificate,
 * fan out gift orders, bump coupon usage.
 *
 * The caller verifies payment authenticity (checksum/status-query for Paytm,
 * status API for PayGlocal) BEFORE calling fulfillOrder. This module assumes
 * the payment is already confirmed.
 *
 * `stripe_payment_intent_id` / `stripe_last4` column names are legacy (kept for
 * ID stability across the Stripe→Paytm→PayGlocal migrations). For non-Stripe
 * gateways we store the gateway transaction id / a friendly payment label.
 */
import { resend } from "@/lib/resend";
import { sendCourseEmail } from "@/lib/send-course-email";
import { generateCertificatePdf } from "@/lib/generate-certificate-pdf";
import type { Course, Recipe } from "@/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hakeemrestro.shop";

export type PendingOrderRow = {
  order_id: string;
  course_id: string;
  amount_cents: number;
  customer_email: string;
  customer_name: string;
  metadata: Record<string, string | undefined>;
};

export function generateInvoiceNumber(txnId: string): string {
  const year = new Date().getFullYear();
  return `INV-${year}-${txnId.slice(0, 12).toUpperCase()}`;
}

export async function fulfillOrder(args: {
  pending: PendingOrderRow;
  txnId: string;
  /** Friendly payment label (Paytm: mode+bank; PayGlocal: card scheme/brand). */
  paymentMode: string | null;
  bankName: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
}) {
  const { pending, txnId, paymentMode, bankName, supabase } = args;
  const email = pending.customer_email;
  const name = pending.customer_name;
  const courseId = pending.course_id;
  const meta = pending.metadata ?? {};
  const couponCode = meta.couponCode ?? null;

  // Get or create user
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
      throw new Error("Failed to create user");
    }
    userId = authData.user.id;
  }

  // Fetch course
  const courseRes = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  const course = courseRes.data as Course | null;
  if (!course) throw new Error("Course not found");

  const invoiceNumber = generateInvoiceNumber(txnId);

  // Bundle expansion
  type CoursePayload = { course: Course; recipes: Recipe[] };
  const childCourses: CoursePayload[] = [];

  if (course.is_bundle && course.bundle_course_ids?.length) {
    const childrenRes = await supabase
      .from("courses")
      .select("*")
      .in("id", course.bundle_course_ids);

    const children = (childrenRes.data ?? []) as Course[];
    if (children.length > 0) {
      const recipesByCourse = await Promise.all(
        children.map((c: Course) =>
          supabase
            .from("recipes")
            .select("*")
            .eq("course_id", c.id)
            .order("sort_order", { ascending: true }),
        ),
      );
      children.forEach((c: Course, idx: number) => {
        childCourses.push({
          course: c,
          recipes: (recipesByCourse[idx].data ?? []) as Recipe[],
        });
      });
    }
  } else {
    const recipesRes = await supabase
      .from("recipes")
      .select("*")
      .eq("course_id", courseId)
      .order("sort_order", { ascending: true });
    childCourses.push({ course, recipes: (recipesRes.data ?? []) as Recipe[] });
  }

  // Best-effort "last4" — gateways may not expose card digits, so we use a
  // friendly payment-mode + bank label instead.
  const last4 = [paymentMode, bankName].filter(Boolean).join(" ").slice(0, 32) || undefined;

  // Bump coupon use atomically
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

  // Parent order
  const { data: parentOrder, error: parentErr } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      course_id: courseId,
      stripe_payment_intent_id: txnId,
      amount_cents: pending.amount_cents,
      currency: "inr",
      status: "paid",
      invoice_number: invoiceNumber,
      customer_email: email,
      customer_name: name,
      stripe_last4: last4 ?? null,
      coupon_code: couponCode,
      acquisition_source: meta.acquisitionSource ?? null,
      utm_source: meta.utmSource ?? null,
      utm_medium: meta.utmMedium ?? null,
      utm_campaign: meta.utmCampaign ?? null,
      utm_content: meta.utmContent ?? null,
      utm_term: meta.utmTerm ?? null,
    })
    .select("id")
    .single();

  if (parentErr || !parentOrder) {
    console.error("Failed to save parent order:", parentErr);
    throw new Error("Failed to save order");
  }

  // Bundle: child rows
  if (course.is_bundle && childCourses.length > 0) {
    const childRows = childCourses.map((c) => ({
      user_id: userId,
      course_id: c.course.id,
      stripe_payment_intent_id: txnId,
      amount_cents: 0,
      currency: "inr",
      status: "paid",
      invoice_number: invoiceNumber,
      customer_email: email,
      customer_name: name,
      stripe_last4: last4 ?? null,
      parent_order_id: parentOrder.id,
      coupon_code: couponCode,
      acquisition_source: meta.acquisitionSource ?? null,
      utm_source: meta.utmSource ?? null,
      utm_medium: meta.utmMedium ?? null,
      utm_campaign: meta.utmCampaign ?? null,
      utm_content: meta.utmContent ?? null,
      utm_term: meta.utmTerm ?? null,
    }));
    const { error: childErr } = await supabase.from("orders").insert(childRows);
    if (childErr) {
      console.error("Failed to save bundle child orders:", childErr);
    }
  }

  // Email — fire and recover
  try {
    await sendCourseEmail({
      customerEmail: email,
      customerName: name,
      course,
      recipes: course.is_bundle ? [] : childCourses[0].recipes,
      priceCents: pending.amount_cents,
      invoiceNumber,
      last4,
      resendUrl: `${APP_URL}/resend`,
      bundleChildren: course.is_bundle ? childCourses : undefined,
    });
  } catch (emailErr) {
    console.error("Failed to send email:", emailErr);
  }

  // Gift fan-out: create gift_orders row + email recipient
  const isGift = meta.isGift === "true";
  const giftRecipientEmail = meta.giftRecipientEmail;
  const giftRecipientName = meta.giftRecipientName;
  const giftMessage = meta.giftMessage;

  if (isGift && giftRecipientEmail) {
    createGiftOrderAndEmail({
      senderOrderId: parentOrder.id,
      senderEmail: email,
      senderName: name,
      recipientEmail: giftRecipientEmail,
      recipientName: giftRecipientName ?? null,
      courseId,
      course,
      childCourses,
      message: giftMessage ?? null,
      resendUrl: `${APP_URL}/resend`,
      supabase,
    }).catch((err) => console.error("Gift order creation failed:", err));
  }

  // Certificate (non-bundle, best effort) — not for gift orders (recipient receives the certificate separately)
  if (!course.is_bundle) {
    generateAndEmailCertificate({
      orderId: parentOrder.id,
      courseId,
      courseTitle: course.title,
      customerEmail: email,
      customerName: name || email.split("@")[0],
      supabase,
    }).catch((err) => console.error("Certificate generation failed:", err));
  }
}

async function createGiftOrderAndEmail(args: {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
}) {
  const {
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
    supabase,
  } = args;

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

async function generateAndEmailCertificate(args: {
  orderId: string;
  courseId: string;
  courseTitle: string;
  customerEmail: string;
  customerName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
}) {
  const { orderId, courseId, courseTitle, customerEmail, customerName, supabase } = args;

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
    from: "Spice & Soul Academy <hello@hakeemrestro.shop>",
    replyTo: "hakeemrestro@gmail.com",
    to: customerEmail,
    subject: `Your Spice & Soul Certificate — ${courseTitle}`,
    html: `<p>Hi ${customerName.split(" ")[0]},</p>
<p>Welcome to <strong>${courseTitle}</strong>! Your enrollment certificate is attached — a keepsake for your kitchen.</p>
<p>Happy cooking — Hakeem kitchen is always open.</p>
<p style="color:#9a7a5a;font-size:12px">Spice &amp; Soul Academy · by Hakeem, Bhopal</p>`,
    attachments: [
      {
        filename: `spice-and-soul-certificate-${courseTitle.toLowerCase().replace(/\s+/g, "-")}.pdf`,
        content: pdfBuffer.toString("base64"),
      },
    ],
  });
}
