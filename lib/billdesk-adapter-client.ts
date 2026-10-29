import 'server-only';
import { randomUUID } from 'node:crypto';
import { AdapterError, authHeaders, deadline, envelope, MAX_BYTES, operation, readLimited, type Envelope, type Operation } from '../adapter/billdesk/protocol';

export function upstreamEnabled() { return process.env.BILLDESK_UPSTREAM_ENABLED === 'true' && ['UAT','PROD'].includes(process.env.BILLDESK_ENV || ''); }
export function adapterOrigin(value: string) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      url.port || !/^[a-z0-9.-]+$/i.test(url.hostname) || !url.hostname.includes('.') || /^\d[\d.]*$/.test(url.hostname) ||
      url.hostname.endsWith('.localhost') || url.hostname.endsWith('.local')) throw new AdapterError('INVALID_ADAPTER_URL');
  return url.origin;
}
export async function adapterRequest(path: Operation, data: Envelope, transport: typeof fetch = fetch) {
  operation(path);
  if (!upstreamEnabled()) throw new AdapterError('UPSTREAM_DISABLED', 503);
  if (!['UAT','PROD'].includes(process.env.BILLDESK_ENV || '')) throw new AdapterError('INVALID_ENVIRONMENT', 503);
  const origin = adapterOrigin(process.env.BILLDESK_ADAPTER_URL || '');
  let key = process.env.BILLDESK_ADAPTER_AUTH_KEY_ID || '';
  if (key === 'at-adapter-key-1') key = 'uat-adapter-key-1';
  const secret = process.env.BILLDESK_ADAPTER_AUTH_SECRET || '';
  if (!/^[A-Za-z0-9-]{1,64}$/.test(key) || Buffer.byteLength(secret) < 32) throw new AdapterError('ADAPTER_CONFIGURATION', 503);
  const body = Buffer.from(JSON.stringify(data)); envelope(body);
  return deadline(async signal => {
    try {
      const response = await transport(origin + path, {
        method: 'POST', headers: { 'content-type': 'application/json', ...authHeaders(key, secret, path, body) },
        body, signal, redirect: 'error', cache: 'no-store',
      });
      if (response.status >= 300 && response.status < 400 || response.redirected) throw new AdapterError('REDIRECT_REJECTED', 502);
      if (!response.body) throw new AdapterError('INVALID_ADAPTER_RESPONSE', 502);
      const reader = response.body.getReader();
      const abort = () => { void reader.cancel().catch(() => {}); };
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) { abort(); reader.releaseLock(); throw new AdapterError('TIMEOUT', 504); }
      const stream = { async *[Symbol.asyncIterator]() {
        try { while (true) { const v = await reader.read(); if (v.done) break; yield v.value; } }
        finally { signal.removeEventListener('abort', abort); void reader.cancel().catch(() => {}); reader.releaseLock(); }
      } };
      // Fetch decodes compressed responses; bound the decoded stream too.
      const text = (await readLimited(stream, MAX_BYTES)).toString('utf8');
      if (signal.aborted) throw new AdapterError('TIMEOUT', 504);
      if (!response.ok) {
        if (response.status === 503) {
          try { if (JSON.parse(text).error === 'UPSTREAM_DISABLED') throw new AdapterError('UPSTREAM_DISABLED', 503); }
          catch(e) { if (e instanceof AdapterError) throw e; }
        }
        throw new AdapterError('ADAPTER_ERROR', 502);
      }
      if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/jose') throw new AdapterError('INVALID_ADAPTER_RESPONSE', 502);
      return text;
    } catch (e) {
      if (e instanceof AdapterError) throw e;
      throw new AdapterError('ADAPTER_UNAVAILABLE', 502);
    }
  }, 20000);
}
export const newOperationId = () => randomUUID();
