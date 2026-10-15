import { Resend } from "resend";

let _resend: Resend | null = null;

function getResend(): Resend {
  // UAT delivery is deliberately blocked until a test-only transport is approved.
  // Check every access, including when a client was previously cached.
  if (process.env.BILLDESK_ENV === "UAT") {
    throw new Error("UAT email delivery disabled pending approved test transport");
  }
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY!);
  }
  return _resend;
}

// Lazy proxy so existing `resend.X` call sites continue to work without changes.
export const resend = new Proxy({} as Resend, {
  get(_target, prop) {
    return (getResend() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
