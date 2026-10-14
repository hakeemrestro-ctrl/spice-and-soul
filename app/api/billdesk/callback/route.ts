import { NextRequest, NextResponse } from 'next/server';
import { handleBilldeskPayment, readBilldeskToken } from '@/lib/billdesk-handler';
import { billdeskLog } from '@/lib/billdesk-log';
import { randomUUID } from 'node:crypto';
import { billdeskAppOrigin } from '@/lib/billdesk-uat-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  let APP_URL: string;
  try {
    APP_URL = billdeskAppOrigin();
  } catch { return NextResponse.json({ error: 'BillDesk configuration unavailable' }, { status:503 }); }
  const correlation = randomUUID(), started = Date.now();
  try {
    const result = await handleBilldeskPayment(await readBilldeskToken(req));
    const path = result.status === 'paid' && result.txnId
      ? `/thank-you?payment_intent=${encodeURIComponent(result.txnId)}`
      : `/courses?payment=${result.status === 'failed' ? 'failed' : 'pending'}`;
    return NextResponse.redirect(`${APP_URL}${path}`, { status: 303 });
  } catch {
    billdeskLog('callback','review',correlation,Date.now()-started);
    return NextResponse.redirect(`${APP_URL}/courses?payment=pending`, { status: 303 });
  }
}
