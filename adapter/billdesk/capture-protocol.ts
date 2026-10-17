import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
export const CAPTURE_PATH = '/uat/email-capture';
export const CAPTURE_MAX = 25 * 1024 * 1024;
export const captureDigest = (body: Uint8Array) => createHash('sha256').update(body).digest('hex');
const canonical = (timestamp: string, nonce: string, body: Uint8Array) => `capture-v1\nPOST\n${CAPTURE_PATH}\n${timestamp}\n${nonce}\n${captureDigest(body)}`;
export function captureHeaders(secret: string, body: Uint8Array, now = Date.now(), nonce = randomUUID()) {
  if (Buffer.byteLength(secret) < 32) throw new Error('Capture secret unavailable');
  const timestamp = String(now);
  return { 'content-type': 'application/json', 'x-capture-time': timestamp, 'x-capture-nonce': nonce,
    'x-capture-signature': createHmac('sha256', secret).update(canonical(timestamp, nonce, body)).digest('hex') };
}
export function verifyCapture(headers: Headers, body: Uint8Array, secret: string, now = Date.now()) {
  const timestamp = headers.get('x-capture-time') || '', nonce = headers.get('x-capture-nonce') || '', signature = headers.get('x-capture-signature') || '';
  if (Buffer.byteLength(secret) < 32 || body.byteLength > CAPTURE_MAX || !/^\d{13}$/.test(timestamp) ||
      Math.abs(now - Number(timestamp)) > 120000 || !/^[a-f0-9-]{36}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(signature) ||
      headers.get('content-type') !== 'application/json' || headers.has('content-encoding')) throw new Error('Capture authentication rejected');
  const expected = createHmac('sha256', secret).update(canonical(timestamp, nonce, body)).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) throw new Error('Capture authentication rejected');
  return nonce;
}
export function validateCaptureBody(body: Uint8Array, allowlist: ReadonlySet<string>) {
  if (body.byteLength > CAPTURE_MAX) throw new Error('Capture body too large');
  const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
  if (!value || Object.keys(value).sort().join(',') !== 'id,mail' ||
      typeof value.id !== 'string' || !/^capture-[a-f0-9]{64}$/.test(value.id)) throw new Error('Invalid capture');
  const mail = value.mail;
  if (!mail || typeof mail !== 'object' || Array.isArray(mail) || mail.captureOnly !== true || mail.delivered !== false ||
      Object.keys(mail).some(k => !['captureOnly','delivered','to','cc','bcc','subject','html','text','attachments'].includes(k)) ||
      typeof mail.subject !== 'string' || mail.subject.length > 1000) throw new Error('Invalid capture');
  const addresses: string[] = [];
  for (const key of ['to','cc','bcc']) {
    if (mail[key] === undefined) continue;
    const list = Array.isArray(mail[key]) ? mail[key] : [mail[key]];
    if (!list.length || list.some((v: unknown) => typeof v !== 'string' || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(v) || !allowlist.has(v.toLowerCase()))) throw new Error('Unapproved capture recipient');
    addresses.push(...list);
  }
  if (!mail.to || !addresses.length || addresses.length > 10) throw new Error('Invalid capture recipient');
  for (const key of ['html','text']) if (mail[key] !== undefined && typeof mail[key] !== 'string') throw new Error('Invalid capture content');
  if (mail.attachments !== undefined && (!Array.isArray(mail.attachments) || mail.attachments.length > 30 ||
      mail.attachments.some((a: Record<string, unknown>) => !a || Object.keys(a).some(k => !['filename','content'].includes(k)) ||
        typeof a.filename !== 'string' || a.filename.length > 255 || typeof a.content !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(a.content)))) throw new Error('Invalid capture attachment');
  return { id: value.id as string, payload: JSON.stringify(mail) };
}
