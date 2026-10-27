import https from 'node:https';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function base64url(buf) { return Buffer.from(buf).toString('base64url'); }
function base64urlDecode(str) { return Buffer.from(str, 'base64url').toString('utf8'); }

// 1. Read .env.local
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const MERCID = process.env.BILLDESK_MERCID || 'BDUATV2KRL';
const CLIENT_ID = process.env.BILLDESK_CLIENT_ID || 'bduatv2krlsj';
const KEY_ID = process.env.BILLDESK_KEY_ID || '0SCWAdFuBgLv';
const JWE_PASSWORD = process.env.BILLDESK_JWE_PASSWORD || 'TMtsOBn6bXkSXAxE0XBCCiVfUydaRwLf';
const JWS_PASSWORD = process.env.BILLDESK_JWS_PASSWORD || 'vna166vLuTwyof7e3xIzHXkuALKLX70s';

const encKey = Buffer.from(JWE_PASSWORD, 'utf8');
const signKey = Buffer.from(JWS_PASSWORD, 'utf8');

const adapterKey = process.env.BILLDESK_ADAPTER_AUTH_KEY_ID || 'uat-adapter-key-1';
const adapterSecret = process.env.BILLDESK_ADAPTER_AUTH_SECRET || '5b10aeae8718464ed1e2f60de8685eb3638bd34f124c94e72f699268d241f5f5';

function createJoseTokens(jsonPayload) {
  const jweHeaderJson = JSON.stringify({ alg: 'dir', enc: 'A256GCM', kid: KEY_ID, clientid: CLIENT_ID });
  const jweHeaderB64 = base64url(Buffer.from(jweHeaderJson, 'utf8'));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  cipher.setAAD(Buffer.from(jweHeaderB64, 'ascii'));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(jsonPayload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const jwe = `${jweHeaderB64}..${base64url(iv)}.${base64url(ciphertext)}.${base64url(tag)}`;

  const jwsHeaderJson = JSON.stringify({ alg: 'HS256', kid: KEY_ID, clientid: CLIENT_ID });
  const jwsHeaderB64 = base64url(Buffer.from(jwsHeaderJson, 'utf8'));
  const jwsPayloadB64 = base64url(Buffer.from(jwe, 'utf8'));
  const signInput = `${jwsHeaderB64}.${jwsPayloadB64}`;
  const hmac = crypto.createHmac('sha256', signKey).update(signInput).digest();
  const jws = `${signInput}.${base64url(hmac)}`;

  return { jwe, jws };
}

function decryptJoseToken(token) {
  const [jwsHdrB64, jwsPayloadB64] = token.split('.');
  const jweStr = Buffer.from(jwsPayloadB64, 'base64url').toString('utf8');
  const [jweHdrB64, , ivB64, cipherB64, tagB64] = jweStr.split('.');

  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, Buffer.from(ivB64, 'base64url'));
  decipher.setAAD(Buffer.from(jweHdrB64, 'ascii'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(cipherB64, 'base64url')), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

async function sendAdapterRequest(adapterPath, operationId, traceId, timestamp, jws) {
  const body = Buffer.from(JSON.stringify({
    jose: jws,
    operationId,
    timestamp,
    traceId
  }));
  const digest = crypto.createHash('sha256').update(body).digest('hex');
  const nowSec = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID();
  const canonical = ['v1', adapterKey, 'POST', adapterPath, nowSec, nonce, digest].join('\n');
  const sig = crypto.createHmac('sha256', adapterSecret).update(canonical).digest('hex');

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'adapter.hakeemrestro.shop',
      port: 443,
      path: adapterPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-adapter-version': '1',
        'x-adapter-key-id': adapterKey,
        'x-adapter-timestamp': nowSec,
        'x-adapter-nonce': nonce,
        'x-adapter-signature': sig,
        'Content-Length': body.length
      },
      timeout: 20000
    }, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: b }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const out = {};

  // -------------------------------------------------------------
  // PROOF 1, 2, 3: Create Order API with Additional Info 1-7
  // -------------------------------------------------------------
  const now = new Date();
  const offsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + offsetMs);
  const orderDate = istDate.toISOString().slice(0, 19) + '+05:30';
  const orderId = `BD_${Date.now()}`;
  const traceId1 = `BD${crypto.randomUUID().replaceAll('-', '')}`;
  const timestamp1 = istDate.toISOString().replace(/[-:T]/g, '').slice(0, 14);

  const createOrderJson = {
    mercid: MERCID,
    orderid: orderId,
    amount: '12499.00',
    order_date: orderDate,
    currency: '356',
    ru: 'https://hakeemrestro.shop/api/billdesk/callback',
    additional_info: {
      additional_info1: 'khushboo@hakeemrestro.shop',
      additional_info2: 'North Indian Cooking Course',
      additional_info3: 'Online Masterclass',
      additional_info4: 'NA',
      additional_info5: 'NA',
      additional_info6: 'NA',
      additional_info7: 'NA'
    },
    itemcode: 'DIRECT',
    device: {
      init_channel: 'internet',
      ip: '103.211.54.10',
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  };

  const { jwe: jwe1, jws: jws1 } = createJoseTokens(createOrderJson);
  const res1 = await sendAdapterRequest('/uat/orders/create', orderId.replaceAll('_', '-'), traceId1, timestamp1, jws1);
  const decodedResponse1 = decryptJoseToken(res1.body);

  out.proof1_createOrderJson = createOrderJson;
  out.proof2_createOrderJwe = jwe1;
  out.proof2_createOrderJws = jws1;
  out.proof2_traceId = traceId1;
  out.proof2_timestamp = timestamp1;
  out.proof3_createOrderResponseEncoded = res1.body;
  out.proof3_createOrderResponseDecoded = decodedResponse1;

  // -------------------------------------------------------------
  // PROOF 5, 6: Retrieve Transaction API for BD_125a86a1883b4cc99feb9f38dcc32297
  // -------------------------------------------------------------
  const retrieveOrderId = 'BD_125a86a1883b4cc99feb9f38dcc32297';
  const retrieveJson = {
    mercid: MERCID,
    orderid: retrieveOrderId
  };
  const traceId2 = `BD${crypto.randomUUID().replaceAll('-', '')}`;
  const timestamp2 = istDate.toISOString().replace(/[-:T]/g, '').slice(0, 14);

  const { jwe: jwe2, jws: jws2 } = createJoseTokens(retrieveJson);
  const res2 = await sendAdapterRequest('/uat/transactions/get', `GET-${Date.now()}`, traceId2, timestamp2, jws2);
  let decodedResponse2 = null;
  try { decodedResponse2 = decryptJoseToken(res2.body); } catch { decodedResponse2 = res2.body; }

  out.proof5_retrieveJson = retrieveJson;
  out.proof5_retrieveJwe = jwe2;
  out.proof5_retrieveJws = jws2;
  out.proof5_traceId = traceId2;
  out.proof5_timestamp = timestamp2;
  out.proof6_retrieveResponseEncoded = res2.body;
  out.proof6_retrieveResponseDecoded = decodedResponse2;

  fs.writeFileSync('scripts/billdesk-mail-proofs.json', JSON.stringify(out, null, 2), 'utf8');
  console.log('✅ Generated billdesk-mail-proofs.json successfully!');
}

main().catch(console.error);
