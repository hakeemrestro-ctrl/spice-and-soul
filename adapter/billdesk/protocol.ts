import { createHash, createHmac, timingSafeEqual, randomUUID } from 'node:crypto';

export const MAX_BYTES = 256 * 1024;
export const PATHS = ['/uat/orders/create', '/uat/transactions/get', '/prod/orders/create', '/prod/transactions/get'] as const;
export type Operation = typeof PATHS[number];
export const DESTINATIONS: Record<Operation, string> = Object.freeze({
  '/uat/orders/create': 'https://uat1.billdesk.com/u2/payments/ve1_2/orders/create',
  '/uat/transactions/get': 'https://uat1.billdesk.com/u2/payments/ve1_2/transactions/get',
  '/prod/orders/create': 'https://api.billdesk.com/payments/ve1_2/orders/create',
  '/prod/transactions/get': 'https://api.billdesk.com/payments/ve1_2/transactions/get',
});
export function operationForEnvironment(kind: 'orders/create' | 'transactions/get'): Operation {
  if (process.env.BILLDESK_ENV === 'UAT') return `/uat/${kind}`;
  if (process.env.BILLDESK_ENV === 'PROD') return `/prod/${kind}`;
  throw new AdapterError('INVALID_ENVIRONMENT', 503);
}
export class AdapterError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export type Envelope = { operationId: string; traceId: string; timestamp: string; jose: string };
export function operation(path: string): Operation {
  if (!(PATHS as readonly string[]).includes(path)) throw new AdapterError('INVALID_OPERATION', 404);
  return path as Operation;
}
export function envelope(body: Uint8Array): Envelope {
  if (body.byteLength > MAX_BYTES) throw new AdapterError('REQUEST_TOO_LARGE', 413);
  let v;
  try { v = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body)); } catch { throw new AdapterError('INVALID_BODY'); }
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort().join(',') !== 'jose,operationId,timestamp,traceId' ||
      typeof v.operationId !== 'string' || !/^[A-Za-z0-9-]{16,64}$/.test(v.operationId) ||
      typeof v.traceId !== 'string' || !/^[A-Za-z0-9]{1,35}$/.test(v.traceId) ||
      typeof v.timestamp !== 'string' || !/^\d{10,14}$/.test(v.timestamp) ||
      typeof v.jose !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v.jose)) throw new AdapterError('INVALID_BODY');
  return v;
}
export const digest = (body: Uint8Array) => createHash('sha256').update(body).digest('hex');
export function strictHeaders(raw: string[]) {
  const seen = new Set<string>(), headers = new Headers();
  if (raw.length % 2) throw new AdapterError('INVALID_HEADER');
  for (let i=0; i<raw.length; i+=2) {
    const name = raw[i].toLowerCase();
    if (seen.has(name)) throw new AdapterError('DUPLICATE_HEADER');
    seen.add(name); headers.set(name, raw[i+1]);
  }
  return headers;
}
function canonical(key: string, method: string, path: string, time: string, nonce: string, body: Uint8Array) {
  return ['v1', key, method, path, time, nonce, digest(body)].join('\n');
}
export function authHeaders(key: string, secret: string, path: Operation, body: Uint8Array, now = Date.now(), nonce: string = randomUUID()) {
  const timestamp = String(Math.floor(now / 1000));
  return { 'x-adapter-version': '1', 'x-adapter-key-id': key, 'x-adapter-timestamp': timestamp, 'x-adapter-nonce': nonce,
    'x-adapter-signature': createHmac('sha256', secret).update(canonical(key, 'POST', path, timestamp, nonce, body)).digest('hex') };
}
export function authenticate(headers: Headers, method: string, path: Operation, body: Uint8Array, key: string, secret: string, now: number) {
  const time = headers.get('x-adapter-timestamp') || '';
  const nonce = headers.get('x-adapter-nonce') || '';
  const signature = headers.get('x-adapter-signature') || '';
  if (!/^[A-Za-z0-9-]{1,64}$/.test(key) || Buffer.byteLength(secret) < 32) throw new AdapterError('AUTH_CONFIGURATION', 503);
  if (method !== 'POST' || headers.get('x-adapter-version') !== '1' || headers.get('x-adapter-key-id') !== key ||
      !/^\d{10}$/.test(time) || Math.abs(now / 1000 - Number(time)) > 120 ||
      !/^[A-Za-z0-9-]{16,64}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(signature)) throw new AdapterError('UNAUTHORIZED', 401);
  const expected = createHmac('sha256', secret).update(canonical(key, method, path, time, nonce, body)).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) throw new AdapterError('UNAUTHORIZED', 401);
  return nonce;
}
export async function readLimited(stream: AsyncIterable<Uint8Array>, max = MAX_BYTES): Promise<Buffer> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of stream) {
    size += chunk.byteLength;
    if (size > max) throw new AdapterError('SIZE_LIMIT', 413);
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
export async function deadline<T>(work: (signal: AbortSignal) => Promise<T>, ms = 15000): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([work(controller.signal), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new AdapterError('TIMEOUT', 504)); }, ms);
    })]);
  } finally { clearTimeout(timer!); controller.abort(); }
}
