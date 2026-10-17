import { createServer } from 'node:http';
import { isAbsolute, dirname } from 'node:path';
import { lstatSync } from 'node:fs';
import { CaptureStore } from './capture-store';
import { CAPTURE_PATH, CAPTURE_MAX, validateCaptureBody, verifyCapture } from './capture-protocol';
import { strictHeaders, readLimited, deadline } from './protocol';

// Explicit service entrypoint only. No environment-file loading, SMTP or outbound HTTP.
function start() {
  const secret = process.env.BILLDESK_EMAIL_CAPTURE_SECRET || '';
  const state = process.env.BILLDESK_EMAIL_CAPTURE_STATE || '';
  const allow = new Set((process.env.BILLDESK_EMAIL_CAPTURE_RECIPIENTS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean));
  if (process.env.BILLDESK_ENV !== 'UAT' || process.getuid?.() === 0 || !isAbsolute(state) ||
      state !== '/var/lib/billdesk-uat-mail-capture/capture.sqlite' ||
      Buffer.byteLength(secret) < 32 || !allow.size) throw new Error();
  const parent = lstatSync(dirname(state));
  if (!parent.isDirectory() || parent.isSymbolicLink() || (parent.mode & 0o077) || parent.uid !== process.getuid?.()) throw new Error();
  try {
    const existing = lstatSync(state);
    if (!existing.isFile() || existing.isSymbolicLink() || (existing.mode & 0o077) || existing.uid !== process.getuid?.()) throw new Error();
  } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  process.umask(0o077);
  const store = new CaptureStore(state);
  const server = createServer({ maxHeaderSize: 8192 }, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Connection', 'close');
    res.setHeader('Content-Type', 'application/json'); res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'POST' || req.url !== CAPTURE_PATH) { res.writeHead(404); res.end('{"error":"NOT_FOUND"}'); return; }
    try {
      const headers = strictHeaders(req.rawHeaders);
      const body = await deadline(async signal => {
        const abort = () => req.destroy(); signal.addEventListener('abort', abort, { once: true });
        try { return await readLimited(req, CAPTURE_MAX); } finally { signal.removeEventListener('abort', abort); }
      }, 10000);
      const nonce = verifyCapture(headers, body, secret);
      const value = validateCaptureBody(body, allow);
      const receipt = store.capture(value.id, value.payload, nonce, Date.now());
      res.writeHead(200); res.end(JSON.stringify(receipt));
    } catch { if (!res.destroyed) { res.writeHead(503); res.end('{"error":"CAPTURE_REVIEW_REQUIRED"}'); } }
  });
  server.requestTimeout = 10000; server.headersTimeout = 5000; server.maxConnections = 8;
  server.on('clientError', (_e, socket) => socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'));
  server.on('error', () => { console.error('Capture service unavailable'); store.close(); process.exitCode = 1; });
  server.listen(3101, '127.0.0.1');
  for (const signal of ['SIGTERM','SIGINT'] as const) process.on(signal, () => server.close(() => store.close()));
}
try { start(); } catch { console.error('Capture configuration unavailable'); process.exitCode = 1; }
