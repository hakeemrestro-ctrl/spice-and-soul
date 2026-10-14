// BillDesk Static IP Adapter - Standalone Node 24 ESM Service
// Zero external npm dependencies. Uses only Node built-in standard library.
// Listens strictly on 127.0.0.1:3100 behind loopback.

import { createServer } from 'node:http';
import { request } from 'node:https';
import { resolve4 } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isAbsolute } from 'node:path';
import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib';
import { createHash, createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

// ============================================================================
// 1. PROTOCOL DEFINITIONS & ENVELOPE VALIDATION
// ============================================================================

export const MAX_BYTES = 256 * 1024;
export const PATHS = ['/uat/orders/create', '/uat/transactions/get', '/prod/orders/create', '/prod/transactions/get'];
export const DESTINATIONS = Object.freeze({
  '/uat/orders/create': 'https://uat1.billdesk.com/u2/payments/ve1_2/orders/create',
  '/uat/transactions/get': 'https://uat1.billdesk.com/u2/payments/ve1_2/transactions/get',
  '/prod/orders/create': 'https://api.billdesk.com/payments/ve1_2/orders/create',
  '/prod/transactions/get': 'https://api.billdesk.com/payments/ve1_2/transactions/get',
});

export function operationForEnvironment(kind) {
  if (process.env.BILLDESK_ENV === 'UAT') return `/uat/${kind}`;
  if (process.env.BILLDESK_ENV === 'PROD') return `/prod/${kind}`;
  throw new AdapterError('INVALID_ENVIRONMENT', 503);
}

export class AdapterError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export function operation(path) {
  if (!PATHS.includes(path)) throw new AdapterError('INVALID_OPERATION', 404);
  return path;
}

export function envelope(body) {
  if (body.byteLength > MAX_BYTES) throw new AdapterError('REQUEST_TOO_LARGE', 413);
  let v;
  try {
    v = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
  } catch {
    throw new AdapterError('INVALID_BODY');
  }
  if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort().join(',') !== 'jose,operationId,timestamp,traceId' ||
      typeof v.operationId !== 'string' || !/^[A-Za-z0-9-]{16,64}$/.test(v.operationId) ||
      typeof v.traceId !== 'string' || !/^[A-Za-z0-9]{1,35}$/.test(v.traceId) ||
      typeof v.timestamp !== 'string' || !/^\d{10,14}$/.test(v.timestamp) ||
      typeof v.jose !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v.jose)) {
    throw new AdapterError('INVALID_BODY');
  }
  return v;
}

export const digest = (body) => createHash('sha256').update(body).digest('hex');

export function strictHeaders(raw) {
  const seen = new Set(), headers = new Headers();
  if (raw.length % 2) throw new AdapterError('INVALID_HEADER');
  for (let i = 0; i < raw.length; i += 2) {
    const name = raw[i].toLowerCase();
    if (seen.has(name)) throw new AdapterError('DUPLICATE_HEADER');
    seen.add(name);
    headers.set(name, raw[i + 1]);
  }
  return headers;
}

export function authHeaders(key, secret, path, body, now = Date.now()) {
  const nonce = randomUUID(), timestamp = String(Math.floor(now / 1000));
  const payload = ['v1', key, 'POST', path, timestamp, nonce, digest(body)].join('\n');
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  return {
    'x-adapter-key-id': key,
    'x-adapter-timestamp': timestamp,
    'x-adapter-nonce': nonce,
    'x-adapter-signature': signature,
  };
}

export function authenticate(headers, method, path, body, key, secret, now = Date.now()) {
  const reqKey = headers.get('x-adapter-key-id');
  const reqTime = headers.get('x-adapter-timestamp');
  const reqNonce = headers.get('x-adapter-nonce');
  const reqSig = headers.get('x-adapter-signature');

  if (!reqKey || !reqTime || !reqNonce || !reqSig) throw new AdapterError('MISSING_AUTH_HEADERS', 401);
  if (!/^[A-Za-z0-9-]{1,64}$/.test(reqKey) || !/^\d{10}$/.test(reqTime) ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(reqNonce) ||
      !/^[a-f0-9]{64}$/.test(reqSig)) {
    throw new AdapterError('MALFORMED_AUTH_HEADERS', 401);
  }
  if (Math.abs(Math.floor(now / 1000) - Number(reqTime)) > 120) throw new AdapterError('TIMESTAMP_OUT_OF_RANGE', 401);

  const payload = ['v1', reqKey, method, path, reqTime, reqNonce, digest(body)].join('\n');
  const expectedSig = createHmac('sha256', secret).update(payload).digest('hex');
  const expectedKey = Buffer.from(key), actualKey = Buffer.from(reqKey);
  const expectedHmac = Buffer.from(expectedSig), actualHmac = Buffer.from(reqSig);

  const keyMatch = expectedKey.length === actualKey.length && timingSafeEqual(expectedKey, actualKey);
  const sigMatch = expectedHmac.length === actualHmac.length && timingSafeEqual(expectedHmac, actualHmac);
  if (!keyMatch || !sigMatch) throw new AdapterError('INVALID_AUTH', 401);

  return reqNonce;
}

export function deadline(task, timeoutMs) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(new AdapterError('TIMEOUT', 504)), timeoutMs);
  return task(ac.signal).finally(() => clearTimeout(timer));
}

export async function readLimited(stream, maxBytes = MAX_BYTES) {
  let bytes = 0;
  const chunks = [];
  for await (const chunk of stream) {
    bytes += chunk.length;
    if (bytes > maxBytes) throw new AdapterError('REQUEST_TOO_LARGE', 413);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// ============================================================================
// 2. DURABLE NONCE STORE & RATE LIMITER (SQLite WAL MODE)
// ============================================================================

export class NonceStore {
  constructor(statePath) {
    this.db = new DatabaseSync(statePath);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=2000;
      CREATE TABLE IF NOT EXISTS nonces (key TEXT, nonce TEXT, expires INTEGER NOT NULL, PRIMARY KEY(key,nonce));
      CREATE TABLE IF NOT EXISTS operations (key TEXT, id TEXT, fingerprint TEXT NOT NULL, state TEXT NOT NULL, PRIMARY KEY(key,id));`);
  }
  consume(key, nonce, now) {
    try {
      this.db.exec('BEGIN IMMEDIATE');
      this.db.prepare('DELETE FROM nonces WHERE expires < ?').run(now);
      if (this.db.prepare('SELECT 1 FROM nonces WHERE key=? AND nonce=?').get(key, nonce)) throw new AdapterError('REPLAY', 409);
      this.db.prepare('INSERT INTO nonces VALUES (?,?,?)').run(key, nonce, now + 300000);
      this.db.exec('COMMIT');
    } catch (e) {
      try { this.db.exec('ROLLBACK'); } catch {}
      if (e instanceof AdapterError) throw e;
      throw new AdapterError('NONCE_STORE_UNAVAILABLE', 503);
    }
  }
  claim(key, id, fingerprint) {
    try {
      this.db.exec('BEGIN IMMEDIATE');
      if (this.db.prepare('SELECT 1 FROM operations WHERE key=? AND id=?').get(key, id)) throw new AdapterError('OPERATION_ALREADY_ATTEMPTED', 409);
      this.db.prepare('INSERT INTO operations VALUES (?,?,?,?)').run(key, id, fingerprint, 'started');
      this.db.exec('COMMIT');
    } catch (e) {
      try { this.db.exec('ROLLBACK'); } catch {}
      if (e instanceof AdapterError) throw e;
      throw new AdapterError('OPERATION_STORE_UNAVAILABLE', 503);
    }
  }
  finish(key, id, state) {
    try {
      this.db.prepare('UPDATE operations SET state=? WHERE key=? AND id=?').run(state, key, id);
    } catch {
      throw new AdapterError('OPERATION_STORE_UNAVAILABLE', 503);
    }
  }
  close() {
    this.db.close();
  }
}

export class Limits {
  constructor() {
    this.clients = new Map();
    this.active = 0;
  }
  enter(key, now) {
    const state = this.clients.get(key) ?? { tokens: 5, at: now };
    state.tokens = Math.min(5, state.tokens + Math.max(0, now - state.at) / 2000);
    state.at = now;
    this.clients.set(key, state);
    if (state.tokens < 1) throw new AdapterError('RATE_LIMIT', 429);
    if (this.active >= 4) throw new AdapterError('CONCURRENCY_LIMIT', 429);
    state.tokens--;
    this.active++;
    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.active--;
      }
    };
  }
}

// ============================================================================
// 3. SECURE UPSTREAM DISPATCH (IPv4 DNS PINNING & TLS VALIDATION)
// ============================================================================

export function publicIPv4(ip) {
  if (isIP(ip) !== 4) return false;
  const [a, b, c] = ip.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}

export async function resolveUpstream(hostname, resolver = resolve4) {
  const addresses = await resolver(hostname);
  if (!addresses.length || addresses.some(ip => !publicIPv4(ip))) throw new AdapterError('UNSAFE_DNS', 502);
  return addresses[0];
}

function limiter() {
  let bytes = 0;
  return new Transform({
    transform(chunk, _encoding, done) {
      bytes += chunk.length;
      done(bytes > MAX_BYTES ? new AdapterError('RESPONSE_TOO_LARGE', 502) : null, chunk);
    }
  });
}

export async function decodeResponse(status, type, encoding, source, signal) {
  if (status < 200 || status >= 300) {
    source.destroy();
    throw new AdapterError(status >= 300 && status < 400 ? 'REDIRECT_REJECTED' : 'UPSTREAM_HTTP_ERROR', 502);
  }
  if (type.split(';')[0].trim().toLowerCase() !== 'application/jose') {
    source.destroy();
    throw new AdapterError('RESPONSE_TYPE', 502);
  }
  const decoder = encoding === 'gzip' ? createGunzip() : encoding === 'deflate' ? createInflate() :
    encoding === 'br' ? createBrotliDecompress() : encoding === '' || encoding === 'identity' ? new Transform({ transform(c, _e, d) { d(null, c); } }) : null;
  if (!decoder) {
    source.destroy();
    throw new AdapterError('RESPONSE_ENCODING', 502);
  }
  const chunks = [];
  await pipeline(source, limiter(), decoder, limiter(), new Writable({ write(c, _e, d) { chunks.push(Buffer.from(c)); d(); } }), { signal });
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
}

export async function sendBilldesk(path, data) {
  operation(path);
  if (process.env.BILLDESK_UPSTREAM_ENABLED !== 'true') throw new AdapterError('UPSTREAM_DISABLED', 503);
  const expectedPrefix = process.env.BILLDESK_ENV === 'UAT' ? '/uat/' : process.env.BILLDESK_ENV === 'PROD' ? '/prod/' : '';
  if (!expectedPrefix || !path.startsWith(expectedPrefix)) throw new AdapterError('ENVIRONMENT_OPERATION_MISMATCH', 503);

  return deadline(async (signal) => {
    const started = Date.now();
    const destination = new URL(DESTINATIONS[path]);
    const address = await deadline(() => resolveUpstream(destination.hostname), 5000);
    if (signal.aborted) throw new AdapterError('TIMEOUT', 504);

    return new Promise((resolve, reject) => {
      const req = request(destination, {
        method: 'POST',
        family: 4,
        agent: false,
        signal,
        lookup: (_host, _options, callback) => callback(null, address, 4),
        headers: {
          'Content-Type': 'application/jose',
          Accept: 'application/jose',
          'Accept-Encoding': 'gzip, deflate, br',
          'BD-Traceid': data.traceId,
          'BD-Timestamp': data.timestamp,
        },
      }, res => {
        clearTimeout(connectTimer);
        decodeResponse(res.statusCode ?? 0, String(res.headers['content-type'] ?? ''), String(res.headers['content-encoding'] ?? ''), res, signal).then(resolve, reject);
      });
      const connectTimer = setTimeout(() => req.destroy(new AdapterError('CONNECT_TIMEOUT', 504)), Math.max(1, 5000 - (Date.now() - started)));
      req.on('error', err => { clearTimeout(connectTimer); reject(err instanceof AdapterError ? err : new AdapterError('UPSTREAM_CONNECT_FAILED', 502)); });
      req.end(data.jose);
    });
  }, 15000);
}

// ============================================================================
// 4. ADAPTER SERVICE LOGIC
// ============================================================================

export function createAdapter(store, key, secret) {
  const limits = new Limits();
  return async (method, path, headers, body, now = Date.now()) => {
    const op = operation(path);
    if (headers.has('authorization') || headers.has('proxy-authorization')) throw new AdapterError('FORBIDDEN_HEADER');
    if (headers.get('content-type') !== 'application/json' || headers.has('content-encoding')) throw new AdapterError('INVALID_CONTENT_TYPE', 415);
    const nonce = authenticate(headers, method, op, body, key, secret, now);
    const release = limits.enter(key, now);
    try {
      store.consume(key, nonce, now);
      const data = envelope(body);
      if (data.operationId === nonce) throw new AdapterError('OPERATION_NONCE_COLLISION');
      if (process.env.BILLDESK_UPSTREAM_ENABLED !== 'true') throw new AdapterError('UPSTREAM_DISABLED', 503);
      if (!['UAT', 'PROD'].includes(process.env.BILLDESK_ENV || '')) throw new AdapterError('INVALID_ENVIRONMENT', 503);
      store.claim(key, data.operationId, digest(Buffer.from(op + '\n' + digest(body))));
      try {
        const response = await sendBilldesk(op, data);
        store.finish(key, data.operationId, 'responded');
        return response;
      } catch {
        store.finish(key, data.operationId, 'unknown');
        throw new AdapterError('UPSTREAM_OUTCOME_UNKNOWN', 502);
      }
    } finally {
      release();
    }
  };
}

// ============================================================================
// 5. SERVER ENTRYPOINT & LIFECYCLE
// ============================================================================

export function startServer() {
  if (!['UAT', 'PROD'].includes(process.env.BILLDESK_ENV || '')) throw new Error('BillDesk configuration required');
  const key = process.env.BILLDESK_ADAPTER_AUTH_KEY_ID ?? '';
  const secret = process.env.BILLDESK_ADAPTER_AUTH_SECRET ?? '';
  const state = process.env.BILLDESK_ADAPTER_STATE_PATH;
  if (!/^[A-Za-z0-9-]{1,64}$/.test(key) || Buffer.byteLength(secret) < 32 || !state || !isAbsolute(state)) {
    throw new Error('Adapter configuration required');
  }

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
      const headers = strictHeaders(req.rawHeaders);
      const body = await deadline(async (signal) => {
        const abort = () => { req.destroy(); };
        signal.addEventListener('abort', abort, { once: true });
        try { return await readLimited(req); } finally { signal.removeEventListener('abort', abort); }
      }, 10000);
      const response = await handle(req.method, req.url, headers, body);
      res.writeHead(200, { 'Content-Type': 'application/jose' });
      res.end(response);
    } catch (e) {
      const error = e instanceof AdapterError ? e : new AdapterError('ADAPTER_UNAVAILABLE', 503);
      if (!res.destroyed) {
        res.writeHead(error.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.code }));
      }
    }
  });

  server.requestTimeout = 10000;
  server.headersTimeout = 5000;
  server.maxConnections = 64;
  server.on('clientError', (_e, socket) => socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'));
  server.on('error', () => {
    console.error('Adapter unavailable');
    process.exitCode = 1;
    store.close();
  });

  server.listen(3100, '127.0.0.1', () => {
    console.log('BillDesk adapter listening on 127.0.0.1:3100 (upstream enabled: ' + (process.env.BILLDESK_UPSTREAM_ENABLED === 'true') + ')');
  });

  for (const event of ['SIGTERM', 'SIGINT']) {
    process.on(event, () => server.close(() => store.close()));
  }

  return { server, store };
}

// Auto-start if executed directly via Node CLI
if (process.argv[1] && process.argv[1].endsWith('adapter.mjs')) {
  try {
    startServer();
  } catch (e) {
    console.error('Adapter startup failed:', e.message);
    process.exit(1);
  }
}
