export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PAYTM,
  generateOrderId,
  paiseToTxnAmount,
  buildV2InitiatePayload,
  emailToCustId,
  auditPaytmConfig,
} from "@/lib/paytm";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hakeemrestro.shop";

type PaytmInitiateResponse = {
  body?: {
    resultInfo?: { resultStatus?: string; resultCode?: string; resultMsg?: string };
    txnToken?: string;
  };
};

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
  let built;
  try {
    built = await buildV2InitiatePayload({
      orderId,
      amountRupees: paiseToTxnAmount(course.price_cents),
      custId: emailToCustId(senderEmail),
      callbackUrl,
      email: senderEmail,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[paytm:gift] buildV2InitiatePayload failed", { orderId, error: msg });
    return NextResponse.json({ error: "Failed to prepare payment" }, { status: 500 });
  }

  let paytmRes: Response;
  let paytmJson: PaytmInitiateResponse;
  try {
    paytmRes = await fetch(built.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(built.payload),
    });
    paytmJson = (await paytmRes.json()) as PaytmInitiateResponse;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[paytm:gift] Paytm fetch failed", { orderId, error: msg });
    return NextResponse.json({ error: "Payment gateway unreachable" }, { status: 502 });
  }

  const resultStatus = paytmJson.body?.resultInfo?.resultStatus;
  const resultCode = paytmJson.body?.resultInfo?.resultCode;
  const resultMsg = paytmJson.body?.resultInfo?.resultMsg;
  const txnToken = paytmJson.body?.txnToken;

  if (!txnToken || resultStatus !== "S") {
    console.error("[paytm:gift] Paytm rejected initiate request", {
      orderId,
      httpStatus: paytmRes.status,
      paytmResultStatus: resultStatus,
      paytmResultCode: resultCode,
      paytmResultMsg: resultMsg,
    });
    return NextResponse.json(
      {
        error: "Payment gateway rejected the request",
        paytm: { resultCode, resultMsg },
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    orderId,
    mid: PAYTM.mid,
    amount: paiseToTxnAmount(course.price_cents),
    txnToken,
    callbackUrl,
    host: PAYTM.host,
  });
}
