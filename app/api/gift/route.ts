export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PAYTM,
  generateOrderId,
  paiseToTxnAmount,
  buildLegacyForm,
  emailToCustId,
  auditPaytmConfig,
} from "@/lib/paytm";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hakeemrestro.shop";

/**
 * Gift checkout — Paytm flow.
 *
 * Mirrors /api/paytm/initiate but accepts gift metadata that the callback uses
 * to fan out a recipient email + gift_orders row after successful payment.
 */
const GiftCheckoutSchema = z.object({
  courseId: z.string().uuid(),
  senderEmail: z.string().email(),
  senderName: z.string().min(1).max(100),
  recipientEmail: z.string().email(),
  recipientName: z.string().max(100).optional(),
  message: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  try {
    console.info("[paytm:gift] config audit", auditPaytmConfig());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[paytm:gift] Paytm config not loadable", { error: msg });
    return NextResponse.json(
      { error: "Payment gateway misconfigured. Contact support." },
      { status: 500 },
    );
  }

  const body = await req.json();
  const parsed = GiftCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { courseId, senderEmail, senderName, recipientEmail, recipientName, message } =
    parsed.data;
  const supabase = createAdminClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, price_cents")
    .eq("id", courseId)
    .eq("published", true)
    .single();

  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const orderId = generateOrderId("GIFT");
  const metadata = {
    courseTitle: course.title,
    isGift: "true",
    giftRecipientEmail: recipientEmail,
    giftRecipientName: recipientName ?? "",
    giftMessage: message ?? "",
  };

  const { error: insertErr } = await supabase.from("pending_orders").insert({
    order_id: orderId,
    course_id: courseId,
    amount_cents: course.price_cents,
    customer_email: senderEmail,
    customer_name: senderName,
    metadata,
    status: "pending",
  });

  if (insertErr) {
    console.error("[paytm:gift] pending_orders insert failed", {
      orderId,
      code: (insertErr as { code?: string }).code ?? null,
      message: insertErr.message,
    });
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }

  const callbackUrl = `${APP_URL}/api/paytm/callback`;
  let action: string;
  let fields: Record<string, string>;
  try {
    const built = await buildLegacyForm({
      orderId,
      customerId: emailToCustId(senderEmail),
      amountRupees: paiseToTxnAmount(course.price_cents),
      customerEmail: senderEmail,
      callbackUrl,
    });
    action = built.action;
    fields = built.fields;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[paytm:gift] buildLegacyForm failed", { orderId, error: msg });
    return NextResponse.json({ error: "Failed to prepare payment" }, { status: 500 });
  }

  return NextResponse.json({
    orderId,
    mid: PAYTM.mid,
    amount: paiseToTxnAmount(course.price_cents),
    action,
    fields,
  });
}
