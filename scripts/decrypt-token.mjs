import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Load .env.local
let envLocalPath = path.resolve(process.cwd(), ".env.local");
if (!fs.existsSync(envLocalPath)) {
  envLocalPath = path.resolve(process.cwd(), "spice-and-soul", ".env.local");
}

let jwePassword = "TMtsOBn6bXkSXAxE0XBCCiVfUydaRwLf";
let jwsPassword = "vna166vLuTwyof7e3xIzHXkuALKLX70s";

if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (key === "BILLDESK_JWE_PASSWORD") jwePassword = val;
      if (key === "BILLDESK_JWS_PASSWORD") jwsPassword = val;
    }
  }
}

const encKey = Buffer.from(jwePassword, "utf8");
const signKey = Buffer.from(jwsPassword, "utf8");

// Get token from argument, or read from latest-transaction-token.txt, or prompt
let rawToken = process.argv[2]?.trim();
if (!rawToken) {
  const tokenFile = path.resolve(process.cwd(), "latest-transaction-token.txt");
  if (fs.existsSync(tokenFile)) {
    rawToken = fs.readFileSync(tokenFile, "utf8").trim();
    console.log(`Loaded token from: ${tokenFile}`);
  }
}

if (!rawToken) {
  console.log("Usage: node scripts/decrypt-token.mjs <token>");
  console.log("Or place the full token in latest-transaction-token.txt and run: node scripts/decrypt-token.mjs");
  process.exit(1);
}

// Clean any accidental quotes or transaction_response= prefix
if (rawToken.startsWith("transaction_response=")) {
  rawToken = decodeURIComponent(rawToken.replace("transaction_response=", ""));
}
rawToken = rawToken.replace(/^["']|["']$/g, "").trim();

try {
  const [jwsHdrB64, jwsPayloadB64, jwsSigB64] = rawToken.split(".");
  if (!jwsHdrB64 || !jwsPayloadB64) {
    throw new Error("Invalid JWS token structure (expected 3 dot-separated parts)");
  }

  const jwsHdr = JSON.parse(Buffer.from(jwsHdrB64, "base64url").toString("utf8"));
  console.log("\n================================================================================");
  console.log("                         BILLDESK TOKEN DECRYPTION                              ");
  console.log("================================================================================");
  console.log("JWS Header (Outer Signed):", JSON.stringify(jwsHdr));

  const expectedSig = crypto.createHmac("sha256", signKey)
    .update(`${jwsHdrB64}.${jwsPayloadB64}`)
    .digest("base64url");
  const isSigValid = expectedSig === jwsSigB64;
  console.log(`JWS Signature Valid      : ${isSigValid ? "✅ YES (Authentic BillDesk signature)" : "⚠️ Signature mismatch (token may be truncated)"}`);

  const jweStr = Buffer.from(jwsPayloadB64, "base64url").toString("utf8");
  const [jweHdrB64, , ivB64, cipherB64, tagB64] = jweStr.split(".");
  if (!jweHdrB64 || !ivB64 || !cipherB64 || !tagB64) {
    throw new Error("Invalid inner JWE token structure (expected 5 dot-separated parts)");
  }

  const jweHdr = JSON.parse(Buffer.from(jweHdrB64, "base64url").toString("utf8"));
  console.log("JWE Header (Inner Encrypted):", JSON.stringify(jweHdr));

  const decipher = crypto.createDecipheriv("aes-256-gcm", encKey, Buffer.from(ivB64, "base64url"));
  decipher.setAAD(Buffer.from(jweHdrB64, "ascii"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherB64, "base64url")),
    decipher.final()
  ]);

  const parsed = JSON.parse(decrypted.toString("utf8"));
  console.log("\n-------------------- DECRYPTED TRANSACTION DATA (JSON) -------------------------");
  console.log(JSON.stringify(parsed, null, 2));
  console.log("================================================================================\n");

  // Save to file for easy viewing
  const outPath = path.resolve(process.cwd(), "latest-transaction.json");
  fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2), "utf8");
  console.log(`✅ Saved decrypted payload to: ${outPath}\n`);

} catch (err) {
  console.error("\n❌ Decryption Error:", err.message);
  console.error("Tip: In Chrome DevTools Network tab, click '[ View source ]' above the payload to copy the complete raw token without truncation.\n");
}
