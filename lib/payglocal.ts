/**
 * PayGlocal Payment Gateway helpers — PayCollect flow (API-key auth).
 *
 * PayGlocal offers two integration flows:
 *   - PayCollect  — hosted page, customer enters card on PayGlocal. NON-PCI.
 *                   Auth via `x-gl-auth: <api_key>` header. THIS is what we use.
 *   - PayDirect   — merchant collects card data, JWT (JWE+JWS) auth. PCI-DSS.
 *
 * Server-to-server flow:
 *   1. POST /gl/v1/payments/initiate/paycollect (x-gl-auth) → { gid, data.redirectUrl }
 *   2. Redirect customer to redirectUrl (PayGlocal hosted page)
 *   3. PayGlocal redirects/POSTs back to merchantCallbackURL after payment
 *   4. GET /gl/v1/payments/{gid}/status (x-gl-auth) → authoritative status
 *
 * Account: N K Ventures, PA transaction MID ptplnavedkha2089.
 *
 * Env contract:
 *   PAYGLOCAL_API_KEY  — required, server-only. The x-gl-auth key.
 *   PAYGLOCAL_ENV      — optional, "production" | "test" (default production).
 *   PAYGLOCAL_HOST     — optional explicit host override.
 *   PAYGLOCAL_MID      — optional, for logging/reference (not sent in PayCollect body).
 */

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
  const apiKey = requireEnv("PAYGLOCAL_API_KEY");
  const env = optionalEnv("PAYGLOCAL_ENV", "production");
  // PayGlocal hosts: UAT vs production. Base path is /gl/v1/payments.
  const host = optionalEnv(
    "PAYGLOCAL_HOST",
    env === "test" ? "api.uat.payglocal.in" : "api.prod.payglocal.in",
  );
  const mid = optionalEnv("PAYGLOCAL_MID", "");
  return { apiKey, env, host, mid };
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

/** Non-PII config snapshot for runtime logging. Throws if API key missing. */
export function auditPayglocalConfig(): Record<string, string | number> {
  const c = getConfig();
  return {
    env: c.env,
    host: c.host,
    midTail: c.mid ? c.mid.slice(-4) : "(unset)",
    apiKeyLen: c.apiKey.length,
    apiKeyTail: c.apiKey.slice(-4),
    initiateEndpoint: `https://${c.host}/gl/v1/payments/initiate/paycollect`,
  };
}

/** Unique PayGlocal merchantTxnId. Alphanumeric + `_`, kept distinct from Paytm. */
export function generatePayglocalOrderId(prefix = "PGL"): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require("crypto") as typeof import("crypto");
  const ts = Date.now().toString(36);
  const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}_${ts}_${rand}`;
}

/** Convert price in paise (₹×100) to the `"1249.00"` string PayGlocal expects. */
export function paiseToAmount(paise: number): string {
  return (paise / 100).toFixed(2);
}

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
  data?: {
    redirectUrl?: string;
    statusUrl?: string;
    merchantTxnId?: string;
  };
  errors?: { detailedMessage?: string; displayMessage?: string };
};

/**
 * Initiate a PayCollect card payment.
 * Returns the parsed PayGlocal response (gid + redirectUrl on success).
 */
export async function initiatePayCollect(
  input: InitiateInput,
): Promise<{ httpStatus: number; body: PayglocalInitiateResponse }> {
  const cfg = getConfig();

  const billingData: Record<string, string> = {};
  if (input.email) billingData.emailId = input.email;
  if (input.callingCode) billingData.callingCode = input.callingCode;
  if (input.phone) billingData.phoneNumber = input.phone;

  const body = {
    merchantTxnId: input.merchantTxnId,
    paymentData: {
      totalAmount: input.amountRupees,
      txnCurrency: "INR",
      ...(Object.keys(billingData).length ? { billingData } : {}),
    },
    merchantCallbackURL: input.callbackUrl,
  };

  const res = await fetch(
    `https://${cfg.host}/gl/v1/payments/initiate/paycollect`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        "x-gl-auth": cfg.apiKey,
      },
      body: JSON.stringify(body),
    },
  );

  const json = (await res.json().catch(() => ({}))) as PayglocalInitiateResponse;
  return { httpStatus: res.status, body: json };
}

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
 * Fetch the authoritative status of a transaction by GID (or merchantTxnId).
 * PayGlocal success terminal status = "SENT_FOR_CAPTURE".
 */
export async function getPayglocalStatus(id: string): Promise<StatusResponse> {
  const cfg = getConfig();
  try {
    const res = await fetch(
      `https://${cfg.host}/gl/v1/payments/${encodeURIComponent(id)}/status`,
      {
        method: "GET",
        headers: { accept: "application/json", "x-gl-auth": cfg.apiKey },
      },
    );
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
