import { authenticate, operation, envelope, digest, AdapterError } from './protocol';
import { Limits, type NonceStore } from './store';
import { sendBilldesk } from './upstream';

export function createAdapter(store: NonceStore, key: string, secret: string) {
  const limits = new Limits();
  return async (method: string, path: string, headers: Headers, body: Uint8Array, now = Date.now()) => {
    const op = operation(path);
    if (headers.has('authorization') || headers.has('proxy-authorization')) throw new AdapterError('FORBIDDEN_HEADER');
    if (headers.get('content-type') !== 'application/json' || headers.has('content-encoding')) throw new AdapterError('INVALID_CONTENT_TYPE', 415);
    const nonce = authenticate(headers, method, op, body, key, secret, now);
    const release = limits.enter(key, now);
    try {
      store.consume(key, nonce, now);
      const data = envelope(body);
      if (data.operationId === nonce) throw new AdapterError('OPERATION_NONCE_COLLISION');
      // Disabled requests consume the nonce but do not consume a business operation.
      if (process.env.BILLDESK_UPSTREAM_ENABLED !== 'true') throw new AdapterError('UPSTREAM_DISABLED', 503);
      if (!['UAT','PROD'].includes(process.env.BILLDESK_ENV || '')) throw new AdapterError('INVALID_ENVIRONMENT', 503);
      store.claim(key, data.operationId, digest(Buffer.from(op + '\n' + digest(body))));
      try {
        const response = await sendBilldesk(op, data);
        store.finish(key, data.operationId, 'responded');
        return response;
      } catch {
        store.finish(key, data.operationId, 'unknown');
        throw new AdapterError('UPSTREAM_OUTCOME_UNKNOWN', 502);
      }
    } finally { release(); }
  };
}
