/**
 * POST /api/paytm/callback
 *
 * Server step 2 of the Paytm All-in-One JS Checkout flow.
 *
 * Paytm POSTs an `application/x-www-form-urlencoded` body to this URL after the
 * customer finishes (or cancels) payment. We MUST NOT trust the body alone —
 * we verify the checksum AND call the Status Query API server-to-server before
 * fulfilling the order.
 *
 * Returns a 302 redirect:
 *   - On success → /thank-you?payment_intent=<TXNID>
 *   - On failure → /checkout/<slug>?status=failed
 *
 * Replaces the Stripe webhook handler.
 */
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend } from "@/lib/resend";
import { sendCourseEmail } from "@/lib/send-course-email";
import { generateCertificatePdf } from "@/lib/generate-certificate-pdf";
import { PAYTM, generateSignature, verifySignature } from "@/lib/paytm";
import type { Course, Recipe } from "@/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hakeemrestro.shop";

function generateInvoiceNumber(txnId: string): string {
  const year = new Date().getFullYear();
  return `INV-${year}-${txnId.slice(0, 12).toUpperCase()}`;
}

// Sanitized callback-params summary — Paytm-standard system fields only.
// Omits CUST_ID / EMAIL / MOBILE_NO so structured logs are safe to ship to
// Vercel runtime logs and grep across without leaking customer PII.
function safeFormSummary(p: Record<string, string>): Record<string, unknown> {
  return {
    ORDERID: p.ORDERID,
    TXNID: p.TXNID,
    STATUS: p.STATUS,
    RESPCODE: p.RESPCODE,
    RESPMSG: p.RESPMSG,
    TXNAMOUNT: p.TXNAMOUNT,
    PAYMENTMODE: p.PAYMENTMODE,
    BANKTXNID: p.BANKTXNID,
    BANKNAME: p.BANKNAME,
    CURRENCY: p.CURRENCY,
    GATEWAYNAME: p.GATEWAYNAME,
    MID: p.MID,
    TXNDATE: p.TXNDATE,
    fieldKeys: Object.keys(p).sort(),
    hasChecksum: "CHECKSUMHASH" in p,
    checksumLen: p.CHECKSUMHASH?.length ?? 0,
  };
}

async function callStatusQuery(orderId: string): Promise<{
  ok: boolean;
  status?: string;
  txnId?: string;
  amount?: string;
  resultCode?: string;
  resultMsg?: string;
  paymentMode?: string;
  bankName?: string;
}> {
  const reqBody = { mid: PAYTM.mid, orderId };
  const reqBodyString = JSON.stringify(reqBody);
  const signature = await generateSignature(reqBodyString);

  try {
    const res = await fetch(`https://${PAYTM.host}/v3/order/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reqBody, head: { signature } }),
    });
    const json = (await res.json()) as {
      body?: {
        resultInfo?: { resultStatus?: string; resultCode?: string; resultMsg?: string };
        txnId?: string;
        txnAmount?: string;
        paymentMode?: string;
        bankName?: string;
      };
    };
    return {
      ok: true,
      status: json.body?.resultInfo?.resultStatus,
      txnId: json.body?.txnId,
      amount: json.body?.txnAmount,
      resultCode: json.body?.resultInfo?.resultCode,
      resultMsg: json.body?.resultInfo?.resultMsg,
      paymentMode: json.body?.paymentMode,
      bankName: json.body?.bankName,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[paytm:callback] status query fetch failed", {
      orderId,
      host: PAYTM.host,
      error: msg,
    });
    return { ok: false };
  }
}

function redirectTo(path: string): NextResponse {
  // Paytm posts from its own domain → respond with a 302 redirect HTML that the
  // browser follows back into our app. NextResponse.redirect handles this for
  // POST → GET correctly when status 303 is set.
  return NextResponse.redirect(`${APP_URL}${path}`, { status: 303 });
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient();
  const formParams: Record<string, string> = {};

  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    params.forEach((v, k) => (formParams[k] = v));
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }

  const orderId = formParams.ORDERID;
  const checksum = formParams.CHECKSUMHASH;
  const callbackStatus = formParams.STATUS;
  const callbackTxnId = formParams.TXNID;

  if (!orderId || !checksum) {
    console.warn("[paytm:callback] missing required fields", safeFormSummary(formParams));
    return redirectTo("/courses?payment=failed");
  }

  // 1. Verify checksum FIRST. Idempotency must key off verified data — if we
  // dedup on raw form params before verification, an attacker who knows an
  // ORDERID could POST a forged TXN_SUCCESS, poisoning the webhook_events
  // table; the real callback would then hit the dedup branch and redirect
  // the user to an attacker-controlled TXNID.
  const { CHECKSUMHASH: _drop, ...verifyParams } = formParams;
  void _drop;
  const checksumOk = await verifySignature(verifyParams, checksum);

  if (!checksumOk) {
    console.error("[paytm:callback] checksum verification failed", {
      orderId,
      midTail: PAYTM.mid.slice(-4),
      ...safeFormSummary(formParams),
    });
    return redirectTo("/courses?payment=failed");
  }

  // 2. Always re-verify with the Status Query API. Don't trust the callback
  // body alone — Paytm's authoritative source-of-truth for txn state.
  const sq = await callStatusQuery(orderId);
  if (!sq.ok) {
    console.error("[paytm:callback] status query unreachable", {
      orderId,
      host: PAYTM.host,
    });
    return redirectTo("/courses?payment=failed");
  }

  // 3. Idempotency — only AFTER checksum + status query confirm authenticity.
  // Key uses the Status Query txnId (Paytm's server) over the callback body
  // when available, so attacker-controlled callbackTxnId can't pre-poison.
  const verifiedTxnId = sq.txnId ?? callbackTxnId;
  const callbackEventId = `paytm_${orderId}_${verifiedTxnId ?? "no-txn"}`;
  const { error: eventErr } = await supabase
    .from("webhook_events")
    .insert({
      stripe_event_id: callbackEventId,
      type: `paytm.${callbackStatus?.toLowerCase() ?? "unknown"}`,
      payload: formParams,
    });

  if (eventErr) {
    if ((eventErr as { code?: string }).code === "23505") {
      // Duplicate verified callback → already processed. Idempotent redirect.
      return sq.status === "TXN_SUCCESS" && verifiedTxnId
        ? redirectTo(`/thank-you?payment_intent=${verifiedTxnId}`)
        : redirectTo("/courses?payment=failed");
    }
    // Non-duplicate insert error = idempotency table broken. Fail loud.
    console.error("[paytm:callback] webhook_events insert failed", {
      orderId,
      code: (eventErr as { code?: string }).code,
      message: eventErr.message,
    });
    return redirectTo("/courses?payment=failed");
  }

  const isSuccess =
    sq.status === "TXN_SUCCESS" && callbackStatus === "TXN_SUCCESS";

  // Fetch the pending order metadata we stashed during initiate.
  const { data: pending, error: pendingErr } = await supabase
    .from("pending_orders")
    .select("*")
    .eq("order_id", orderId)
    .single();

  if (pendingErr || !pending) {
    console.error("pending_orders lookup miss:", orderId, pendingErr?.message);
    return redirectTo("/courses?payment=failed");
  }

  if (!isSuccess) {
    // Paytm rejected the txn. Log the canonical reason from both the callback
    // body and the Status Query response so prod debugging has both signals.
    console.error("[paytm:callback] payment not successful", {
      orderId,
      callbackStatus,
      statusQueryStatus: sq.status,
      callbackRespCode: formParams.RESPCODE,
      callbackRespMsg: formParams.RESPMSG,
      sqResultCode: sq.resultCode,
      sqResultMsg: sq.resultMsg,
    });
    await supabase
      .from("pending_orders")
      .update({
        status: "failed",
        resp_code: sq.resultCode ?? formParams.RESPCODE ?? null,
        resp_msg: sq.resultMsg ?? formParams.RESPMSG ?? null,
        txn_id: sq.txnId ?? callbackTxnId ?? null,
      })
      .eq("order_id", orderId);
    return redirectTo("/courses?payment=failed");
  }

  // Mark pending paid and store the verified TXNID. Final status flips to
  // either "paid" (fulfillment succeeded) or "paid_unfulfilled" below, so
  // admin/cron can find and retry the failed deliveries.
  const txnId = sq.txnId;
  if (!txnId) {
    // Should never happen given isSuccess gate above, but guard anyway —
    // never persist a falsy TXNID into the orders ledger.
    console.error("[paytm:callback] verified-success path missing sq.txnId", {
      orderId,
      callbackTxnId,
    });
    return redirectTo("/courses?payment=failed");
  }

  await supabase
    .from("pending_orders")
    .update({
      status: "paid",
      txn_id: txnId,
      resp_code: sq.resultCode ?? null,
      resp_msg: sq.resultMsg ?? null,
    })
    .eq("order_id", orderId);

  // 3. Run fulfillment (port of the old Stripe webhook handler). AWAIT it so
  // we know whether the customer actually got their email/PDFs before they
  // land on /thank-you. On failure, mark pending_orders so it shows up in
  // admin retry queue (instead of silently appearing "paid" with no order).
  try {
    await fulfillOrder({
      pending,
      txnId,
      paytmAmount: sq.amount ?? formParams.TXNAMOUNT ?? "0",
      paymentMode: sq.paymentMode ?? formParams.PAYMENTMODE ?? null,
      bankName: sq.bankName ?? formParams.BANKNAME ?? null,
      supabase,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[paytm:callback] FULFILLMENT FAILED", {
      orderId,
      txnId,
      error: msg,
    });
    // Keep status="paid" (CHECK constraint pre-0017 doesn't allow
    // 'paid_unfulfilled') but flag via resp_msg so admin can query
    //   WHERE status='paid' AND resp_msg LIKE 'fulfillment_error:%'
    // and remediate. After migration 0017 applies, switch this back to
    // status='paid_unfulfilled' for a cleaner enum.
    await supabase
      .from("pending_orders")
      .update({
        resp_msg: `fulfillment_error: ${msg}`.slice(0, 500),
      })
      .eq("order_id", orderId);
    // User still lands on /thank-you with their TXNID — they can use /resend
    // to redeliver. Admin gets resp_msg signal in the pending_orders table.
  }

  return redirectTo(`/thank-you?payment_intent=${txnId}`);
}

// -- Fulfillment ----------------------------------------------------------

type PendingOrderRow = {
  order_id: string;
  course_id: string;
  amount_cents: number;
  customer_email: string;
  customer_name: string;
  metadata: Record<string, string | undefined>;
};

async function fulfillOrder(args: {
  pending: PendingOrderRow;
  txnId: string;
  paytmAmount: string;
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

  // Best-effort "last4" — Paytm doesn't expose card digits, so we use
  // payment mode + bank as a friendly label.
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
