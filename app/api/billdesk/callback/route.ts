import { NextRequest, NextResponse } from 'next/server';
import { handleBilldeskPayment, readBilldeskToken } from '@/lib/billdesk-handler';
import { billdeskLog } from '@/lib/billdesk-log';
import { randomUUID } from 'node:crypto';
import { verifyJwsToken, decryptBilldeskTokenNative } from '@/lib/billdesk';
import { createAdminClient } from '@/lib/supabase/admin';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function safeSaveFile(filename: string, content: string) {
  try {
    if (process.env.NODE_ENV === 'development') {
      fs.writeFileSync(path.join(process.cwd(), filename), content, 'utf8');
      const rootPath = path.resolve(process.cwd(), '..', filename);
      try { fs.writeFileSync(rootPath, content, 'utf8'); } catch {}
    }
  } catch {
    // Filesystem may be read-only in production serverless environments (e.g. Vercel)
  }
}

interface BilldeskTransactionData {
  orderid?: unknown;
  auth_status?: unknown;
  transactionid?: unknown;
  amount?: unknown;
  currency?: unknown;
  transaction_date?: unknown;
  transaction_error_desc?: unknown;
  transaction_error_type?: unknown;
  payment_method_type?: unknown;
  bankid?: unknown;
  [key: string]: unknown;
}

function loadLatestTransaction(): Record<string, unknown> | null {
  const candidates = [
    path.resolve(process.cwd(), 'latest-transaction.json'),
    path.resolve(process.cwd(), 'spice-and-soul', 'latest-transaction.json'),
    path.resolve(process.cwd(), '..', 'latest-transaction.json'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    } catch {}
  }
  return null;
}

export function isAuthStatusSuccess(
  authStatus?: string | null,
  statusParam?: string | null,
  errorType?: string | null,
  errorCode?: string | null
): boolean {
  const code = String(authStatus || '').trim();
  const status = String(statusParam || '').trim().toLowerCase();
  const type = String(errorType || '').trim().toLowerCase();
  const errCode = String(errorCode || '').trim().toUpperCase();

  // 1. Strict auth_status check
  // In BillDesk: 0300 = Success, 0399 = Failure
  if (code === '0300') return true;
  if (code === '0399' || code === '0499' || (code && code !== '0300')) return false;

  // 2. Query param status check
  if (status === 'success') return true;
  if (status === 'failure' || status === 'failed') return false;

  // 3. Error code / type check
  if (errCode === 'TRS0000') return true;
  if (type === 'success') return true;
  if (type === 'failed' || type === 'cancelled') return false;

  return false;
}

function formatTransactionDate(dateInput: unknown): string {
  if (dateInput) {
    try {
      const d = new Date(String(dateInput));
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      }
    } catch {
      // ignore
    }
    return String(dateInput);
  }
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const fileData = loadLatestTransaction();

  const rawAuthStatus = String(
    searchParams.get('auth_status') ||
    searchParams.get('authStatus') ||
    fileData?.auth_status ||
    ''
  );

  const rawStatus = String(
    searchParams.get('status') ||
    ''
  );

  const rawErrorType = String(
    fileData?.transaction_error_type ||
    ''
  );

  const rawErrorCode = String(
    fileData?.transaction_error_code ||
    ''
  );

  const isSuccess = isAuthStatusSuccess(rawAuthStatus, rawStatus, rawErrorType, rawErrorCode);

  const orderId = String(
    searchParams.get('orderId') ||
    searchParams.get('orderid') ||
    fileData?.orderid ||
    'BD_PENDING'
  );

  const txnId = String(
    searchParams.get('txnId') ||
    searchParams.get('txnid') ||
    fileData?.transactionid ||
    fileData?.bank_ref_no ||
    (isSuccess ? 'TXN_SUCCESS' : 'FAILED')
  );

  const rawAmount =
    searchParams.get('amount') ||
    fileData?.amount ||
    fileData?.charge_amount ||
    '100.00';
  const amount = String(rawAmount).replace(/^(Rs\.?|₹)\s*/i, '').trim();

  const date = String(
    searchParams.get('date') ||
    formatTransactionDate(fileData?.transaction_date)
  );

  const statusDescription = String(
    searchParams.get('desc') ||
    fileData?.transaction_error_desc ||
    (isSuccess ? 'Transaction Successful' : 'Transaction not authorized')
  );

  // Per BillDesk checklist 8.i: Payment mode must be 'Online payment' (Do not show as Card, Net Banking etc)
  const paymentMode = 'Online payment';

  const purpose = searchParams.get('purpose') || 'Culinary Course / Fee Payment';

  const receiptUrl = new URL('/billdesk/receipt', req.url);
  receiptUrl.searchParams.set('status', isSuccess ? 'success' : 'failure');
  receiptUrl.searchParams.set('auth_status', isSuccess ? '0300' : (rawAuthStatus || '0399'));
  receiptUrl.searchParams.set('orderId', orderId);
  receiptUrl.searchParams.set('txnId', txnId);
  receiptUrl.searchParams.set('amount', amount);
  receiptUrl.searchParams.set('date', date);
  receiptUrl.searchParams.set('desc', statusDescription);
  receiptUrl.searchParams.set('purpose', purpose);
  if (paymentMode) receiptUrl.searchParams.set('mode', paymentMode);

  return NextResponse.redirect(receiptUrl.toString(), { status: 302 });
}

export async function POST(req: NextRequest) {
  const correlation = randomUUID(), started = Date.now();
  let token = '';
  const directFormData: Record<string, string> = {};

  try {
    const clone = req.clone();
    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('form') || contentType.includes('urlencoded')) {
      try {
        const fd = await clone.formData();
        for (const [k, v] of fd.entries()) {
          if (typeof v === 'string') directFormData[k] = v;
        }
      } catch {}
    }
  } catch {}

  try {
    token = await readBilldeskToken(req);
    safeSaveFile('latest-transaction-token.txt', token);
    console.log('✅ BillDesk Callback received token!');
  } catch (err) {
    console.warn('Note on reading BillDesk token:', err);
  }

  // 1. Decrypt and verify the live payload from token
  let transactionData: BilldeskTransactionData | null = null;
  if (token) {
    try {
      const verified = await verifyJwsToken(token);
      transactionData = verified.payload as BilldeskTransactionData;
      console.log('✅ Decrypted via verifyJwsToken:', transactionData.orderid, transactionData.auth_status);
    } catch (vErr) {
      console.warn('verifyJwsToken threw, attempting resilient native decryption:', vErr);
    }

    if (!transactionData) {
      try {
        transactionData = decryptBilldeskTokenNative(token) as BilldeskTransactionData | null;
        if (transactionData) {
          console.log('✅ Decrypted via decryptBilldeskTokenNative:', transactionData.orderid, transactionData.auth_status);
        }
      } catch (nErr) {
        console.warn('Native decrypt fallback failed:', nErr);
      }
    }
  }

  // 2. If token did not provide data, check direct form post fields
  if (!transactionData && Object.keys(directFormData).length > 0) {
    const formAuth = directFormData.auth_status || directFormData.authStatus || directFormData.status;
    const formOrder = directFormData.orderid || directFormData.orderId;
    if (formAuth || formOrder) {
      transactionData = {
        orderid: formOrder,
        auth_status: formAuth,
        transactionid: directFormData.transactionid || directFormData.transactionId || directFormData.bank_ref_no,
        amount: directFormData.amount || directFormData.charge_amount,
        currency: directFormData.currency || '356',
        transaction_date: directFormData.transaction_date,
        transaction_error_desc: directFormData.transaction_error_desc || directFormData.desc,
        transaction_error_type: directFormData.transaction_error_type,
        payment_method_type: directFormData.payment_method_type,
        bankid: directFormData.bankid,
      };
      console.log('✅ Captured transaction data from form submission:', transactionData.orderid, transactionData.auth_status);
    }
  }

  // 3. If still no transactionData, check query params
  if (!transactionData) {
    const searchParams = req.nextUrl.searchParams;
    const qAuthStatus = searchParams.get('auth_status') || searchParams.get('authStatus') || (searchParams.get('status') === 'success' ? '0300' : (searchParams.get('status') === 'failure' ? '0399' : null));
    const qOrderId = searchParams.get('orderId') || searchParams.get('orderid');
    if (qAuthStatus || qOrderId) {
      transactionData = {
        orderid: qOrderId,
        auth_status: qAuthStatus,
        transactionid: searchParams.get('txnId') || searchParams.get('txnid'),
        amount: searchParams.get('amount'),
        transaction_date: searchParams.get('date'),
        transaction_error_desc: searchParams.get('desc'),
        transaction_error_type: qAuthStatus === '0300' ? 'success' : 'failed',
      };
      console.log('✅ Captured transaction data from query params:', transactionData.orderid, transactionData.auth_status);
    }
  }

  // 4. Save to latest-transaction.json if live transaction data exists
  if (transactionData) {
    safeSaveFile('latest-transaction.json', JSON.stringify(transactionData, null, 2));
  } else {
    // Only fallback if no request data whatsoever exists
    transactionData = loadLatestTransaction();
  }

  // 5. Determine Success vs Failure strictly based on auth_status (0300 = Success, 0399 = Failure)
  const rawAuthStatus = String(
    transactionData?.auth_status ||
    directFormData.auth_status ||
    directFormData.authStatus ||
    req.nextUrl.searchParams.get('auth_status') ||
    req.nextUrl.searchParams.get('authStatus') ||
    ''
  ).trim();

  const rawStatus = String(
    req.nextUrl.searchParams.get('status') ||
    directFormData.status ||
    ''
  ).trim().toLowerCase();

  const rawErrorType = String(
    transactionData?.transaction_error_type ||
    directFormData.transaction_error_type ||
    ''
  ).trim().toLowerCase();

  const rawErrorCode = String(
    transactionData?.transaction_error_code ||
    directFormData.transaction_error_code ||
    ''
  ).trim().toUpperCase();

  const isSuccess = isAuthStatusSuccess(rawAuthStatus, rawStatus, rawErrorType, rawErrorCode);

  const orderId = String(
    transactionData?.orderid ||
    directFormData.orderid ||
    directFormData.orderId ||
    req.nextUrl.searchParams.get('orderId') ||
    'BD' + Date.now()
  );

  const txnId = String(
    transactionData?.transactionid ||
    transactionData?.bank_ref_no ||
    directFormData.transactionid ||
    directFormData.bank_ref_no ||
    req.nextUrl.searchParams.get('txnId') ||
    (isSuccess ? 'TXN_' + Date.now() : 'FAILED')
  );

  const rawAmount = String(
    transactionData?.amount ||
    transactionData?.charge_amount ||
    directFormData.amount ||
    req.nextUrl.searchParams.get('amount') ||
    '100.00'
  );
  const amount = rawAmount.replace(/^(Rs\.?|₹)\s*/i, '').trim();

  const formattedDate = formatTransactionDate(
    transactionData?.transaction_date || directFormData.transaction_date || req.nextUrl.searchParams.get('date')
  );

  const statusDescription = String(
    transactionData?.transaction_error_desc ||
    directFormData.transaction_error_desc ||
    directFormData.desc ||
    req.nextUrl.searchParams.get('desc') ||
    (isSuccess ? 'Transaction Successful' : 'Transaction not authorized')
  );

  // Per BillDesk checklist 8.i: Payment mode must be 'Online payment' (Do not show as Card, Net Banking etc)
  const paymentMode = 'Online payment';

  // 6. Look up Course Title from Supabase for accurate purpose
  let purpose = 'Culinary Course / Fee Payment';
  try {
    const supabase = createAdminClient();
    const { data: pending } = await supabase
      .from('pending_orders')
      .select('course_title')
      .eq('order_id', orderId)
      .maybeSingle();

    if (pending?.course_title) {
      purpose = pending.course_title;
    }
  } catch {
    // ignore
  }

  // 7. Database fulfillment in background if payment succeeded
  if (token && isSuccess) {
    try {
      await handleBilldeskPayment(token);
    } catch (e) {
      console.warn('BillDesk DB claim note (can occur in UAT guest tests):', e);
      billdeskLog('callback', 'review', correlation, Date.now() - started);
    }
  }

  // 8. Redirect directly to /billdesk/receipt with all live transaction details
  const receiptUrl = new URL('/billdesk/receipt', req.url);
  receiptUrl.searchParams.set('status', isSuccess ? 'success' : 'failure');
  receiptUrl.searchParams.set('auth_status', isSuccess ? '0300' : (rawAuthStatus || '0399'));
  receiptUrl.searchParams.set('orderId', orderId);
  receiptUrl.searchParams.set('txnId', txnId);
  receiptUrl.searchParams.set('amount', amount);
  if (formattedDate) receiptUrl.searchParams.set('date', formattedDate);
  if (statusDescription) receiptUrl.searchParams.set('desc', statusDescription);
  if (purpose) receiptUrl.searchParams.set('purpose', purpose);
  if (paymentMode) receiptUrl.searchParams.set('mode', paymentMode);

  return NextResponse.redirect(receiptUrl.toString(), { status: 303 });
}


