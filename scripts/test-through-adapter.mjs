import https from "node:https";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function base64url(buf) { return Buffer.from(buf).toString("base64url"); }
function base64urlDecode(str) { return Buffer.from(str, "base64url").toString("utf8"); }

// Load .env.local
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const MERCID = process.env.BILLDESK_MERCID || "BDUATV2KRL";
const CLIENT_ID = process.env.BILLDESK_CLIENT_ID || "bduatv2krlsj";
const KEY_ID = process.env.BILLDESK_KEY_ID || "0SCWAdFuBgLv";
const JWE_PASSWORD = process.env.BILLDESK_JWE_PASSWORD || "TMtsOBn6bXkSXAxE0XBCCiVfUydaRwLf";
const JWS_PASSWORD = process.env.BILLDESK_JWS_PASSWORD || "vna166vLuTwyof7e3xIzHXkuALKLX70s";

const encKey = Buffer.from(JWE_PASSWORD, "utf8");
const signKey = Buffer.from(JWS_PASSWORD, "utf8");

const now = new Date();
const offsetMs = 5.5 * 60 * 60 * 1000;
const istDate = new Date(now.getTime() + offsetMs);
const orderDate = istDate.toISOString().slice(0, 19) + "+05:30";
const orderId = `BD_${Date.now()}`;

const jsonRequest = {
  mercid: MERCID,
  orderid: orderId,
  amount: "100.00",
  order_date: orderDate,
  currency: "356",
  ru: "https://spiceandsoul.com/api/billdesk/callback",
  itemcode: "DIRECT",
  device: {
    init_channel: "internet",
    ip: "103.211.54.10",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
  }
};

// 1. JWE Encryption
const jweHeaderJson = JSON.stringify({ alg: "dir", enc: "A256GCM", kid: KEY_ID, clientid: CLIENT_ID });
const jweHeaderB64 = base64url(Buffer.from(jweHeaderJson, "utf8"));
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv("aes-256-gcm", encKey, iv);
cipher.setAAD(Buffer.from(jweHeaderB64, "ascii"));
const ciphertext = Buffer.concat([cipher.update(JSON.stringify(jsonRequest), "utf8"), cipher.final()]);
const tag = cipher.getAuthTag();
const jwe = `${jweHeaderB64}..${base64url(iv)}.${base64url(ciphertext)}.${base64url(tag)}`;

// 2. JWS Signature
const jwsHeaderJson = JSON.stringify({ alg: "HS256", kid: KEY_ID, clientid: CLIENT_ID });
const jwsHeaderB64 = base64url(Buffer.from(jwsHeaderJson, "utf8"));
const jwsPayloadB64 = base64url(Buffer.from(jwe, "utf8"));
const signInput = `${jwsHeaderB64}.${jwsPayloadB64}`;
const hmac = crypto.createHmac("sha256", signKey).update(signInput).digest();
const jws = `${signInput}.${base64url(hmac)}`;

const traceId = `BD${crypto.randomUUID().replaceAll("-", "")}`;
const timestamp = istDate.toISOString().replace(/[-:T]/g, "").slice(0, 14);

console.log("================================================================================");
console.log("    BILLDESK V2 LIVE TEST VIA WHITELISTED ADAPTER (64.225.85.27)                ");
console.log("================================================================================\n");

console.log("----------------------- OUTGOING PAYLOAD TO BILLDESK ---------------------------");
console.log("1. JSON Request:");
console.log(JSON.stringify(jsonRequest, null, 2));

console.log("\n2. Encrypted Request (JWE):");
console.log(jwe);

console.log("\n3. Signed Request (JWS):");
console.log(jws);

console.log("\n4. BD-traceID and BD-timestamp:");
console.log(`BD-Traceid: ${traceId}`);
console.log(`BD-Timestamp: ${timestamp}`);
console.log("--------------------------------------------------------------------------------\n");

console.log(`Forwarding via Whitelisted Server : 64.225.85.27 (https://adapter.hakeemrestro.shop)`);

const adapterKey = process.env.BILLDESK_ADAPTER_AUTH_KEY_ID || "uat-adapter-key-1";
const adapterSecret = process.env.BILLDESK_ADAPTER_AUTH_SECRET || "5b10aeae8718464ed1e2f60de8685eb3638bd34f124c94e72f699268d241f5f5";
const adapterPath = "/uat/orders/create";

const envelopeData = {
  operationId: orderId.replaceAll("_", "-"),
  traceId,
  timestamp,
  jose: jws
};

const body = Buffer.from(JSON.stringify(envelopeData));
const digest = crypto.createHash("sha256").update(body).digest("hex");
const nowSec = String(Math.floor(Date.now() / 1000));
const nonce = crypto.randomUUID();
const canonical = ["v1", adapterKey, "POST", adapterPath, nowSec, nonce, digest].join("\n");
const sig = crypto.createHmac("sha256", adapterSecret).update(canonical).digest("hex");

const options = {
  hostname: "adapter.hakeemrestro.shop",
  port: 443,
  path: adapterPath,
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-adapter-version": "1",
    "x-adapter-key-id": adapterKey,
    "x-adapter-timestamp": nowSec,
    "x-adapter-nonce": nonce,
    "x-adapter-signature": sig,
    "Content-Length": body.length
  },
  timeout: 25000
};

const req = https.request(options, (res) => {
  console.log(`\nHTTP Status  : ${res.statusCode} ${res.statusMessage}`);
  console.log(`Content-Type : ${res.headers["content-type"]}`);

  let respBody = "";
  res.on("data", (chunk) => { respBody += chunk; });
  res.on("end", () => {
    console.log("\n------------------------- BILLDESK RESPONSE (JWS TOKEN) ------------------------");
    console.log(respBody.slice(0, 120) + "...\n");

    // Decrypt response
    try {
      const [jwsHdrB64, jwsPayloadB64] = respBody.split(".");
      const jweStr = Buffer.from(jwsPayloadB64, "base64url").toString("utf8");
      const [jweHdrB64, , ivB64, cipherB64, tagB64] = jweStr.split(".");

      const decipher = crypto.createDecipheriv("aes-256-gcm", encKey, Buffer.from(ivB64, "base64url"));
      decipher.setAAD(Buffer.from(jweHdrB64, "ascii"));
      decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
      const decrypted = Buffer.concat([decipher.update(Buffer.from(cipherB64, "base64url")), decipher.final()]);
      const order = JSON.parse(decrypted.toString("utf8"));

      console.log("================================================================================");
      console.log("            🎉 DECRYPTED LIVE BILLDESK ORDER RESPONSE (SUCCESS)                 ");
      console.log("================================================================================");
      console.log(`BillDesk Order ID (bdorderid) : ${order.bdorderid}`);
      console.log(`Our Order ID                  : ${order.orderid}`);
      console.log(`Merchant ID                   : ${order.mercid}`);
      console.log(`Order Status                  : ${order.status} (READY FOR PAYMENT)`);
      console.log(`Amount                        : INR ${order.amount}`);
      console.log(`Currency                      : ${order.currency}`);
      console.log(`Hosted Payment URL            : ${order.links?.[1]?.href || order.links?.[0]?.href}`);
      console.log("\nBillDesk Order Links received:");
      console.log(JSON.stringify(order.links, null, 2));

      // Create an instant HTML launcher for the SDK/Checkout
      const redirectLink = order.links?.find(l => l.rel === "redirect") || order.links?.[0];
      if (redirectLink) {
        const formInputs = Object.entries(redirectLink.parameters || {})
          .map(([k, v]) => `    <input type="hidden" name="${k}" value="${v}">`)
          .join("\n");

        const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>BillDesk Embedded SDK v2 Launcher</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #090d16; color: #f1f5f9; margin: 0; padding: 1.5rem; }
    .card { background: #131b2e; padding: 2.25rem; border-radius: 1.25rem; border: 1px solid #1e293b; max-width: 520px; width: 100%; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6); }
    .badge { display: inline-block; padding: 0.3rem 0.75rem; background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.4); color: #4ade80; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; margin-bottom: 1rem; }
    h2 { margin: 0 0 1.25rem 0; color: #fbbf24; font-size: 1.5rem; }
    .grid { display: grid; gap: 0.75rem; background: #0d1322; padding: 1.25rem; border-radius: 0.75rem; border: 1px solid #1e293b; margin-bottom: 1.5rem; }
    .row { display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; }
    .label { color: #94a3b8; }
    .val { font-weight: 600; color: #38bdf8; font-family: monospace; word-break: break-all; }
    button { width: 100%; padding: 1.1rem; background: linear-gradient(135deg, #f59e0b, #d97706); border: none; border-radius: 0.75rem; font-size: 1.15rem; font-weight: 700; color: #0f172a; cursor: pointer; box-shadow: 0 10px 25px rgba(245, 158, 11, 0.35); transition: all 0.15s ease-in-out; }
    button:hover { transform: translateY(-2px); box-shadow: 0 15px 30px rgba(245, 158, 11, 0.5); }
    .footer-text { text-align: center; font-size: 0.8rem; color: #64748b; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">● LIVE UAT ORDER ACTIVE (Expires in 30 mins)</div>
    <h2>🚀 BillDesk Embedded SDK v2</h2>
    
    <div class="grid">
      <div class="row">
        <span class="label">Merchant ID</span>
        <span class="val">${order.mercid}</span>
      </div>
      <div class="row">
        <span class="label">Order ID</span>
        <span class="val">${order.orderid}</span>
      </div>
      <div class="row">
        <span class="label">Amount</span>
        <span class="val" style="color: #4ade80;">INR ${order.amount}</span>
      </div>
      <div class="row">
        <span class="label">BillDesk Order ID</span>
        <span class="val">${order.bdorderid}</span>
      </div>
    </div>

    <form method="${redirectLink.method || 'POST'}" action="${redirectLink.href}">
${formInputs}
      <button type="submit">⚡ Launch BillDesk Payment Gateway →</button>
    </form>

    <div class="footer-text">
      Clicking the button will open BillDesk's official payment page (Cards, NetBanking, UPI).
    </div>
  </div>
</body>
</html>`;

        const p1 = path.resolve(process.cwd(), "billdesk-checkout.html");
        const p2 = path.resolve(process.cwd(), "..", "billdesk-checkout.html");
        fs.writeFileSync(p1, htmlContent, "utf8");
        try { fs.writeFileSync(p2, htmlContent, "utf8"); } catch {}
        console.log(`\n✅ Generated Active Checkout Launcher: ${p1}`);
        console.log(`👉 Open 'billdesk-checkout.html' in your browser to launch BillDesk SDK / Payment screen!`);
      }
      console.log("================================================================================\n");
    } catch (e) {
      console.log("Raw Response:", respBody);
    }
  });
});

req.on("error", (e) => {
  console.error(`Error: ${e.message}`);
});

req.write(body);
req.end();
