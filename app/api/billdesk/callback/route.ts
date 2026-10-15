import { NextRequest, NextResponse } from 'next/server';
import { readBilldeskToken } from '@/lib/billdesk-handler';
import { billdeskLog } from '@/lib/billdesk-log';
import { randomUUID } from 'node:crypto';
import { billdeskAppOrigin } from '@/lib/billdesk-uat-auth';
import { verifyJwsToken } from '@/lib/billdesk';
import { createAdminClient } from '@/lib/supabase/admin';
import { recordBilldeskRawAudit } from '@/lib/billdesk-audit';
import { validatePayment } from '@/lib/billdesk-payment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Browser Return URL (RU) route for BillDesk V2.
 *
 * Requirements:
 * - Payment claiming and fulfillment are strictly forbidden here.
 * - Displays acknowledgement/status to customer only.
 * - Fulfillment relies solely on verified S2S webhook notifications.
 * - Audits unchanged tokens only after signature and payment-envelope validation.
 * - Rejected inbound tokens are not retained; they produce redacted diagnostics.
 */
export async function POST(req: NextRequest) {
  let APP_URL: string;
  try {
    APP_URL = billdeskAppOrigin();
  } catch {
    return NextResponse.json({ error: 'BillDesk configuration unavailable' }, { status: 503 });
  }

  const correlation = randomUUID(), started = Date.now();
  let rawToken: string;
  try {
    rawToken = await readBilldeskToken(req);
  } catch {
    billdeskLog('callback', 'rejected', correlation, Date.now() - started);
    return NextResponse.redirect(`${APP_URL}/courses?payment=pending`, { status: 303 });
  }

  try {
    // 1. Verify JWS signature and decrypt JWE
    const { payload } = await verifyJwsToken(rawToken);
    const notification = validatePayment(payload);
    const orderId = notification.orderId;

    // 2. Preserve the verified token unchanged, not a reconstructed payload.
    // A later database binding rejection still leaves this authenticated evidence.
    const supabase = createAdminClient();
    await recordBilldeskRawAudit(orderId, 'callback_response', rawToken, supabase);

    // 3. Read-only status check from database (NO claiming or fulfillment)
    const { data: pending, error } = await supabase
      .from('pending_orders')
      .select('order_id, status, txn_id, amount_cents, metadata')
      .eq('order_id', orderId)
      .maybeSingle();
    if (error || !pending || pending.order_id !== orderId ||
        pending.metadata?.paymentGateway !== 'billdesk' || pending.amount_cents !== notification.amount ||
        (pending.txn_id && pending.txn_id !== notification.txnId)) {
      throw new Error('BillDesk callback binding unavailable');
    }

    // 4. Return acknowledgement / status redirect only
    // If webhook has already posted/fulfilled the payment:
    if (pending.status === 'paid' && pending.txn_id && pending.txn_id === notification.txnId) {
      billdeskLog('callback', 'accepted', correlation, Date.now() - started);
      return NextResponse.redirect(
        `${APP_URL}/thank-you?payment_intent=${encodeURIComponent(pending.txn_id)}`,
        { status: 303 }
      );
    }

    // If transaction explicitly failed:
    if (pending.status === 'failed' && notification.status === '0399') {
      billdeskLog('callback', 'rejected', correlation, Date.now() - started);
      return NextResponse.redirect(`${APP_URL}/courses?payment=failed`, { status: 303 });
    }

    // Otherwise, payment is pending or webhook is in transit (display pending acknowledgement)
    billdeskLog('callback', 'accepted', correlation, Date.now() - started);
    return NextResponse.redirect(`${APP_URL}/courses?payment=pending`, { status: 303 });
  } catch {
    billdeskLog('callback', 'review', correlation, Date.now() - started);
    return NextResponse.redirect(`${APP_URL}/courses?payment=pending`, { status: 303 });
  }
}
