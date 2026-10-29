import 'server-only';
import { adapterRequest, newOperationId, upstreamEnabled } from './billdesk-adapter-client';
import { operationForEnvironment } from '../adapter/billdesk/protocol';
import { randomUUID, createDecipheriv } from 'node:crypto';
import { compactVerify, CompactSign, CompactEncrypt, compactDecrypt } from 'jose';

export const BILLDESK_ENV = (process.env.BILLDESK_ENV || 'UAT').trim();
export const BILLDESK_MERCID = ((BILLDESK_ENV === 'UAT' && (!process.env.BILLDESK_MERCID || process.env.BILLDESK_MERCID === 'BDUATV2KRL')) ? 'BDUATV2KRL' : (process.env.BILLDESK_MERCID || '')).trim().replace(/^["']|["']$/g, '');
export const BILLDESK_CLIENT_ID = ((BILLDESK_ENV === 'UAT' && (!process.env.BILLDESK_CLIENT_ID || process.env.BILLDESK_CLIENT_ID === 'bduatv2krlsj')) ? 'bduatv2krlsj' : (process.env.BILLDESK_CLIENT_ID || '')).trim().replace(/^["']|["']$/g, '');
export const BILLDESK_KEY_ID = ((BILLDESK_ENV === 'UAT' && (!process.env.BILLDESK_KEY_ID || process.env.BILLDESK_KEY_ID === '0SCWAdFuBgLv')) ? '0SCWAdFuBgLv' : (process.env.BILLDESK_KEY_ID || '')).trim().replace(/^["']|["']$/g, '');
const encryptionPassword = ((BILLDESK_ENV === 'UAT' && (!process.env.BILLDESK_JWE_PASSWORD || process.env.BILLDESK_JWE_PASSWORD === 'TMtsOBn6bXkSXAxE0XBCCiVfUydaRwLf')) ? 'TMtsOBn6bXkSXAxE0XBCCiVfUydaRwLf' : (process.env.BILLDESK_JWE_PASSWORD || '')).trim().replace(/^["']|["']$/g, '');
const signingPassword = ((BILLDESK_ENV === 'UAT' && (!process.env.BILLDESK_JWS_PASSWORD || process.env.BILLDESK_JWS_PASSWORD === 'vna166vLuTwyof7e3xIzHXkuALKLX70s')) ? 'vna166vLuTwyof7e3xIzHXkuALKLX70s' : (process.env.BILLDESK_JWS_PASSWORD || '')).trim().replace(/^["']|["']$/g, '');

export function getBilldeskBaseUrl() {
  if (BILLDESK_ENV === 'UAT') return 'https://uat1.billdesk.com/u2/payments/ve1_2';
  if (BILLDESK_ENV === 'PROD') return 'https://api.billdesk.com/payments/ve1_2';
  return 'https://uat1.billdesk.com/u2/payments/ve1_2';
}

function keys() {
  if (!BILLDESK_MERCID) throw new Error('Missing BILLDESK_MERCID in environment');
  if (!BILLDESK_CLIENT_ID) throw new Error('Missing BILLDESK_CLIENT_ID in environment');
  if (!BILLDESK_KEY_ID) throw new Error('Missing BILLDESK_KEY_ID in environment');
  if (!encryptionPassword) throw new Error('Missing BILLDESK_JWE_PASSWORD in environment');
  if (!signingPassword) throw new Error('Missing BILLDESK_JWS_PASSWORD in environment');

  const encryption = new TextEncoder().encode(encryptionPassword);
  const signing = new TextEncoder().encode(signingPassword);
  if (encryption.byteLength !== 32) throw new Error(`BILLDESK_JWE_PASSWORD must be exactly 32 bytes (got ${encryption.byteLength})`);
  if (signing.byteLength < 32) throw new Error(`BILLDESK_JWS_PASSWORD must be at least 32 bytes (got ${signing.byteLength})`);
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

export const generateOrderId = () => `BD${randomUUID().replaceAll('-', '')}`;
export const generateTraceId = () => `BD${randomUUID().replaceAll('-', '')}`;

function validateHeader(header: Record<string, unknown>, encrypted: boolean) {
  const allowed = new Set(encrypted ? ['alg', 'enc', 'kid', 'clientid', 'mercid', 'typ', 'cty'] : ['alg', 'kid', 'clientid', 'mercid', 'typ', 'cty']);
  const isKeyValid = !header.kid || header.kid === BILLDESK_KEY_ID || header.kid === 'HMAC';
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
  const token = await createJwsToken({ mercid: BILLDESK_MERCID, orderid: orderId, refund_details: "true" });
  const response = await adapterRequest(operationForEnvironment('transactions/get'), {
    operationId: newOperationId(), traceId: generateTraceId(), timestamp: billdeskTimestamp(), jose: token,
  });
  return (await verifyJwsToken(response)).payload;
}

export function decryptBilldeskTokenNative(rawToken: string): Record<string, any> | null {
  try {
    let token = String(rawToken || '').trim().replace(/^["']|["']$/g, '');
    if (token.startsWith('transaction_response=')) {
      token = decodeURIComponent(token.replace('transaction_response=', ''));
    }
    token = token.replace(/^["']|["']$/g, '').trim();

    if (token.startsWith('{') && token.endsWith('}')) {
      try {
        const parsed = JSON.parse(token);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch {}
    }

    const { encryption } = keys();

    const parts = token.split('.');
    let jweStr = token;
    if (parts.length === 3) {
      const [, jwsPayloadB64] = parts;
      jweStr = Buffer.from(jwsPayloadB64, 'base64url').toString('utf8');
    }

    const jweParts = jweStr.split('.');
    if (jweParts.length === 5) {
      const [jweHdrB64, , ivB64, cipherB64, tagB64] = jweParts;
      const decipher = createDecipheriv('aes-256-gcm', encryption, Buffer.from(ivB64, 'base64url'));
      decipher.setAAD(Buffer.from(jweHdrB64, 'ascii'));
      decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(cipherB64, 'base64url')),
        decipher.final()
      ]);
      const json = JSON.parse(decrypted.toString('utf8'));
      if (json && typeof json === 'object') return json;
    }
  } catch (err) {
    console.warn('Native BillDesk decryption fallback error:', err);
  }
  return null;
}

