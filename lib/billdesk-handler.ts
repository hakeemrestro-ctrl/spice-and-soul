import { createAdminClient } from './supabase/admin';
import 'server-only';
import { fulfillBilldeskOrder } from './billdesk-fulfillment';
import { readBilldeskBody } from './billdesk-body';
import { processBilldeskPayment, type BilldeskStore } from './billdesk-payment';

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
  });
}

export async function readBilldeskToken(req: Request): Promise<string> {
  let token: unknown = null;

  // 1. Try URL search params first (if passed via GET or query string on POST)
  try {
    const url = new URL(req.url);
    token = url.searchParams.get('transaction_response') ||
            url.searchParams.get('token') ||
            url.searchParams.get('msg') ||
            url.searchParams.get('encdata');
  } catch {
    // ignore
  }

  // 2. Try FormData (standard for browser POST submissions from gateways)
  if (!token) {
    try {
      const clone = req.clone();
      const fd = await clone.formData();
      token = fd.get('transaction_response') ||
              fd.get('token') ||
              fd.get('msg') ||
              fd.get('encdata') ||
              fd.get('bdorderid');
    } catch {
      // not form data or already consumed
    }
  }

  // 3. Try reading as text (clone first, fallback to readBilldeskBody)
  if (!token) {
    let text = '';
    try {
      const clone = req.clone();
      text = await clone.text();
    } catch {
      try {
        text = await readBilldeskBody(req);
      } catch {
        text = '';
      }
    }

    if (text) {
      const contentType = req.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      if (contentType === 'application/jose' || contentType === 'text/plain') {
        token = text;
      } else if (contentType === 'application/json' || text.trim().startsWith('{')) {
        try {
          const json = JSON.parse(text);
          token = json.transaction_response || json.token || json.msg || json.bdorderid;
        } catch {
          token = text;
        }
      } else {
        try {
          const params = new URLSearchParams(text);
          token = params.get('transaction_response') ||
                  params.get('token') ||
                  params.get('msg') ||
                  params.get('encdata');
        } catch {
          // ignore
        }
        if (!token && text.includes('.') && text.split('.').length >= 3) {
          token = text;
        }
      }
    }
  }

  if (typeof token !== 'string' || !token) throw new Error('Missing token');
  return token.trim().replace(/^["']|["']$/g, '');
}
