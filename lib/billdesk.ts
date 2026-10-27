import 'server-only';
import { adapterRequest, newOperationId, upstreamEnabled } from './billdesk-adapter-client';
import { operationForEnvironment } from '../adapter/billdesk/protocol';
import { randomUUID } from 'node:crypto';
import { compactVerify, CompactSign, CompactEncrypt, compactDecrypt } from 'jose';

export const BILLDESK_ENV = process.env.BILLDESK_ENV || 'UAT';
export const BILLDESK_MERCID = process.env.BILLDESK_MERCID || '';
export const BILLDESK_CLIENT_ID = process.env.BILLDESK_CLIENT_ID || '';
export const BILLDESK_KEY_ID = process.env.BILLDESK_KEY_ID || '';
const encryptionPassword = process.env.BILLDESK_JWE_PASSWORD || '';
const signingPassword = process.env.BILLDESK_JWS_PASSWORD || '';

export function getBilldeskBaseUrl() {
  if (BILLDESK_ENV === 'UAT') return 'https://uat1.billdesk.com/u2/payments/ve1_2';
  if (BILLDESK_ENV === 'PROD') return 'https://api.billdesk.com/payments/ve1_2';
  throw new Error('Unsupported BillDesk environment');
}

function keys() {
  if (!BILLDESK_MERCID || !BILLDESK_CLIENT_ID || !BILLDESK_KEY_ID) throw new Error('Missing BillDesk identifiers');
  // BillDesk's sample uses raw string bytes, not base64 decoding, hashing or
  // truncation. Default to standard UTF-8 and HS256.
  const encoding = process.env.BILLDESK_KEY_ENCODING || 'utf8';
  const algorithm = process.env.BILLDESK_JWS_ALGORITHM || 'HS256';
  if (encoding !== 'utf8' || algorithm !== 'HS256') {
    throw new Error('BillDesk key encoding and signing algorithm require explicit configuration');
  }
  const encryption = new TextEncoder().encode(encryptionPassword);
  const signing = new TextEncoder().encode(signingPassword);
  if (encryption.byteLength !== 32 || signing.byteLength < 32) throw new Error('Invalid BillDesk key length');
  return { encryption, signing };
}

export function billdeskTimestamp(now = new Date()) {
  const mode = process.env.BILLDESK_TIMESTAMP_FORMAT || 'ist-calendar';
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid timestamp');
  if (mode === 'ist-calendar') return new Date(now.getTime() + 19800000).toISOString().replace(/[-:T]/g, '').slice(0, 14);
  if (mode === 'epoch-seconds') return String(Math.floor(now.getTime() / 1000));
  if (mode === 'epoch-milliseconds') return String(now.getTime());
  throw new Error('BillDesk timestamp format requires explicit configuration');
}

export function auditBilldeskConfig() {
  getBilldeskBaseUrl();
  keys();
  billdeskTimestamp();
  return { configured: true };
}

export const generateOrderId = () => `BD_${randomUUID().replaceAll('-', '')}`;
export const generateTraceId = () => `BD${randomUUID().replaceAll('-', '')}`;

function validateHeader(header: Record<string, unknown>, encrypted: boolean) {
  const allowed = new Set(encrypted ? ['alg', 'enc', 'kid', 'clientid', 'mercid'] : ['alg', 'kid', 'clientid', 'mercid']);
  const isKeyValid = header.kid === BILLDESK_KEY_ID || header.kid === 'HMAC';
  const isClientValid = !header.clientid || header.clientid === BILLDESK_CLIENT_ID;
  if (Object.keys(header).some(k => !allowed.has(k)) || header.alg !== (encrypted ? 'dir' : 'HS256') ||
      (encrypted && header.enc !== 'A256GCM') || !isKeyValid || !isClientValid) {
    throw new Error('Unexpected BillDesk JOSE header');
  }
}

export async function createJwsToken(payload: Record<string, unknown>) {
  const { encryption, signing } = keys();
  const jwe = await new CompactEncrypt(new TextEncoder().encode(JSON.stringify(payload)))
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM', kid: BILLDESK_KEY_ID, clientid: BILLDESK_CLIENT_ID }).encrypt(encryption);
  return new CompactSign(new TextEncoder().encode(jwe))
    .setProtectedHeader({ alg: 'HS256', kid: BILLDESK_KEY_ID, clientid: BILLDESK_CLIENT_ID }).sign(signing);
}

export async function verifyJwsToken(token: string) {
  const { encryption, signing } = keys();
  try {
    if (typeof token !== 'string' || token.length > 262144) throw new Error();
    const { payload, protectedHeader: jwsHeader } = await compactVerify(token, signing, { algorithms: ['HS256'] });
    validateHeader(jwsHeader, false);
    const { plaintext, protectedHeader: jweHeader } = await compactDecrypt(
      new TextDecoder('utf-8', { fatal: true }).decode(payload), encryption,
      { keyManagementAlgorithms: ['dir'], contentEncryptionAlgorithms: ['A256GCM'] },
    );
    validateHeader(jweHeader, true);
    const json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
    if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error();
    return { payload: json, jwsHeader, jweHeader };
  } catch { throw new Error('Invalid BillDesk JOSE message'); }
}

export async function getBillDeskTransactionStatus(orderId: string) {
  if (!upstreamEnabled()) throw new Error('UPSTREAM_DISABLED');
  auditBilldeskConfig();
  const token = await createJwsToken({ mercid: BILLDESK_MERCID, orderid: orderId, refund_details: true });
  const response = await adapterRequest(operationForEnvironment('transactions/get'), {
    operationId: newOperationId(), traceId: generateTraceId(), timestamp: billdeskTimestamp(), jose: token,
  });
  return (await verifyJwsToken(response)).payload;
}
