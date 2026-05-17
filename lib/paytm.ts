/**
 * Paytm Payment Gateway helpers — V2 ALL-IN-ONE API.
 *
 * Uses the OFFICIAL `paytmchecksum` Node package published by Paytm-Payments.
 * Never uses native crypto for signing. The checksum is generated against the
 * EXACT stringified JSON body that is sent inside the outer `head + body`
 * envelope to `/theia/api/v1/initiateTransaction`.
 *
 * Env-var contract (strict):
 *   PAYTM_MID                — required, 8-24 chars
 *   PAYTM_MERCHANT_KEY       — required, 16-32 chars
 *   PAYTM_WEBSITE            — optional, defaults per env (DEFAULT / WEBSTAGING)
 *   PAYTM_INDUSTRY_TYPE_ID   — optional, defaults to "Retail"
 *   PAYTM_CHANNEL_ID         — optional, defaults to "WEB"
 *   PAYTM_ENV                — optional, "production" | "test" (default production)
 *
 * Endpoint selection:
 *   PAYTM_ENV=test           → securegw-stage.paytm.in (sandbox)
 *   PAYTM_ENV=production     → securegw.paytm.in (live)
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PaytmChecksum = require("paytmchecksum");

// --- Strict env-var validation (throws on first access if missing) ---------

function requireEnv(name: string): string {
  const v = process.env[name];
  if (v == null || v.trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

function optionalEnv(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : fallback;
}

function loadConfig() {
  const mid = requireEnv("PAYTM_MID");
  const key = requireEnv("PAYTM_MERCHANT_KEY");
  const env = optionalEnv("PAYTM_ENV", "production");
  const website = optionalEnv(
    "PAYTM_WEBSITE",
    env === "test" ? "WEBSTAGING" : "DEFAULT",
  );
  const industryType = optionalEnv("PAYTM_INDUSTRY_TYPE_ID", "Retail");
  const channelId = optionalEnv("PAYTM_CHANNEL_ID", "WEB");
  // API host: Paytm Payments Services Ltd accounts (dashboard.paytmpayments.com)
  // use secure.paytmpayments.com / securestage.paytmpayments.com, NOT the
  // legacy One97 securegw.paytm.in hosts. Hitting the wrong host returns
  // RESPCODE 330 (legacy form) or resultCode 501 (V2) regardless of creds.
  // Override via PAYTM_HOST if needed for legacy One97 accounts.
  const host = optionalEnv(
    "PAYTM_HOST",
    env === "test" ? "securestage.paytmpayments.com" : "secure.paytmpayments.com",
  );

  if (mid.length < 8 || mid.length > 24) {
    throw new Error(
      `PAYTM_MID has unexpected length: ${mid.length} (expected 8-24)`,
    );
  }
  if (key.length < 16 || key.length > 32) {
    throw new Error(
      `PAYTM_MERCHANT_KEY has unexpected length: ${key.length} (expected 16-32)`,
    );
  }

  return { mid, key, website, industryType, channelId, host, env };
}

let _cached: ReturnType<typeof loadConfig> | null = null;
function getConfig() {
  if (_cached) return _cached;
  _cached = loadConfig();
  return _cached;
}

export const PAYTM = new Proxy({} as ReturnType<typeof loadConfig>, {
  get(_t, prop) {
    return getConfig()[prop as keyof ReturnType<typeof loadConfig>];
  },
});

/**
 * Safe, non-PII snapshot of the Paytm config. Throws (via getConfig) if any
 * required env var is missing/empty — guarantees we can't sign with stale or
 * undefined values.
 */
export function auditPaytmConfig(): Record<string, string | number> {
  const c = getConfig();
  return {
    midTail: c.mid.slice(-4),
    midLen: c.mid.length,
    keyLen: c.key.length,
    website: c.website,
    industryTypeId: c.industryType,
    channelId: c.channelId,
    env: c.env,
    host: c.host,
    endpoint: `https://${c.host}/theia/api/v1/initiateTransaction`,
  };
}

// --- Public API -------------------------------------------------------------

/**
 * Generate a Paytm signature using the OFFICIAL paytmchecksum SDK.
 *
 * For the V2 API, pass the EXACT stringified JSON body that will be nested
 * inside `{ head: { signature }, body: <THIS> }` of the outbound HTTP request.
 */
export async function generateSignature(
  params: string | Record<string, string | number>,
): Promise<string> {
  const cfg = getConfig();
  return PaytmChecksum.generateSignature(params, cfg.key);
}

/**
 * Verify a Paytm signature using the OFFICIAL SDK. The lib throws
 * `ERR_OSSL_BAD_DECRYPT` on key mismatch; we coerce that to `false`.
 */
export async function verifySignature(
  params: string | Record<string, string | number>,
  signature: string,
): Promise<boolean> {
  const cfg = getConfig();
  try {
    return PaytmChecksum.verifySignature(params, cfg.key, signature);
  } catch (err) {
    // Only swallow expected crypto failures (wrong key → AES bad decrypt).
    // Anything else (input shape, undefined key, JSON parse) is a programmer
    // bug — log it loudly so it doesn't masquerade as a checksum mismatch.
    const code = (err as { code?: string }).code;
    if (code === "ERR_OSSL_BAD_DECRYPT") {
      return false;
    }
    console.error("[paytm:verify] unexpected verifySignature error", {
      code,
      message: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/** Generate a unique Paytm orderId. Max 64 chars; alphanumeric + `_@-`. */
export function generateOrderId(prefix = "SPICE"): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require("crypto") as typeof import("crypto");
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}_${ts}_${rand}`;
}

/** Convert price in paise (₹×100) to the `"1249.00"` string Paytm expects. */
export function paiseToTxnAmount(paise: number): string {
  return (paise / 100).toFixed(2);
}

/** Sanitize an email-like string into Paytm's alphanumeric+_ custId. */
export function emailToCustId(email: string): string {
  return email.replace(/[^A-Za-z0-9]/g, "_").slice(0, 64);
}

/**
 * Build the LEGACY `/order/process` form-redirect payload.
 *
 * Browser auto-submits these fields to Paytm's hosted page. Paytm renders
 * the payment UI, then POSTs back to our callbackUrl after the customer
 * pays (or cancels).
 *
 * Paytm legacy signature spec covers ONLY the 8 transactional fields below.
 * EMAIL / MOBILE_NO are sent in the form body for OTP/fraud-check but NOT
 * included in signature input.
 *
 * Trade-off vs V2 All-in-One: full-page redirect instead of in-page modal,
 * but does not require a server-to-server initiate call so the user reaches
 * Paytm's page even when V2 API access isn't provisioned on the MID.
 */
export async function buildLegacyForm(input: {
  orderId: string;
  customerId: string;
  amountRupees: string;
  customerEmail?: string;
  customerMobile?: string;
  callbackUrl: string;
}): Promise<{ action: string; fields: Record<string, string> }> {
  const cfg = getConfig();

  const signedFields: Record<string, string> = {
    MID: cfg.mid,
    ORDER_ID: input.orderId,
    CUST_ID: input.customerId,
    TXN_AMOUNT: input.amountRupees,
    CHANNEL_ID: cfg.channelId,
    INDUSTRY_TYPE_ID: cfg.industryType,
    WEBSITE: cfg.website,
    CALLBACK_URL: input.callbackUrl,
  };

  for (const [k, v] of Object.entries(signedFields)) {
    if (typeof v !== "string" || v.length === 0) {
      throw new Error(`buildLegacyForm: signed field ${k} is empty/invalid`);
    }
  }

  const checksum = await generateSignature(signedFields);

  const fields: Record<string, string> = { ...signedFields };
  if (input.customerEmail) fields.EMAIL = input.customerEmail;
  if (input.customerMobile) fields.MOBILE_NO = input.customerMobile;
  fields.CHECKSUMHASH = checksum;

  return {
    action: `https://${cfg.host}/order/process`,
    fields,
  };
}

/**
 * Build the V2 `/theia/api/v1/initiateTransaction` request payload.
 *
 * Returns the canonical `body` object, the signature over its EXACT
 * stringified form, the final wrapped payload to POST, and the URL with the
 * mid+orderId query params Paytm requires.
 *
 * Pattern (per Paytm V2 docs):
 *   1. Build body object first
 *   2. JSON.stringify(body) once
 *   3. generateSignature(stringifiedBody, MERCHANT_KEY)
 *   4. Wrap as { head: { signature }, body }
 *   5. POST to /theia/api/v1/initiateTransaction?mid=X&orderId=Y
 *
 * Same `body` reference is used for both signing and the outbound payload —
 * no chance of field drift.
 */
export async function buildV2InitiatePayload(input: {
  orderId: string;
  amountRupees: string; // "1.00"
  custId: string;
  callbackUrl: string;
  email?: string;
  mobile?: string;
}): Promise<{
  url: string;
  body: Record<string, unknown>;
  stringifiedBody: string;
  signature: string;
  payload: { head: { signature: string }; body: Record<string, unknown> };
}> {
  const cfg = getConfig();

  // 1. Build body object FIRST.
  const body: Record<string, unknown> = {
    requestType: "Payment",
    mid: cfg.mid,
    websiteName: cfg.website,
    orderId: input.orderId,
    callbackUrl: input.callbackUrl,
    txnAmount: { value: input.amountRupees, currency: "INR" },
    userInfo: {
      custId: input.custId,
      ...(input.email ? { email: input.email } : {}),
      ...(input.mobile ? { mobile: input.mobile } : {}),
    },
  };

  // Strict pre-sign validation — empty/undefined values silently break Paytm.
  for (const [k, v] of Object.entries(body)) {
    if (v == null || (typeof v === "string" && v.length === 0)) {
      throw new Error(`buildV2InitiatePayload: body.${k} is empty/invalid`);
    }
  }

  // 2. Stringify body BEFORE generating checksum.
  const stringifiedBody = JSON.stringify(body);

  // 3. Generate signature using official lib.
  const signature = await generateSignature(stringifiedBody);

  // 4. Final wrapped payload.
  // head MUST include channelId alongside signature. Paytm's V2 ingress router
  // classifies incoming traffic by channelId; if omitted, Paytm throws an
  // internal null-pointer that surfaces as opaque HTTP 501 "System Error".
  const payload = {
    head: { channelId: cfg.channelId, signature },
    body,
  };

  // 5. URL with mid+orderId query params (Paytm V2 requirement).
  const url =
    `https://${cfg.host}/theia/api/v1/initiateTransaction` +
    `?mid=${encodeURIComponent(cfg.mid)}` +
    `&orderId=${encodeURIComponent(input.orderId)}`;

  return { url, body, stringifiedBody, signature, payload };
}
