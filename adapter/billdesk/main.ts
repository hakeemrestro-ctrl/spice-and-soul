import { createServer } from 'node:http';
import { isAbsolute } from 'node:path';
import { NonceStore } from './store';
import { createAdapter } from './service';
import { AdapterError, deadline, operation, readLimited, strictHeaders } from './protocol';

// Start explicitly using Node 24 + tsx after reviewing adapter/README.txt.
// Does not load .env.local. Bind only to loopback behind a future HTTPS proxy.
function start() {
  if (!['UAT','PROD'].includes(process.env.BILLDESK_ENV || '')) throw new Error('BillDesk configuration required');
  const key = process.env.BILLDESK_ADAPTER_AUTH_KEY_ID ?? '';
  const secret = process.env.BILLDESK_ADAPTER_AUTH_SECRET ?? '';
  const state = process.env.BILLDESK_ADAPTER_STATE_PATH;
  if (!/^[A-Za-z0-9-]{1,64}$/.test(key) || Buffer.byteLength(secret) < 32 || !state || !isAbsolute(state)) throw new Error('Adapter configuration required');
  process.umask(0o077);
  const store = new NonceStore(state);
  const handle = createAdapter(store, key, secret);
  const server = createServer({ maxHeaderSize: 8192 }, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Connection', 'close');
    try {
      operation(req.url ?? '');
      if (req.method !== 'POST') throw new AdapterError('METHOD_NOT_ALLOWED', 405);
      // Reject ambiguous duplicate authentication/content headers before Headers merges them.
      const headers = strictHeaders(req.rawHeaders);
      const body = await deadline(async signal => {
        const abort = () => { req.destroy(); };
        signal.addEventListener('abort', abort, { once: true });
        // Remove listener before deadline's final abort after successful consumption.
        try { return await readLimited(req); } finally { signal.removeEventListener('abort', abort); }
      }, 10000);
      const response = await handle(req.method, req.url!, headers, body);
      res.writeHead(200, { 'Content-Type': 'application/jose' }); res.end(response);
    } catch (e) {
      const error = e instanceof AdapterError ? e : new AdapterError('ADAPTER_UNAVAILABLE', 503);
      if (!res.destroyed) { res.writeHead(error.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: error.code })); }
    }
  });
  server.requestTimeout = 10000; server.headersTimeout = 5000; server.maxConnections = 64;
  server.on('clientError', (_e,socket) => socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'));
  server.on('error', () => { console.error('Adapter unavailable'); process.exitCode = 1; store.close(); });
  server.listen(3100, '127.0.0.1');
  for (const event of ['SIGTERM','SIGINT'] as const) process.on(event, () => server.close(() => store.close()));
}
try { start(); } catch { console.error('Adapter configuration unavailable'); process.exitCode = 1; }
