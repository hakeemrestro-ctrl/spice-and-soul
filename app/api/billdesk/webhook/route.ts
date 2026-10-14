import { NextRequest, NextResponse } from 'next/server';
import { handleBilldeskPayment, readBilldeskToken } from '@/lib/billdesk-handler';
import { billdeskLog } from '@/lib/billdesk-log';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const correlation = randomUUID(), started = Date.now();
  let token: string;
  try { token = await readBilldeskToken(req); }
  catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  try {
    const result = await handleBilldeskPayment(token);
    if (result.status === 'review') return NextResponse.json({ error: 'Reconciliation required' }, { status: 503 });
    return new NextResponse('OK', { status: 200 });
  } catch {
    billdeskLog('webhook','review',correlation,Date.now()-started);
    return NextResponse.json({ error: 'Unable to process notification' }, { status: 503 });
  }
}
