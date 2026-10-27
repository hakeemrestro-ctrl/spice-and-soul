import { CompactEncrypt, CompactSign } from "jose";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

// 1. Try to load .env.local if present
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
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const MERCID = process.env.BILLDESK_MERCID || "YOUR_MERCID_HERE";
const CLIENT_ID = process.env.BILLDESK_CLIENT_ID || "YOUR_CLIENT_ID_HERE";
const KEY_ID = process.env.BILLDESK_KEY_ID || "YOUR_KEY_ID_HERE";
const JWE_PASSWORD = process.env.BILLDESK_JWE_PASSWORD || "";
const JWS_PASSWORD = process.env.BILLDESK_JWS_PASSWORD || "";

async function generate() {
  console.log("================================================================================");
  console.log("             BILLDESK V2 - EMAIL PAYLOAD GENERATOR FOR SUPPORT                   ");
  console.log("================================================================================\n");

  if (!JWE_PASSWORD || !JWS_PASSWORD || MERCID === "YOUR_MERCID_HERE") {
    console.log("⚠️  NOTE: BillDesk credentials are not yet set in .env.local.");
    console.log("   Generating with placeholder values. To get your REAL encrypted tokens,");
    console.log("   add BILLDESK_MERCID, BILLDESK_CLIENT_ID, BILLDESK_KEY_ID, BILLDESK_JWE_PASSWORD,");
    console.log("   and BILLDESK_JWS_PASSWORD to your .env.local and run this script again.\n");
  }

  const encKey = new TextEncoder().encode((JWE_PASSWORD || "sample_jwe_key_32_bytes_len_ok!!").padEnd(32, "0").slice(0, 32));
  const signKey = new TextEncoder().encode((JWS_PASSWORD || "sample_jws_key_32_bytes_len_ok!!").padEnd(32, "0").slice(0, 32));

  // 1. Construct Sample JSON Request
  const now = new Date();
  const offsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + offsetMs);
  const orderDate = istDate.toISOString().slice(0, 19) + "+05:30";
  const orderId = `BD_${randomUUID().replaceAll("-", "").slice(0, 16)}`;

  const jsonRequest = {
    mercid: MERCID,
    orderid: orderId,
    amount: "100.00",
    order_date: orderDate,
    currency: "356",
    ru: "https://yourdomain.com/api/billdesk/callback",
    itemcode: "DIRECT",
    device: {
      init_channel: "internet",
      ip: "103.211.54.10",
      user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
  };

  const jsonString = JSON.stringify(jsonRequest, null, 2);

  // 2. Encrypt Request (JWE: dir + A256GCM)
  const jweEncrypted = await new CompactEncrypt(new TextEncoder().encode(JSON.stringify(jsonRequest)))
    .setProtectedHeader({
      alg: "dir",
      enc: "A256GCM",
      kid: KEY_ID,
      clientid: CLIENT_ID,
    })
    .encrypt(encKey);

  // 3. Sign Request (JWS: HS256)
  const jwsSigned = await new CompactSign(new TextEncoder().encode(jweEncrypted))
    .setProtectedHeader({
      alg: "HS256",
      kid: KEY_ID,
      clientid: CLIENT_ID,
    })
    .sign(signKey);

  // 4. Trace ID & Timestamp
  const traceId = `BD${randomUUID().replaceAll("-", "")}`;
  const timestamp = istDate.toISOString().replace(/[-:T]/g, "").slice(0, 14);

  console.log("---------------- COPY EVERYTHING BELOW INTO YOUR EMAIL REPLY ------------------\n");
  console.log("Dear Anand,\n");
  console.log("Please find the requested integration and encryption details below:\n");
  console.log("1. JSON Request:");
  console.log(jsonString);
  console.log("\n2. Encrypted Request (JWE):");
  console.log(jweEncrypted);
  console.log("\n3. Signed Request (JWS):");
  console.log(jwsSigned);
  console.log("\n4. BD-traceID and BD-timestamp:");
  console.log(`BD-Traceid: ${traceId}`);
  console.log(`BD-Timestamp: ${timestamp}`);
  console.log("\nPlease review our request envelope and let us know if our JWE/JWS headers, algorithm, or payload formatting need any adjustments.");
  console.log("\nRegards,");
  console.log("Hakeem Restro Integration Team");
  console.log("\n--------------------------------------------------------------------------------");
}

generate().catch(console.error);
