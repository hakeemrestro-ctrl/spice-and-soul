import { randomUUID } from 'node:crypto';
import { authorizeBilldeskCheckout, billdeskAppOrigin } from '@/lib/billdesk-uat-auth';
import { readBilldeskBody } from '@/lib/billdesk-body';
import { runBilldeskCheckout } from '@/lib/billdesk-checkout';
import { hostedProfile, validateCreateResponse } from '@/lib/billdesk-create-response';
import { billdeskLog } from '@/lib/billdesk-log';
import { adapterRequest, upstreamEnabled } from '@/lib/billdesk-adapter-client';
import { billdeskDevice } from '@/lib/billdesk-device';
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CheckoutInputSchema } from "@/lib/validations/checkout";
import {
  BILLDESK_MERCID,
  auditBilldeskConfig,
  generateOrderId,
  generateTraceId,
  createJwsToken,
  billdeskTimestamp,
  verifyJwsToken
} from "@/lib/billdesk";
import { operationForEnvironment } from '@/adapter/billdesk/protocol';


export const dynamic = "force-dynamic";

async function initiate(req: NextRequest) {
  if (!upstreamEnabled()) return NextResponse.json({ error: 'UPSTREAM_DISABLED' }, { status: 503 });
  const correlationId = randomUUID(), started = Date.now();
  let reqBody: unknown;
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return NextResponse.json({ error: 'Invalid content type' }, { status: 415 });
  try { reqBody = JSON.parse(await readBilldeskBody(req, 16384)); }
  catch { return NextResponse.json({ error: 'Invalid input' }, { status: 400 }); }
  const attemptId = req.headers.get('idempotency-key') || '';
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(attemptId)) return NextResponse.json({ error: 'Invalid checkout attempt' }, { status: 400 });
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

  let actorRef: string;
  try { actorRef = await authorizeBilldeskCheckout(req, email); }
  catch { return NextResponse.json({ error: 'CHECKOUT_FORBIDDEN' }, { status: 403 }); }

  let device;
  try { device = billdeskDevice(req.headers); }
  catch { return NextResponse.json({ error: 'Device configuration unavailable' }, { status: 400 }); }
  try {
    auditBilldeskConfig();
    hostedProfile();
  } catch {
    billdeskLog('initiate', 'rejected', correlationId, Date.now() - started);
    return NextResponse.json(
      { error: "Payment gateway misconfigured. Contact support." },
      { status: 500 },
    );
  }

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
    paymentGateway: "billdesk",
    courseTitle: course.title,
    ...(resolvedCouponCode ? { couponCode: resolvedCouponCode } : {}),
    ...(acquisitionSource ? { acquisitionSource } : {}),
    ...(utmSource ? { utmSource } : {}),
    ...(utmMedium ? { utmMedium } : {}),
    ...(utmCampaign ? { utmCampaign } : {}),
    ...(utmContent ? { utmContent } : {}),
    ...(utmTerm ? { utmTerm } : {}),
  };

  try {
  const response = await runBilldeskCheckout({ actorRef, attemptId, courseId, amount: finalCents, email, name, coupon: resolvedCouponCode || '' }, {
    async reserve(binding, fingerprint) {
      const { data, error } = await supabase.rpc('billdesk_reserve_checkout', {
        p_attempt_id: binding.attemptId, p_actor_ref: binding.actorRef, p_course_id: binding.courseId,
        p_amount: binding.amount, p_fingerprint: fingerprint, p_order_id: orderId,
        p_email: email, p_name: name, p_metadata: metadata,
      });
      if (error || !data) throw new Error('Checkout unavailable');
      return data;
    },
    async finish(id, state, result) {
      const { error } = await supabase.rpc('billdesk_finish_checkout', { p_order_id: id, p_state: state, p_response: result });
      if (error) throw new Error('Checkout persistence unavailable');
    },
  }, async (orderId) => {
  // 4. Build BillDesk Request
  const amountRupees = (finalCents / 100).toFixed(2);
  
  // Format date as YYYY-MM-DDThh:mm:ss+05:30
  const now = new Date();
  const offsetMs = 5.5 * 60 * 60 * 1000; // IST offset
  const istDate = new Date(now.getTime() + offsetMs);
  const orderDate = istDate.toISOString().slice(0, 19) + '+05:30';

  const returnUrl = `${billdeskAppOrigin()}/api/billdesk/callback`;

  const requestPayload = {
    mercid: BILLDESK_MERCID,
    orderid: orderId,
    amount: amountRupees,
    order_date: orderDate,
    currency: "356", // INR
    ru: returnUrl,
    itemcode: "DIRECT",
    device
  };

  const traceId = generateTraceId();

  const jwsToken = await createJwsToken(requestPayload);
  const responseText = await adapterRequest(operationForEnvironment('orders/create'), {
    operationId: orderId.replaceAll('_', '-'), traceId, timestamp: billdeskTimestamp(), jose: jwsToken,
  });
  const verifiedResponse = await verifyJwsToken(responseText);
  const hosted = validateCreateResponse(verifiedResponse.payload, { orderId, merchantId: BILLDESK_MERCID, amount: amountRupees });
  return { orderId, ...hosted, returnUrl };
  });
  billdeskLog('initiate', 'accepted', correlationId, Date.now() - started);
  return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    billdeskLog('initiate', 'unknown', correlationId, Date.now() - started);
    return NextResponse.json({ error: 'Checkout requires reconciliation; do not start a new attempt' }, { status: 409 });
  }
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  try { return await initiate(req); }
  catch {
    billdeskLog('initiate', 'rejected', randomUUID(), Date.now() - started);
    return NextResponse.json({ error: 'Checkout unavailable' }, { status: 503 });
  }
}
