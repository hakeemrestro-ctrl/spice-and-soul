import 'server-only';
import { createHash, createHmac } from 'node:crypto';
import { createClient } from './supabase/server';

function exactHttpsOrigin(value: string | undefined) {
  const origin = value || '';
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) throw new Error('BillDesk origin unavailable');
  return origin;
}

export function billdeskAppOrigin() {
  if (process.env.BILLDESK_ENV === 'UAT') return exactHttpsOrigin(process.env.BILLDESK_UAT_APP_ORIGIN);
  if (process.env.BILLDESK_ENV === 'PROD') return exactHttpsOrigin(process.env.BILLDESK_APP_ORIGIN);
  throw new Error('BillDesk environment unavailable');
}

export async function authorizeBilldeskTester(req: Request) {
  // Exact origin prevents cookie-authenticated cross-site initiation. No production fallback.
  if (process.env.BILLDESK_ENV !== 'UAT') throw new Error('UAT forbidden');
  const origin = billdeskAppOrigin();
  if (req.headers.get('origin') !== origin) throw new Error('UAT forbidden');
  const allowed = (process.env.BILLDESK_UAT_TESTER_IDS || '').split(',').filter(Boolean);
  if (!allowed.length) throw new Error('UAT forbidden');
  const auth = await createClient();
  // getUser verifies the session with the auth server; never trust getSession alone.
  const { data, error } = await auth.auth.getUser();
  if (error || !data.user || !allowed.includes(data.user.id)) throw new Error('UAT forbidden');
  return data.user.id;
}

export async function authorizeBilldeskCheckout(req: Request, email: string) {
  if (process.env.BILLDESK_ENV === 'UAT') {
    const testerId = await authorizeBilldeskTester(req);
    return createHash('sha256').update(`uat:${testerId}`).digest('hex');
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
