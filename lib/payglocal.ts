/**
 * PayGlocal Payment Gateway — JWT (JWE + JWS) auth, PayCollect flow.
 *
 * This account (N K Ventures, PA MID ptplnavedkha2089) is provisioned for
 * JWT/RSA auth, not the simpler API-key auth. Every request is:
 *   1. JWE-encrypt the JSON payload with PayGlocal's PUBLIC key (RSA-OAEP-256
 *      + A128CBC-HS256).
 *   2. JWS-sign a SHA-256 digest of that JWE with OUR merchant PRIVATE key
 *      (RS256).
 *   3. POST: header `x-gl-token-external: <JWS>`, body `<JWE>` (raw).
 *
 * Spec sourced verbatim from PayGlocal's official SDKs (payglocal-js-client,
 * payglocal-python-sdk) + the official Postman collection — NOT guessed.
 *
 * Endpoints (PayCollect): {host}/gl/v1/payments/initiate/paycollect
 * Status:                 {host}/gl/v1/payments/{id}/status
 * Refund:                 {host}/gl/v1/payments/{id}/refund
 * Hosts: api.prod.payglocal.in / api.uat.payglocal.in
 *
 * Env contract:
 *   PAYGLOCAL_MID              — required (transacting MID, ptplnavedkha2089)
 *   PAYGLOCAL_PRIVATE_KEY_PEM  — required, server-only (merchant private key, PKCS8)
 *   PAYGLOCAL_PRIVATE_KID      — required (kid of merchant private key)
 *   PAYGLOCAL_PUBLIC_KEY_PEM   — optional (PayGlocal public key SPKI; default below)
 *   PAYGLOCAL_PUBLIC_KID       — optional (default 8cc91c8d-... — PayGlocal's CDN kid)
 *   PAYGLOCAL_ENV              — optional, "production" | "test" (default production)
 *   PAYGLOCAL_HOST             — optional explicit host override
 */
import { CompactEncrypt, CompactSign, importSPKI, importPKCS8 } from "jose";
import { createHash } from "node:crypto";

// PayGlocal's well-known public key (also on https://cdn.payglocal.in/public-key/).
// Used only for JWE encryption; override via PAYGLOCAL_PUBLIC_KEY_PEM if rotated.
const DEFAULT_PUBLIC_KID = "8cc91c8d-8030-4660-a9c7-33de886fb495";

const JWE_ALG = "RSA-OAEP-256";
const JWE_ENC = "A128CBC-HS256";
const JWS_ALG = "RS256";
const DIGEST_ALG = "SHA-256";
const TOKEN_TTL_MS = 300000; // 5 min, per PayGlocal SDK

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

// Env-stored PEMs may arrive with literal "\n" (Vercel single-line) — normalise.
function normalizePem(pem: string): string {
  return pem.includes("\\n") ? pem.replace(/\\n/g, "\n") : pem;
}

function loadConfig() {
  const mid = requireEnv("PAYGLOCAL_MID");
  const privateKeyPem = normalizePem(requireEnv("PAYGLOCAL_PRIVATE_KEY_PEM"));
  const privateKid = requireEnv("PAYGLOCAL_PRIVATE_KID");
  const publicKeyPem = normalizePem(requireEnv("PAYGLOCAL_PUBLIC_KEY_PEM"));
  const publicKid = optionalEnv("PAYGLOCAL_PUBLIC_KID", DEFAULT_PUBLIC_KID);
  const env = optionalEnv("PAYGLOCAL_ENV", "production");
  const host = optionalEnv(
    "PAYGLOCAL_HOST",
    env === "test" ? "api.uat.payglocal.in" : "api.prod.payglocal.in",
  );
  return { mid, privateKeyPem, privateKid, publicKeyPem, publicKid, env, host };
}

let _cached: ReturnType<typeof loadConfig> | null = null;
function getConfig() {
  if (_cached) return _cached;
  _cached = loadConfig();
  return _cached;
}

export const PAYGLOCAL = new Proxy({} as ReturnType<typeof loadConfig>, {
  get(_t, prop) {
    return getConfig()[prop as keyof ReturnType<typeof loadConfig>];
  },
});

/** Non-PII config snapshot for runtime logging. Throws if any required env missing. */
export function auditPayglocalConfig(): Record<string, string | number | boolean> {
  const c = getConfig();
  return {
    env: c.env,
    host: c.host,
    midTail: c.mid.slice(-4),
    privateKid: c.privateKid,
    publicKid: c.publicKid,
    privateKeyPemOk: c.privateKeyPem.includes("BEGIN") && c.privateKeyPem.includes("PRIVATE"),
    publicKeyPemOk: c.publicKeyPem.includes("BEGIN") && c.publicKeyPem.includes("PUBLIC"),
    endpoint: `https://${c.host}/gl/v1/payments/initiate/paycollect`,
  };
}

/** Unique PayGlocal merchantTxnId. Distinct prefix from Paytm orders. */
export function generatePayglocalOrderId(prefix = "PGL"): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require("node:crypto") as typeof import("node:crypto");
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}_${ts}_${rand}`;
}

/** Convert paise (₹×100) to PayGlocal's `"1249.00"` string. */
export function paiseToAmount(paise: number): string {
  return (paise / 100).toFixed(2);
}

// --- JWE / JWS token generation (matches payglocal SDK exactly) -------------

async function generateJWE(payload: unknown): Promise<string> {
  const cfg = getConfig();
  const publicKey = await importSPKI(cfg.publicKeyPem, JWE_ALG);
  const header = {
    "issued-by": cfg.mid,
    enc: JWE_ENC,
    exp: TOKEN_TTL_MS,
    iat: `${Date.now()}`,
    alg: JWE_ALG,
    kid: cfg.publicKid,
  };
  return new CompactEncrypt(new TextEncoder().encode(JSON.stringify(payload)))
    .setProtectedHeader(header)
    .encrypt(publicKey);
}

async function generateJWS(jweToken: string): Promise<string> {
  const cfg = getConfig();
  const privateKey = await importPKCS8(cfg.privateKeyPem, JWS_ALG);
  const digestObject = {
    digest: createHash("sha256").update(jweToken).digest("base64"),
    digestAlgorithm: DIGEST_ALG,
    exp: TOKEN_TTL_MS,
    iat: `${Date.now()}`,
  };
  const header = {
    alg: JWS_ALG,
    kid: cfg.privateKid,
    "x-gl-merchantId": cfg.mid,
    "issued-by": cfg.mid,
    "is-digested": "true",
    "x-gl-enc": "true",
  };
  return new CompactSign(new TextEncoder().encode(JSON.stringify(digestObject)))
    .setProtectedHeader(header)
    .sign(privateKey);
}

/** Build the { jwe, jws } pair for a transaction payload. */
export async function buildJwtTokens(
  payload: unknown,
): Promise<{ jwe: string; jws: string }> {
  const jwe = await generateJWE(payload);
  const jws = await generateJWS(jwe);
  return { jwe, jws };
}

// --- PayCollect initiate ----------------------------------------------------

type InitiateInput = {
  merchantTxnId: string;
  amountRupees: string; // "100.00"
  callbackUrl: string;
  email?: string;
  phone?: string;
  callingCode?: string;
};

type PayglocalInitiateResponse = {
  gid?: string;
  status?: string;
  message?: string;
  timestamp?: string;
  reasonCode?: string;
  data?: { redirectUrl?: string; statusUrl?: string; merchantTxnId?: string };
  errors?: { detailedMessage?: string; displayMessage?: string };
};

export async function initiatePayCollect(
  input: InitiateInput,
): Promise<{ httpStatus: number; body: PayglocalInitiateResponse }> {
  const cfg = getConfig();

  const billingData: Record<string, string> = {};
  if (input.email) billingData.emailId = input.email;
  if (input.callingCode) billingData.callingCode = input.callingCode;
  if (input.phone) billingData.phoneNumber = input.phone;

  const payload = {
    merchantTxnId: input.merchantTxnId,
    paymentData: {
      totalAmount: input.amountRupees,
      txnCurrency: "INR",
      ...(Object.keys(billingData).length ? { billingData } : {}),
    },
    merchantCallbackURL: input.callbackUrl,
  };

  const { jwe, jws } = await buildJwtTokens(payload);

  const res = await fetch(
    `https://${cfg.host}/gl/v1/payments/initiate/paycollect`,
    {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        accept: "application/json",
        "x-gl-token-external": jws,
      },
      body: jwe,
    },
  );

  const json = (await res.json().catch(() => ({}))) as PayglocalInitiateResponse;
  return { httpStatus: res.status, body: json };
}

// --- Status query -----------------------------------------------------------

type StatusResponse = {
  ok: boolean;
  httpStatus?: number;
  status?: string;
  gid?: string;
  amount?: string;
  currency?: string;
  merchantTxnId?: string;
  paymentMethod?: string;
  reasonCode?: string;
  detailedMessage?: string;
};

/**
 * Authoritative status check by GID (or merchantTxnId).
 *
 * For JWT-auth merchants the status GET carries a JWS that signs a digest of
 * the request PATH. PayGlocal returns the same status JSON shape as the
 * API-key flow.
 */
export async function getPayglocalStatus(id: string): Promise<StatusResponse> {
  const cfg = getConfig();
  const path = `/gl/v1/payments/${encodeURIComponent(id)}/status`;
  try {
    // GET requests still need a JWS in x-gl-token-external. The digest is over
    // the path string (PayGlocal SDK status flow signs the status path).
    const jws = await generateJWS(path);
    const res = await fetch(`https://${cfg.host}${path}`, {
      method: "GET",
      headers: { accept: "application/json", "x-gl-token-external": jws },
    });
    const json = (await res.json().catch(() => ({}))) as {
      gid?: string;
      status?: string;
      reasonCode?: string;
      data?: {
        status?: string;
        gid?: string;
        Amount?: string;
        Currency?: string;
        merchantTxnId?: string;
        ["payment-method"]?: string;
        reasonCode?: string;
        detailedMessage?: string;
      };
    };
    const d = json.data ?? {};
    return {
      ok: true,
      httpStatus: res.status,
      status: d.status ?? json.status,
      gid: d.gid ?? json.gid,
      amount: d.Amount,
      currency: d.Currency,
      merchantTxnId: d.merchantTxnId,
      paymentMethod: d["payment-method"],
      reasonCode: d.reasonCode ?? json.reasonCode,
      detailedMessage: d.detailedMessage,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[payglocal:status] fetch failed", { id, host: cfg.host, error: msg });
    return { ok: false };
  }
}

/** PayGlocal terminal success statuses (capture queued / settled). */
export function isPayglocalSuccess(status: string | undefined): boolean {
  if (!status) return false;
  const s = status.toUpperCase();
  return s === "SENT_FOR_CAPTURE" || s === "CAPTURED" || s === "SUCCESS";
}
