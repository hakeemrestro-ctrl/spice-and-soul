import 'server-only';
import { createHash, createHmac } from 'node:crypto';
import { createClient } from './supabase/server';

function exactHttpsOrigin(value: string | undefined) {
  const trimmed = (value || 'https://hakeemrestro.shop').trim().replace(/\/+$/, '');
  try {
    const url = new URL(trimmed);
    if (url.protocol === 'https:') return url.origin;
  } catch {}
  return 'https://hakeemrestro.shop';
}

export function billdeskAppOrigin() {
  if (process.env.BILLDESK_ENV === 'UAT') return exactHttpsOrigin(process.env.BILLDESK_UAT_APP_ORIGIN);
  if (process.env.BILLDESK_ENV === 'PROD') return exactHttpsOrigin(process.env.BILLDESK_APP_ORIGIN);
  throw new Error('BillDesk environment unavailable');
}

function isLocalhost(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export async function authorizeBilldeskTester(req: Request) {
  // Exact origin prevents cookie-authenticated cross-site initiation. No production fallback.
  if (process.env.BILLDESK_ENV !== 'UAT') throw new Error('UAT forbidden');
  const origin = billdeskAppOrigin();
  const reqOrigin = req.headers.get('origin');
  const isLocalDev = process.env.NODE_ENV === 'development' || isLocalhost(reqOrigin);

  if (reqOrigin !== origin && !isLocalDev) throw new Error('UAT forbidden');
  const allowed = (process.env.BILLDESK_UAT_TESTER_IDS || '').split(',').filter(Boolean);

  try {
    const auth = await createClient();
    // getUser verifies the session with the auth server; never trust getSession alone.
    const { data, error } = await auth.auth.getUser();
    if (!error && data?.user?.id && (allowed.includes(data.user.id) || isLocalDev)) {
      return data.user.id;
    }
  } catch {
    // Auth server inaccessible or not authenticated
  }

  // During UAT testing, permit guest tester from the verified merchant origin or local dev
  return isLocalDev ? 'local-dev-tester' : 'uat-guest-tester';
}

export async function authorizeBilldeskCheckout(req: Request, email: string) {
  if (process.env.BILLDESK_ENV === 'UAT') {
    const testerId = await authorizeBilldeskTester(req);
    // In UAT, include idempotency key so testers can test repeatedly with any email
    const salt = `:${req.headers.get('idempotency-key') || ''}`;
    return createHash('sha256').update(`uat:${testerId}:${email.trim().toLowerCase()}${salt}`).digest('hex');
  }
  if (process.env.BILLDESK_ENV !== 'PROD' || process.env.BILLDESK_CUSTOMER_CHECKOUT_ENABLED !== 'true') {
    throw new Error('Customer checkout disabled');
  }
  const origin = billdeskAppOrigin();
  if (req.headers.get('origin') !== origin) throw new Error('Customer checkout forbidden');
  const secret = process.env.BILLDESK_CHECKOUT_BINDING_SECRET || '';
  if (Buffer.byteLength(secret) < 32) throw new Error('Customer checkout unavailable');
  return createHmac('sha256', secret).update(email.trim().toLowerCase()).digest('hex');
}
