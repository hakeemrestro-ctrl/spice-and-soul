import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CheckoutInputSchema } from "@/lib/validations/checkout";
import {
  BILLDESK_MERCID,
  auditBilldeskConfig,
  generateOrderId,
  generateTraceId,
  createJwsToken,
  getBilldeskBaseUrl,
  verifyJwsToken
} from "@/lib/billdesk";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://hakeemrestro.shop";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    console.info("[billdesk:initiate] config audit", auditBilldeskConfig());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[billdesk:initiate] BillDesk config not loadable", { error: msg });
    return NextResponse.json(
      { error: "Payment gateway misconfigured. Contact support." },
      { status: 500 },
    );
  }

  const reqBody = await req.json();
  const parsed = CheckoutInputSchema.safeParse(reqBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    courseId,
    email,
    name,
    couponCode,
    acquisitionSource,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
  } = parsed.data;

  const supabase = createAdminClient();

  // 1. Load course
  const { data: course, error: courseErr } = await supabase
    .from("courses")
    .select("id, title, price_cents")
    .eq("id", courseId)
    .eq("published", true)
    .single();

  if (courseErr || !course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // 2. Coupon
  let finalCents = course.price_cents;
  let resolvedCouponCode: string | undefined;

  if (couponCode) {
    const { data: coupon } = await supabase
      .from("coupons")
      .select(
        "id, code, discount_percent, discount_cents, max_uses, uses_count, expires_at, applies_to_course_ids, is_active",
      )
      .eq("is_active", true)
      .ilike("code", couponCode)
      .single();

    const couponValid =
      coupon &&
      (!coupon.expires_at || new Date(coupon.expires_at) >= new Date()) &&
      (coupon.max_uses == null || coupon.uses_count < coupon.max_uses) &&
      (!coupon.applies_to_course_ids?.length ||
        coupon.applies_to_course_ids.includes(courseId));

    if (couponValid) {
      const discountCents = coupon.discount_percent
        ? Math.round((course.price_cents * coupon.discount_percent) / 100)
        : Math.min(coupon.discount_cents ?? 0, course.price_cents);
      finalCents = Math.max(course.price_cents - discountCents, 100);
      resolvedCouponCode = coupon.code;
    }
  }

  // 3. Persist pending order
  const orderId = generateOrderId();
  const metadata = {
    courseTitle: course.title,
    ...(resolvedCouponCode ? { couponCode: resolvedCouponCode } : {}),
    ...(acquisitionSource ? { acquisitionSource } : {}),
    ...(utmSource ? { utmSource } : {}),
    ...(utmMedium ? { utmMedium } : {}),
    ...(utmCampaign ? { utmCampaign } : {}),
    ...(utmContent ? { utmContent } : {}),
    ...(utmTerm ? { utmTerm } : {}),
  };

  const { error: insertErr } = await supabase.from("pending_orders").insert({
    order_id: orderId,
    course_id: courseId,
    amount_cents: finalCents,
    customer_email: email,
    customer_name: name,
    metadata,
    status: "pending",
  });

  if (insertErr) {
    console.error("[billdesk:initiate] pending_orders insert failed", {
      orderId,
      code: (insertErr as { code?: string }).code ?? null,
      message: insertErr.message,
    });
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }

  // 4. Build BillDesk Request
  const amountRupees = (finalCents / 100).toFixed(2);
  
  // Format date as YYYY-MM-DDThh:mm:ss+05:30
  const now = new Date();
  const offsetMs = 5.5 * 60 * 60 * 1000; // IST offset
  const istDate = new Date(now.getTime() + offsetMs);
  const orderDate = istDate.toISOString().replace('Z', '') + '+05:30';

  const returnUrl = `${APP_URL}/api/billdesk/callback`;

  const requestPayload = {
    mercid: BILLDESK_MERCID,
    orderid: orderId,
    amount: amountRupees,
    order_date: orderDate,
    currency: "356", // INR
    ru: returnUrl,
    itemcode: "DIRECT",
    device: {
      init_channel: "internet",
      ip: "127.0.0.1", // To be filled appropriately or left out if not strictly validated
      mac: "11-22-33-44-55-66"
    }
  };

  const traceId = generateTraceId();

  let jwsToken: string;
  try {
    jwsToken = await createJwsToken(requestPayload);
  } catch (err) {
    console.error("[billdesk:initiate] JWS creation failed", err);
    return NextResponse.json({ error: "Failed to secure payload" }, { status: 500 });
  }

  // 5. POST server-to-server to BillDesk
  const createOrderUrl = `${getBilldeskBaseUrl()}/orders/create`;
  
  let bdRes: Response;
  let responseText: string;
  try {
    bdRes = await fetch(createOrderUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/jose",
        "Accept": "application/jose",
        "BD-Traceid": traceId,
        "BD-Timestamp": istDate.toISOString().replace(/[-:T]/g, '').slice(0, 14)
      },
      body: jwsToken,
    });
    responseText = await bdRes.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[billdesk:initiate] BillDesk fetch failed", { orderId, error: msg });
    return NextResponse.json({ error: "Payment gateway unreachable" }, { status: 502 });
  }

  if (!bdRes.ok) {
    console.error("[billdesk:initiate] BillDesk rejected create order", { status: bdRes.status, body: responseText });
    return NextResponse.json({ error: "Payment gateway error" }, { status: 502 });
  }

  // 6. Verify and Decode Response
  let verifiedResponse;
  try {
    verifiedResponse = await verifyJwsToken(responseText);
  } catch (err) {
    console.error("[billdesk:initiate] Failed to verify BillDesk response signature", err);
    return NextResponse.json({ error: "Invalid payment gateway response" }, { status: 502 });
  }

  const responsePayload = verifiedResponse.payload;
  
  if (responsePayload.status !== 'ACTIVE') {
     console.error("[billdesk:initiate] BillDesk order not ACTIVE", responsePayload);
     return NextResponse.json({ error: "Order creation failed at gateway" }, { status: 502 });
  }

  const hostedLink = responsePayload.links?.find((l: any) => l.rel === 'hosted') || responsePayload.links?.[1];

  console.info("[billdesk:initiate] BillDesk order created", {
    orderId,
    bdOrderId: responsePayload.bdorderid,
  });

  return NextResponse.json({
    orderId,
    bdOrderId: responsePayload.bdorderid,
    merchantId: BILLDESK_MERCID,
    authorizationToken: responsePayload.links?.find((l: any) => l.rel === 'authorization')?.headers?.authorization,
    hostedUrl: hostedLink?.href,
    hostedParameters: hostedLink?.parameters,
    returnUrl,
  });
}
