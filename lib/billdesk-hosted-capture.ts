import 'server-only';
import { CAPTURE_MAX, captureHeaders } from '../adapter/billdesk/capture-protocol';
export function hostedCaptureConfig() {
  const url = process.env.BILLDESK_EMAIL_CAPTURE_URL;
  const secret = process.env.BILLDESK_EMAIL_CAPTURE_SECRET || '';
  if (process.env.BILLDESK_ENV !== 'UAT' || process.env.BILLDESK_EMAIL_CAPTURE !== 'https' ||
      url !== 'https://adapter.hakeemrestro.shop/uat/email-capture' || Buffer.byteLength(secret) < 32 ||
      [process.env.BILLDESK_ADAPTER_AUTH_SECRET, process.env.BILLDESK_JWS_PASSWORD, process.env.BILLDESK_JWE_PASSWORD].includes(secret)) {
    throw new Error('Hosted capture configuration unavailable');
  }
  return { url, secret };
}
export async function sendHostedCapture(id: string, mailJson: string, transport: typeof fetch = fetch) {
  const { url, secret } = hostedCaptureConfig();
  const body = Buffer.from(JSON.stringify({ id, mail: JSON.parse(mailJson) }));
  if (body.length > CAPTURE_MAX) throw new Error('Capture exceeds size limit');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const abort = () => { void reader?.cancel().catch(() => {}); };
  controller.signal.addEventListener('abort', abort);
  try {
    const response = await transport(url, { method: 'POST', body, headers: captureHeaders(secret, body),
      redirect: 'error', signal: controller.signal, cache: 'no-store' });
    if (response.status !== 200 || response.redirected || response.headers.get('content-type')?.split(';')[0] !== 'application/json' || !response.body) throw new Error();
    reader = response.body.getReader();
    if (controller.signal.aborted) throw new Error();
    let size = 0; const chunks: Uint8Array[] = [];
    while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 1024) throw new Error(); chunks.push(part.value); }
    if (controller.signal.aborted) throw new Error();
    const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (Object.keys(result).sort().join(',') !== 'delivered,messageId,status' || result.messageId !== id || result.status !== 'captured' || result.delivered !== false) throw new Error();
    return { messageId: id, status: 'captured' as const, delivered: false as const };
  } catch { throw new Error('Hosted capture acceptance unavailable'); }
  finally { clearTimeout(timer); controller.signal.removeEventListener('abort', abort); void reader?.cancel().catch(() => {}); }
}
