/**
 * GET /api/payglocal/test-pay
 *
 * TEMPORARY ₹1 PayGlocal test. Creates a real ₹1 PayCollect transaction and
 * 302-redirects straight to PayGlocal's hosted payment page. Use to verify the
 * full round-trip (pay → callback → fulfillment → emails) end to end.
 *
 * DELETE this route after verification.
 */
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PAYGLOCAL,
  generatePayglocalOrderId,
  initiatePayCollect,
  auditPayglocalConfig,
} from "@/lib/payglocal";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hakeemrestro.shop";

export async function GET() {
  let audit: Record<string, unknown>;
  try {
    audit = auditPayglocalConfig();
  } catch (err) {
    return NextResponse.json(
      { error: "PayGlocal config not loadable", message: (err as Error).message },
      { status: 500 },
    );
  }

  const supabase = createAdminClient();
  const { data: course } = await supabase
    .from("courses")
    .select("id, title")
    .eq("published", true)
    .limit(1)
    .single();
  if (!course) {
    return NextResponse.json({ error: "No published course found" }, { status: 500 });
  }

  const orderId = generatePayglocalOrderId("PGLTEST");
  const email = "payglocal-test@hakeemrestro.shop";

  await supabase.from("pending_orders").insert({
    order_id: orderId,
    course_id: course.id,
    amount_cents: 100, // ₹1.00
    customer_email: email,
    customer_name: "PayGlocal 1 Rupee Test",
    metadata: { courseTitle: course.title, gateway: "payglocal", isTestPay: "true" },
    status: "pending",
  });

  const callbackUrl = `${APP_URL}/api/payglocal/callback`;
  const result = await initiatePayCollect({
    merchantTxnId: orderId,
    amountRupees: "1.00",
    callbackUrl,
    email,
  });

  const redirectUrl = result.body.data?.redirectUrl;
  const gid = result.body.gid;

  if (!redirectUrl) {
    return NextResponse.json(
      {
        error: "PayGlocal rejected initiate",
        audit,
        httpStatus: result.httpStatus,
        payglocal: {
          status: result.body.status,
          reasonCode: result.body.reasonCode,
          message: result.body.message,
          errors: result.body.errors,
        },
      },
      { status: 502 },
    );
  }

  if (gid) {
    await supabase
      .from("pending_orders")
      .update({ metadata: { courseTitle: course.title, gateway: "payglocal", isTestPay: "true", gid } })
      .eq("order_id", orderId);
  }

  console.info("[payglocal:test-pay] redirecting", { orderId, gid, host: PAYGLOCAL.host });
  return NextResponse.redirect(redirectUrl, { status: 302 });
}
