import React from 'react';
import Link from 'next/link';
import fs from 'node:fs';
import path from 'node:path';

export const metadata = {
  title: 'Payment Acknowledgement — Hakeem Restaurant & Culinary Academy',
};

interface ReceiptSearchParams {
  status?: string;
  auth_status?: string;
  authStatus?: string;
  orderId?: string;
  orderid?: string;
  txnId?: string;
  txnid?: string;
  amount?: string;
  date?: string;
  purpose?: string;
  desc?: string;
  mode?: string;
}

function loadLatestTransaction(): Record<string, any> | null {
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

export default async function BilldeskReceiptPage({
  searchParams,
}: {
  searchParams: Promise<ReceiptSearchParams>;
}) {
  const params = await searchParams;

  const fileData = loadLatestTransaction();

  // Strict auth_status check:
  // "0300" is strictly Success
  // "0399" is strictly Failure
  const rawAuthStatus = String(
    params.auth_status ||
    params.authStatus ||
    fileData?.auth_status ||
    ''
  ).trim();

  const statusParam = String(
    params.status ||
    ''
  ).trim().toLowerCase();

  const errorType = String(
    fileData?.transaction_error_type ||
    ''
  ).trim().toLowerCase();

  let isSuccess = false;
  if (rawAuthStatus === '0300') {
    isSuccess = true;
  } else if (rawAuthStatus === '0399' || rawAuthStatus === '0499' || (rawAuthStatus && rawAuthStatus !== '0300')) {
    isSuccess = false;
  } else if (statusParam === 'success') {
    isSuccess = true;
  } else if (statusParam === 'failure' || statusParam === 'failed') {
    isSuccess = false;
  } else if (errorType === 'success') {
    isSuccess = true;
  }

  const orderId =
    params.orderId ||
    params.orderid ||
    fileData?.orderid ||
    'BD_' + Date.now();

  const txnId =
    params.txnId ||
    params.txnid ||
    fileData?.transactionid ||
    fileData?.bank_ref_no ||
    (isSuccess ? 'TXN_' + Date.now() : 'FAILED');

  const rawAmount =
    params.amount ||
    fileData?.amount ||
    fileData?.charge_amount ||
    '100.00';
  const amount = String(rawAmount).replace(/^(Rs\.?|₹)\s*/i, '').trim();

  let dateStr = params.date;
  if (!dateStr) {
    if (fileData?.transaction_date) {
      try {
        const d = new Date(fileData.transaction_date);
        const pad = (n: number) => String(n).padStart(2, '0');
        dateStr = `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      } catch {
        dateStr = String(fileData.transaction_date);
      }
    } else {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      dateStr = `${pad(now.getMonth() + 1)}/${pad(now.getDate())}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    }
  }

  let paymentMode = params.mode || 'Online payment';
  if (!params.mode && fileData?.payment_method_type) {
    const method = String(fileData.payment_method_type).toUpperCase();
    const bank = fileData.bankid ? ` - ${fileData.bankid}` : '';
    paymentMode = `Online payment (${method}${bank})`;
  }

  const purpose = params.purpose || 'Culinary Course / Fee Payment';
  const statusDesc =
    params.desc ||
    fileData?.transaction_error_desc ||
    (isSuccess ? 'Transaction Successful' : 'Transaction not authorized');

  return (
    <div
      style={{
        fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
        backgroundColor: '#f1f5f9',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '30px 16px',
        color: '#111827',
      }}
    >
      {/* Receipt Card Container */}
      <div
        className="receipt-card"
        style={{
          background: '#ffffff',
          width: '100%',
          maxWidth: '520px',
          border: '1px solid #d1d5db',
          padding: '24px 28px 32px 28px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
          borderRadius: '4px',
        }}
      >
        {/* Header with Crest Logo & Institution Details */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            paddingBottom: '18px',
            borderBottom: '1px solid #e5e7eb',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              width: '66px',
              height: '66px',
              flexShrink: 0,
              borderRadius: '50%',
              background: '#78350f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
              border: '2px solid #b45309',
            }}
          >
            <svg viewBox="0 0 100 100" fill="none" style={{ width: '42px', height: '42px' }} xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="44" stroke="#fef3c7" strokeWidth="2" />
              <path d="M50 20 L58 36 L76 39 L63 52 L66 70 L50 61 L34 70 L37 52 L24 39 L42 36 Z" fill="#f59e0b" />
              <text x="50" y="58" textAnchor="middle" fontFamily="Georgia, serif" fontSize="20" fontWeight="bold" fill="#ffffff">
                H
              </text>
            </svg>
          </div>
          <div style={{ flex: 1, lineHeight: 1.35 }}>
            <div style={{ color: '#b91c1c', fontSize: '15px', fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase', marginBottom: '3px' }}>
              HAKEEM RESTAURANT &amp; CULINARY ACADEMY
            </div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e293b', marginBottom: '2px' }}>
              SPICE &amp; SOUL ACADEMY (A UNIT OF N K VENTURES)
            </div>
            <div style={{ fontSize: '10.5px', color: '#475569', marginBottom: '2px' }}>
              E-6, Arera Colony, Bittan Market, Bhopal, Madhya Pradesh - 462016
            </div>
            <div style={{ fontSize: '10px', color: '#0284c7', wordBreak: 'break-all' }}>
              E-Mail: contact@hakeemrestro.shop | Ph: +91 755 427 1234 (www.hakeemrestro.shop)
            </div>
          </div>
        </div>

        {/* Status Section with Icon and Text */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
            {isSuccess ? (
              <svg width="62" height="62" viewBox="0 0 24 24" fill="#16a34a" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" />
              </svg>
            ) : (
              <svg width="62" height="62" viewBox="0 0 24 24" fill="#dc2626" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.58-6.59c.37-.36.59-.86.59-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" />
              </svg>
            )}
          </div>
          <div
            style={{
              color: isSuccess ? '#16a34a' : '#dc2626',
              fontSize: '24px',
              fontWeight: 700,
              marginBottom: '18px',
            }}
          >
            {isSuccess ? 'Your transaction is success' : 'Your transaction is failed'}
          </div>
        </div>

        {/* Details Heading */}
        <div style={{ color: '#111827', fontSize: '22px', fontWeight: 700, textAlign: 'center', marginBottom: '14px' }}>
          Details
        </div>
        <hr style={{ border: 'none', borderTop: '1px solid #d1d5db', margin: '0 0 22px 0' }} />

        {/* Details Key-Value Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15.5px' }}>
          <tbody>
            {!isSuccess && (
              <tr>
                <td style={{ padding: '10px 0', width: '48%', color: '#111827', fontWeight: 400, verticalAlign: 'top' }}>
                  Status Description
                </td>
                <td style={{ padding: '10px 0', width: '52%', color: '#111827', fontWeight: 400, verticalAlign: 'top' }}>
                  {statusDesc}
                </td>
              </tr>
            )}
            <tr>
              <td style={{ padding: '10px 0', width: '48%', color: '#111827', fontWeight: 400, verticalAlign: 'top' }}>
                Purpose of payment
              </td>
              <td style={{ padding: '10px 0', width: '52%', color: '#111827', fontWeight: 400, verticalAlign: 'top' }}>
                {purpose}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '10px 0', color: '#111827', fontWeight: 400, verticalAlign: 'top' }}>
                Payment mode
              </td>
              <td style={{ padding: '10px 0', color: '#111827', fontWeight: 400, verticalAlign: 'top' }}>
                {paymentMode}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '10px 0', color: '#111827', fontWeight: 400, verticalAlign: 'top' }}>
                Amount
              </td>
              <td style={{ padding: '10px 0', color: '#111827', fontWeight: 400, verticalAlign: 'top' }}>
                Rs. {amount}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '10px 0', color: '#111827', fontWeight: 400, verticalAlign: 'top' }}>
                Date
              </td>
              <td style={{ padding: '10px 0', color: '#111827', fontWeight: 400, verticalAlign: 'top' }}>
                {dateStr}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '10px 0', color: '#111827', fontWeight: 400, verticalAlign: 'top' }}>
                Transaction Id
              </td>
              <td style={{ padding: '10px 0', color: '#111827', fontWeight: 400, verticalAlign: 'top', fontFamily: 'monospace', fontSize: '14px' }}>
                {txnId}
              </td>
            </tr>
            <tr>
              <td style={{ padding: '10px 0', color: '#111827', fontWeight: 400, verticalAlign: 'top' }}>
                Order Id
              </td>
              <td style={{ padding: '10px 0', color: '#111827', fontWeight: 400, verticalAlign: 'top', fontFamily: 'monospace', fontSize: '14px' }}>
                {orderId}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Action Buttons */}
      <div
        className="print:hidden"
        style={{
          marginTop: '24px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          justifyContent: 'center',
        }}
      >
        <Link
          href="/courses"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '9px 18px',
            fontSize: '14px',
            fontWeight: 600,
            borderRadius: '6px',
            textDecoration: 'none',
            backgroundColor: '#ffffff',
            color: '#374151',
            border: '1px solid #d1d5db',
          }}
        >
          Return to Courses
        </Link>
        {isSuccess ? (
          <Link
            href="/thank-you"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '9px 18px',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '6px',
              textDecoration: 'none',
              backgroundColor: '#16a34a',
              color: '#ffffff',
              border: '1px solid transparent',
            }}
          >
            Go to My Enrollments
          </Link>
        ) : (
          <Link
            href="/checkout?courseId=e91b8a1a-be8e-47da-ab7d-8b3c1e72b203"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '9px 18px',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '6px',
              textDecoration: 'none',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: '1px solid transparent',
            }}
          >
            Try Payment Again
          </Link>
        )}
      </div>
    </div>
  );
}
