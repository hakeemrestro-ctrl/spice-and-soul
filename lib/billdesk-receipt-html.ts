export interface ReceiptRenderOptions {
  isSuccess: boolean;
  purpose?: string;
  paymentMode?: string;
  amount: string;
  date: string;
  txnId: string;
  orderId: string;
  statusDescription?: string;
  returnUrl?: string;
}

export function generateReceiptHtml(options: ReceiptRenderOptions): string {
  const {
    isSuccess,
    purpose = 'Fee Payment',
    paymentMode = 'Online payment',
    amount,
    date,
    txnId,
    orderId,
    statusDescription = 'Transaction not authorized',
    returnUrl = '/courses',
  } = options;

  // Clean amount: if already has Rs., strip to keep uniform
  const cleanAmount = String(amount).replace(/^(Rs\.?|₹)\s*/i, '').trim();

  const statusColor = isSuccess ? '#16a34a' : '#dc2626';
  const statusText = isSuccess ? 'Your transaction is success' : 'Your transaction is failed';

  const iconSvg = isSuccess
    ? `<svg width="62" height="62" viewBox="0 0 24 24" fill="#16a34a" xmlns="http://www.w3.org/2000/svg">
         <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
       </svg>`
    : `<svg width="62" height="62" viewBox="0 0 24 24" fill="#dc2626" xmlns="http://www.w3.org/2000/svg">
         <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.58-6.59c.37-.36.59-.86.59-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/>
       </svg>`;

  let rowsHtml = '';
  if (!isSuccess) {
    rowsHtml += `
      <tr>
        <td class="label-col">Status Description</td>
        <td class="value-col">${statusDescription}</td>
      </tr>`;
  }

  rowsHtml += `
      <tr>
        <td class="label-col">Purpose of payment</td>
        <td class="value-col">${purpose}</td>
      </tr>
      <tr>
        <td class="label-col">Payment mode</td>
        <td class="value-col">${paymentMode}</td>
      </tr>
      <tr>
        <td class="label-col">Amount</td>
        <td class="value-col">Rs. ${cleanAmount}</td>
      </tr>
      <tr>
        <td class="label-col">Date</td>
        <td class="value-col">${date}</td>
      </tr>
      <tr>
        <td class="label-col">Transaction Id</td>
        <td class="value-col" style="font-family: monospace; font-size: 14px;">${txnId}</td>
      </tr>
      <tr>
        <td class="label-col">Order Id</td>
        <td class="value-col" style="font-family: monospace; font-size: 14px;">${orderId}</td>
      </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Acknowledgement — ${orderId}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
      background-color: #f1f5f9;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 30px 16px;
      color: #111827;
    }
    .receipt-card {
      background: #ffffff;
      width: 100%;
      max-width: 520px;
      border: 1px solid #d1d5db;
      padding: 24px 28px 32px 28px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
      border-radius: 4px;
    }
    .header-section {
      display: flex;
      align-items: center;
      gap: 16px;
      padding-bottom: 18px;
      border-bottom: 1px solid #e5e7eb;
      margin-bottom: 24px;
    }
    .crest-logo {
      width: 66px;
      height: 66px;
      flex-shrink: 0;
      border-radius: 50%;
      background: #78350f;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.12);
      border: 2px solid #b45309;
    }
    .crest-logo svg {
      width: 42px;
      height: 42px;
    }
    .header-text {
      flex: 1;
      line-height: 1.35;
    }
    .org-title {
      color: #b91c1c;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .org-subtitle {
      font-size: 11px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 2px;
    }
    .org-address {
      font-size: 10.5px;
      color: #475569;
      margin-bottom: 2px;
    }
    .org-contact {
      font-size: 10px;
      color: #0284c7;
      word-break: break-all;
    }
    .status-section {
      text-align: center;
      margin-bottom: 20px;
    }
    .status-icon-wrapper {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 10px;
    }
    .status-heading {
      color: ${statusColor};
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 18px;
    }
    .details-heading {
      color: #111827;
      font-size: 22px;
      font-weight: 700;
      text-align: center;
      margin-bottom: 14px;
    }
    .divider {
      border: none;
      border-top: 1px solid #d1d5db;
      margin: 0 0 22px 0;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 15.5px;
    }
    .label-col {
      padding: 10px 0;
      width: 48%;
      color: #111827;
      font-weight: 400;
      vertical-align: top;
    }
    .value-col {
      padding: 10px 0;
      width: 52%;
      color: #111827;
      font-weight: 400;
      vertical-align: top;
    }
    .actions {
      margin-top: 24px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      justify-content: center;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 9px 18px;
      font-size: 14px;
      font-weight: 600;
      border-radius: 6px;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.15s ease-in-out;
      border: 1px solid transparent;
    }
    .btn-secondary {
      background-color: #ffffff;
      color: #374151;
      border-color: #d1d5db;
    }
    .btn-secondary:hover {
      background-color: #f3f4f6;
    }
    .btn-primary {
      background-color: #16a34a;
      color: #ffffff;
    }
    .btn-primary:hover {
      background-color: #15803d;
    }
    .btn-danger {
      background-color: #dc2626;
      color: #ffffff;
    }
    .btn-danger:hover {
      background-color: #b91c1c;
    }
    @media print {
      body {
        background-color: #ffffff;
        padding: 0;
      }
      .receipt-card {
        border: none;
        box-shadow: none;
        max-width: 100%;
      }
      .actions {
        display: none !important;
      }
    }
  </style>
</head>
<body>

  <div class="receipt-card">
    <!-- Header with Crest Logo & Institution Details -->
    <div class="header-section">
      <div class="crest-logo">
        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="44" stroke="#fef3c7" stroke-width="2"/>
          <path d="M50 20 L58 36 L76 39 L63 52 L66 70 L50 61 L34 70 L37 52 L24 39 L42 36 Z" fill="#f59e0b"/>
          <text x="50" y="58" text-anchor="middle" font-family="Georgia, serif" font-size="20" font-weight="bold" fill="#ffffff">H</text>
        </svg>
      </div>
      <div class="header-text">
        <div class="org-title">HAKEEM RESTAURANT &amp; CULINARY ACADEMY</div>
        <div class="org-subtitle">SPICE &amp; SOUL ACADEMY (A UNIT OF N K VENTURES)</div>
        <div class="org-address">E-6, Arera Colony, Bittan Market, Bhopal, Madhya Pradesh - 462016</div>
        <div class="org-contact">E-Mail: contact@hakeemrestro.shop | Ph: +91 755 427 1234 (www.hakeemrestro.shop)</div>
      </div>
    </div>

    <!-- Status Section with Icon and Exact Text -->
    <div class="status-section">
      <div class="status-icon-wrapper">
        ${iconSvg}
      </div>
      <div class="status-heading">${statusText}</div>
    </div>

    <!-- Details Section -->
    <div class="details-heading">Details</div>
    <hr class="divider">

    <table class="details-table">
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  </div>

  <div class="actions">
    <button onclick="window.print()" class="btn btn-secondary">Print Receipt</button>
    ${
      isSuccess
        ? `<a href="${returnUrl}" class="btn btn-primary">Return to Courses</a>`
        : `<a href="/courses" class="btn btn-danger">Try Payment Again</a>`
    }
  </div>

</body>
</html>`;
}
