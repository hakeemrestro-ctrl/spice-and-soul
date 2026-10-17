import 'server-only';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import type { Resend } from 'resend';
import { hostedCaptureConfig, sendHostedCapture } from './billdesk-hosted-capture';

type Mail = Parameters<Resend['emails']['send']>[0];

export function assertBilldeskCaptureReady(recipients: readonly string[]) {
  const hosted = process.env.BILLDESK_EMAIL_CAPTURE === 'https';
  if (process.env.BILLDESK_ENV !== 'UAT' || (!hosted && (process.env.BILLDESK_EMAIL_CAPTURE !== 'local' || process.env.VERCEL))) {
    throw new Error('UAT email capture disabled');
  }
  const root = process.env.BILLDESK_EMAIL_CAPTURE_DIR || '';
  if (hosted) hostedCaptureConfig();
  if (!hosted && !isAbsolute(root)) throw new Error('Invalid capture configuration');
  // Restrict local capture to a dedicated temporary namespace, never arbitrary
  // project/public paths. These files are previews, not a durable mail service.
  const base = join(tmpdir(), 'billdesk-uat-capture');
  const child = relative(base, root);
  if (!hosted && (!child || child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child))) throw new Error('Capture must be outside repository in private capture namespace');
  const allow = new Set((process.env.BILLDESK_EMAIL_CAPTURE_RECIPIENTS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean));
  if (!recipients.length || recipients.some(value => !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value) || !allow.has(value.toLowerCase()))) {
    throw new Error('Capture recipient not approved');
  }
  return hosted ? '' : join(base, child);
}

/** Private UAT capture via local storage or authenticated HTTPS; never mail delivery. */
export async function captureBilldeskEmail(mail: Mail, idempotencyKey: string) {
  const recipients = [mail.to, mail.cc, mail.bcc].flatMap(value => value === undefined ? [] : Array.isArray(value) ? value : [value]);
  const root = assertBilldeskCaptureReady(recipients);
  if (!idempotencyKey || idempotencyKey.length > 200) throw new Error('Invalid capture configuration');
  // Do not allow attachments that could cause remote/local resource retrieval.
  if (mail.attachments?.some(a => a.path || a.content === undefined)) throw new Error('Capture requires inline attachments');
  const html = mail.react ? (await import('react-dom/server')).renderToStaticMarkup(mail.react) : mail.html;
  const body = JSON.stringify({ captureOnly: true, delivered: false, to: mail.to, cc: mail.cc, bcc: mail.bcc,
    subject: mail.subject, html, text: mail.text,
    attachments: mail.attachments?.map(a => ({ filename: a.filename, content: Buffer.isBuffer(a.content) ? a.content.toString('base64') : a.content })) });
  if (Buffer.byteLength(body) > 25 * 1024 * 1024) throw new Error('Capture exceeds size limit');
  const id = 'capture-' + createHash('sha256').update(idempotencyKey).digest('hex');
  if (process.env.BILLDESK_EMAIL_CAPTURE === 'https') return sendHostedCapture(id, body);
  await mkdir(/* turbopackIgnore: true */ root, { recursive: true, mode: 0o700 });
  const metadata = await lstat(/* turbopackIgnore: true */ root);
  if (metadata.isSymbolicLink() || !metadata.isDirectory() || resolve(await realpath(/* turbopackIgnore: true */ root)) !== resolve(root) ||
      (process.platform !== 'win32' && (metadata.mode & 0o077) !== 0)) throw new Error('Capture directory not private');
  const path = join(/* turbopackIgnore: true */ root, id + '.json');
  try { await writeFile(/* turbopackIgnore: true */ path, body, { flag: 'wx', mode: 0o600 }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw new Error('Capture write failed');
    const existing = await lstat(/* turbopackIgnore: true */ path);
    if (!existing.isFile() || existing.isSymbolicLink() || existing.size > 25 * 1024 * 1024 ||
        (process.platform !== 'win32' && (existing.mode & 0o077) !== 0) || await readFile(/* turbopackIgnore: true */ path, 'utf8') !== body) {
      throw new Error('Capture retry requires review');
    }
  }
  return { messageId: id, status: 'captured' as const, delivered: false as const };
}
