import fs from "node:fs";
import path from "node:path";

// Load latest transaction data
const txnFilePath = path.resolve(process.cwd(), "latest-transaction.json");
if (!fs.existsSync(txnFilePath)) {
  console.error("latest-transaction.json not found! Run 'node scripts/decrypt-token.mjs' first.");
  process.exit(1);
}

const txn = JSON.parse(fs.readFileSync(txnFilePath, "utf8"));

if (txn.auth_status !== "0300") {
  console.warn(`⚠️ Warning: Transaction auth_status is '${txn.auth_status}', not '0300' (Success).`);
}

const invoiceNumber = `INV-${new Date().getFullYear()}-${(txn.transactionid || "TXN").slice(0, 12).toUpperCase()}`;
const formattedDate = new Date(txn.transaction_date || Date.now()).toLocaleString("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata"
});

const amountFormatted = Number(txn.amount || txn.charge_amount || 0).toLocaleString("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt — ${invoiceNumber}</title>
  <style>
    :root {
      --primary: #d97706;
      --success: #16a34a;
      --bg: #0f172a;
      --card-bg: #1e293b;
      --border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 2rem 1rem;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      box-sizing: border-box;
    }
    .receipt {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 1.25rem;
      max-width: 580px;
      width: 100%;
      padding: 2.5rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .header {
      text-align: center;
      padding-bottom: 1.5rem;
      border-bottom: 1px dashed var(--border);
    }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(22, 163, 74, 0.15);
      color: #4ade80;
      border: 1px solid rgba(74, 222, 128, 0.3);
      padding: 0.35rem 1rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 700;
      margin-bottom: 1rem;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      background: #4ade80;
      border-radius: 50%;
    }
    .logo {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--primary);
      margin: 0 0 0.25rem 0;
    }
    .sublogo {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin: 0;
    }
    .amount-box {
      text-align: center;
      padding: 1.75rem 0;
      border-bottom: 1px dashed var(--border);
    }
    .amount-label {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }
    .amount-val {
      font-size: 2.5rem;
      font-weight: 800;
      color: #38bdf8;
      margin-top: 0.25rem;
    }
    .details {
      padding: 1.5rem 0;
      display: grid;
      gap: 0.85rem;
      border-bottom: 1px solid var(--border);
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.95rem;
    }
    .label {
      color: var(--text-muted);
    }
    .val {
      font-weight: 600;
      color: var(--text);
      font-family: monospace;
    }
    .actions {
      display: flex;
      gap: 1rem;
      margin-top: 2rem;
    }
    button {
      flex: 1;
      padding: 0.85rem;
      border-radius: 0.5rem;
      font-weight: 700;
      font-size: 1rem;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-print {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      border: none;
      color: #0f172a;
    }
    .btn-print:hover {
      opacity: 0.95;
      transform: translateY(-1px);
    }
    .btn-back {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-muted);
    }
    .btn-back:hover {
      color: var(--text);
      border-color: var(--text-muted);
    }
    @media print {
      body { background: white; color: black; }
      .receipt { box-shadow: none; border: 1px solid #ddd; background: white; }
      .actions { display: none; }
      .amount-val { color: #0284c7; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="status-badge">
        <span class="status-dot"></span>
        PAYMENT SUCCESSFUL (0300)
      </div>
      <h1 class="logo">Spice & Soul Academy</h1>
      <p class="sublogo">by Hakeem Restaurant · Bhopal</p>
    </div>

    <div class="amount-box">
      <div class="amount-label">Amount Paid</div>
      <div class="amount-val">₹${amountFormatted}</div>
    </div>

    <div class="details">
      <div class="row">
        <span class="label">Invoice Number</span>
        <span class="val">${invoiceNumber}</span>
      </div>
      <div class="row">
        <span class="label">BillDesk Transaction ID</span>
        <span class="val">${txn.transactionid || "N/A"}</span>
      </div>
      <div class="row">
        <span class="label">Our Order ID</span>
        <span class="val">${txn.orderid || "N/A"}</span>
      </div>
      <div class="row">
        <span class="label">Bank Reference No</span>
        <span class="val">${txn.bank_ref_no || "N/A"}</span>
      </div>
      <div class="row">
        <span class="label">Bank / Method</span>
        <span class="val">${(txn.bankid || "").toUpperCase()} (${(txn.payment_method_type || "ONLINE").toUpperCase()})</span>
      </div>
      <div class="row">
        <span class="label">Transaction Date</span>
        <span class="val" style="font-family: inherit;">${formattedDate}</span>
      </div>
      <div class="row">
        <span class="label">Merchant ID</span>
        <span class="val">${txn.mercid || "BDUATV2KRL"}</span>
      </div>
      <div class="row">
        <span class="label">Status</span>
        <span class="val" style="color: #4ade80;">PAID &amp; CONFIRMED</span>
      </div>
    </div>

    <div class="actions">
      <button class="btn-print" onclick="window.print()">🖨️ Print / Download Receipt</button>
      <button class="btn-back" onclick="window.location.href='/courses'">← Back to Academy</button>
    </div>
  </div>
</body>
</html>`;

const outHtml = path.resolve(process.cwd(), "billdesk-receipt.html");
fs.writeFileSync(outHtml, htmlContent, "utf8");
console.log(`\n================================================================================`);
console.log(`                 🎉 CUSTOMER SUCCESS RECEIPT GENERATED                         `);
console.log(`================================================================================`);
console.log(`Invoice Number        : ${invoiceNumber}`);
console.log(`BillDesk Txn ID       : ${txn.transactionid}`);
console.log(`Amount Paid           : INR ${amountFormatted}`);
console.log(`Bank / Method         : ${txn.bankid} (${txn.payment_method_type})`);
console.log(`Status                : ${txn.auth_status} (${txn.transaction_error_desc})`);
console.log(`Receipt HTML File     : ${outHtml}`);
console.log(`================================================================================\n`);
console.log(`👉 Open 'billdesk-receipt.html' in your browser to view or print the official customer receipt!`);
