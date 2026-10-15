import { createAdminClient } from './supabase/admin';
import 'server-only';
import { fulfillBilldeskOrder } from './billdesk-fulfillment';
import { readBilldeskBody } from './billdesk-body';
import { processBilldeskPayment, type BilldeskStore } from './billdesk-payment';
import { recordBilldeskRawAudit } from './billdesk-audit';

export async function handleBilldeskPayment(token: string) {
  const supabase = createAdminClient();
  const store: BilldeskStore = {
    async claim(orderId, txnId, status, amount) {
      const { data, error } = await supabase.rpc('billdesk_claim_payment', {
        p_order_id: orderId, p_txn_id: txnId, p_status: status, p_amount: amount,
      });
      if (error || !data) throw new Error('BillDesk payment claim unavailable');
      return data;
    },
    async finish(orderId, txnId, complete) {
      const { error } = await supabase.rpc('billdesk_finish_payment', {
        p_order_id: orderId, p_txn_id: txnId, p_complete: complete,
      });
      if (error) throw new Error('BillDesk payment completion unavailable');
    },
  };
  return processBilldeskPayment(token, {
    store,
    fulfill: (pending, txnId) => fulfillBilldeskOrder(pending, txnId, supabase),
    audit: (orderId, op, rawToken) => recordBilldeskRawAudit(orderId, op, rawToken, supabase),
  });
}

export async function readBilldeskToken(req: Request): Promise<string> {
  const text = await readBilldeskBody(req);
  const contentType = req.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  let token: unknown;
  if (contentType === 'application/jose' || contentType === 'text/plain') token = text;
  else if (contentType === 'application/json') token = JSON.parse(text).transaction_response;
  else if (contentType === 'application/x-www-form-urlencoded') {
    const params = new URLSearchParams(text);
    if (params.getAll('transaction_response').length !== 1) throw new Error('Invalid body');
    token = params.get('transaction_response');
  }
  if (typeof token !== 'string' || !token) throw new Error('Missing token');
  return token;
}
