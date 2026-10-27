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

const MERCID = process.env.BILLDESK_MERCID || "BDUATK1001";
const CLIENT_ID = process.env.BILLDESK_CLIENT_ID || "bduatk1001sj";
const KEY_ID = process.env.BILLDESK_KEY_ID || "c7bLflH4TdOM";
const JWE_PASSWORD = process.env.BILLDESK_JWE_PASSWORD || "o5K8s50sl6cN1JoQu7gnSKZ5FdezZB4F";
const JWS_PASSWORD = process.env.BILLDESK_JWS_PASSWORD || "V1P1iyaGqGkoLEE5lScd217o8GvqvMVs";

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

// JWE
const jweHeaderJson = JSON.stringify({ alg: "dir", enc: "A256GCM", kid: KEY_ID, clientid: CLIENT_ID });
const jweHeaderB64 = base64url(Buffer.from(jweHeaderJson, "utf8"));
const iv = crypto.randomBytes(12);
const cipher = crypto.createCipheriv("aes-256-gcm", encKey, iv);
cipher.setAAD(Buffer.from(jweHeaderB64, "ascii"));
const ciphertext = Buffer.concat([cipher.update(JSON.stringify(jsonRequest), "utf8"), cipher.final()]);
const tag = cipher.getAuthTag();
const jwe = `${jweHeaderB64}..${base64url(iv)}.${base64url(ciphertext)}.${base64url(tag)}`;

// JWS
const jwsHeaderJson = JSON.stringify({ alg: "HS256", kid: KEY_ID, clientid: CLIENT_ID });
const jwsHeaderB64 = base64url(Buffer.from(jwsHeaderJson, "utf8"));
const jwsPayloadB64 = base64url(Buffer.from(jwe, "utf8"));
const signInput = `${jwsHeaderB64}.${jwsPayloadB64}`;
const hmac = crypto.createHmac("sha256", signKey).update(signInput).digest();
const jws = `${signInput}.${base64url(hmac)}`;

const traceId = `BD${crypto.randomUUID().replaceAll("-", "")}`;
const timestamp = istDate.toISOString().replace(/[-:T]/g, "").slice(0, 14);

console.log("================================================================================");
console.log("             TESTING LIVE BILLDESK UAT ENDPOINT DIRECTLY                        ");
console.log("================================================================================\n");

console.log("--------------------------------------------------------------------------------");
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

console.log(`Sending to BillDesk UAT Server: https://uat1.billdesk.com/u2/payments/ve1_2/orders/create ...\n`);

const postData = jws;

const options = {
  hostname: "uat1.billdesk.com",
  port: 443,
  path: "/u2/payments/ve1_2/orders/create",
  method: "POST",
  headers: {
    "Content-Type": "application/jose",
    "Accept": "application/jose",
    "BD-Traceid": traceId,
    "BD-Timestamp": timestamp,
    "Content-Length": Buffer.byteLength(postData)
  },
  timeout: 10000
};

const req = https.request(options, (res) => {
  console.log(`HTTP Status  : ${res.statusCode} ${res.statusMessage}`);
  console.log(`Content-Type : ${res.headers["content-type"]}`);
  console.log(`BD-Traceid   : ${res.headers["bd-traceid"] || res.headers["bd-traceid"] || "None returned"}`);

  let body = "";
  res.on("data", (chunk) => { body += chunk; });
  res.on("end", () => {
    console.log("\nResponse Body received:");
    console.log("--------------------------------------------------------------------------------");
    console.log(body);
    console.log("--------------------------------------------------------------------------------");

    // Try to parse if it's a JWS token response
    if (body.split(".").length === 3) {
      try {
        const [respJwsHdrB64, respJwsPayloadB64] = body.split(".");
        console.log("\nDecoded JWS Header:", base64urlDecode(respJwsHdrB64));
        const respJweStr = Buffer.from(respJwsPayloadB64, "base64url").toString("utf8");
        const [respJweHdrB64, , respIvB64, respCipherB64, respTagB64] = respJweStr.split(".");
        console.log("Decoded JWE Header:", base64urlDecode(respJweHdrB64));

        // Decrypt
        const decipher = crypto.createDecipheriv("aes-256-gcm", encKey, Buffer.from(respIvB64, "base64url"));
        decipher.setAAD(Buffer.from(respJweHdrB64, "ascii"));
        decipher.setAuthTag(Buffer.from(respTagB64, "base64url"));
        const decrypted = Buffer.concat([decipher.update(Buffer.from(respCipherB64, "base64url")), decipher.final()]);
        console.log("\nDecrypted Server Response JSON:");
        console.log(JSON.stringify(JSON.parse(decrypted.toString("utf8")), null, 2));
      } catch (e) {
        console.log("\nNote on token decryption:", e.message);
      }
    } else {
      try {
        console.log("\nParsed JSON:", JSON.stringify(JSON.parse(body), null, 2));
      } catch { }
    }

    // Display current IP for whitelisting
    https.get("https://api.ipify.org", (ipRes) => {
      let ip = "";
      ipRes.on("data", (c) => ip += c);
      ipRes.on("end", () => {
        console.log("\n================================================================================");
        console.log(`CURRENT CALLING IP: ${ip}`);
        console.log("ACTION NEEDED     : Add this IP to the BillDesk Merchant Portal Whitelist for BDUATV2KRL");
        console.log("================================================================================\n");
      });
    }).on("error", () => { });
  });
});

req.on("error", (e) => {
  console.error(`\nConnection Error: ${e.message}`);
});

req.on("timeout", () => {
  console.error("\nRequest timed out. Note: BillDesk UAT may require server IP whitelisting.");
  req.destroy();
});

req.write(postData);
req.end();
