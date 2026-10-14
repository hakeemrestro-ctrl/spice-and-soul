import { request } from 'node:https';
import { resolve4 } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Readable, Transform, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib';
import { AdapterError, deadline, DESTINATIONS, MAX_BYTES, operation, type Envelope, type Operation } from './protocol';

export function publicIPv4(ip: string) {
  if (isIP(ip) !== 4) return false;
  const [a,b,c] = ip.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}
export async function resolveUpstream(hostname: string, resolver: (host: string) => Promise<string[]> = resolve4) {
  const addresses = await resolver(hostname);
  if (!addresses.length || addresses.some(ip => !publicIPv4(ip))) throw new AdapterError('UNSAFE_DNS', 502);
  return addresses[0]; // Pin this address for this connection; TLS still verifies hostname.
}
function limiter() {
  let bytes = 0;
  return new Transform({ transform(chunk, _encoding, done) {
    bytes += chunk.length;
    done(bytes > MAX_BYTES ? new AdapterError('RESPONSE_TOO_LARGE', 502) : null, chunk);
  } });
}
export async function decodeResponse(status: number, type: string, encoding: string, source: Readable, signal?: AbortSignal) {
  if (status < 200 || status >= 300) { source.destroy(); throw new AdapterError(status >= 300 && status < 400 ? 'REDIRECT_REJECTED' : 'UPSTREAM_HTTP_ERROR', 502); }
  if (type.split(';')[0].trim().toLowerCase() !== 'application/jose') { source.destroy(); throw new AdapterError('RESPONSE_TYPE', 502); }
  const decoder = encoding === 'gzip' ? createGunzip() : encoding === 'deflate' ? createInflate() :
    encoding === 'br' ? createBrotliDecompress() : encoding === '' || encoding === 'identity' ? new Transform({ transform(c,_e,d) { d(null,c); } }) : null;
  if (!decoder) { source.destroy(); throw new AdapterError('RESPONSE_ENCODING', 502); }
  const chunks: Buffer[] = [];
  await pipeline(source, limiter(), decoder, limiter(), new Writable({ write(c,_e,d) { chunks.push(Buffer.from(c)); d(); } }), { signal });
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
}
export async function sendBilldesk(path: Operation, data: Envelope): Promise<string> {
  operation(path);
  // No test bypass. A false/missing flag prevents DNS lookup and socket creation.
  if (process.env.BILLDESK_UPSTREAM_ENABLED !== 'true') throw new AdapterError('UPSTREAM_DISABLED', 503);
  const expectedPrefix = process.env.BILLDESK_ENV === 'UAT' ? '/uat/' : process.env.BILLDESK_ENV === 'PROD' ? '/prod/' : '';
  if (!expectedPrefix || !path.startsWith(expectedPrefix)) throw new AdapterError('ENVIRONMENT_OPERATION_MISMATCH', 503);
  return deadline(async signal => {
    const started = Date.now();
    const destination = new URL(DESTINATIONS[path]);
    const address = await deadline(() => resolveUpstream(destination.hostname), 5000);
    if (signal.aborted) throw new AdapterError('TIMEOUT', 504);
    return new Promise<string>((resolve, reject) => {
      const req = request(destination, {
        method: 'POST', family: 4, agent: false, signal,
        lookup: (_host, _options, callback) => callback(null, address, 4),
        headers: { 'Content-Type': 'application/jose', Accept: 'application/jose',
          'Accept-Encoding': 'gzip, deflate, br', 'BD-Traceid': data.traceId, 'BD-Timestamp': data.timestamp },
      }, res => {
        clearTimeout(connectTimer);
        decodeResponse(res.statusCode ?? 0, String(res.headers['content-type'] ?? ''), String(res.headers['content-encoding'] ?? ''), res, signal).then(resolve, reject);
      });
      const connectTimer = setTimeout(() => req.destroy(new AdapterError('CONNECT_TIMEOUT', 504)), Math.max(1, 5000 - (Date.now() - started)));
      req.on('socket', socket => socket.once('secureConnect', () => clearTimeout(connectTimer)));
      req.once('error', () => { clearTimeout(connectTimer); reject(new AdapterError('UPSTREAM_UNAVAILABLE', 502)); });
      req.end(data.jose);
    });
  });
}
// Later verification must run in the deployed service context with an explicitly
// approved IP observer. No external diagnostic endpoint is invoked by this module.
export async function verifyObservedEgress(observer: () => Promise<string>, expected = '64.225.85.27') {
  const observed = (await observer()).trim();
  return publicIPv4(observed) && observed === expected;
}
