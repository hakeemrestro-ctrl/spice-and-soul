export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const GiftCheckoutSchema = z.object({
  courseId: z.string().uuid(),
  senderEmail: z.string().email(),
  senderName: z.string().min(1).max(100),
  recipientEmail: z.string().email(),
  recipientName: z.string().max(100).optional(),
  message: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = GiftCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { courseId, senderEmail, senderName, recipientEmail, recipientName, message } = parsed.data;
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

  const paymentIntent = await stripe.paymentIntents.create({
    amount: course.price_cents,
    currency: "usd",
    receipt_email: senderEmail,
    metadata: {
      courseId,
      email: senderEmail,
      name: senderName,
      courseTitle: course.title,
      giftRecipientEmail: recipientEmail,
      giftRecipientName: recipientName ?? "",
      giftMessage: message ?? "",
      isGift: "true",
    },
  });

  return NextResponse.json({ clientSecret: paymentIntent.client_secret });
}
