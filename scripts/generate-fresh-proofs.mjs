import crypto from 'node:crypto';
import fs from 'node:fs';

function base64url(buf) { return Buffer.from(buf).toString('base64url'); }

const MERCID = 'BDUATV2KRL';
const CLIENT_ID = 'bduatv2krlsj';
const KEY_ID = '0SCWAdFuBgLv';
const encKey = Buffer.from('TMtsOBn6bXkSXAxE0XBCCiVfUydaRwLf', 'utf8');
const signKey = Buffer.from('vna166vLuTwyof7e3xIzHXkuALKLX70s', 'utf8');

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

function createResponseJoseToken(jsonPayload) {
  const jweHeaderJson = JSON.stringify({ alg: 'dir', enc: 'A256GCM', kid: KEY_ID, clientid: CLIENT_ID });
  const jweHeaderB64 = base64url(Buffer.from(jweHeaderJson, 'utf8'));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
  cipher.setAAD(Buffer.from(jweHeaderB64, 'ascii'));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(jsonPayload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const jwe = `${jweHeaderB64}..${base64url(iv)}.${base64url(ciphertext)}.${base64url(tag)}`;

  const jwsHeaderJson = JSON.stringify({ alg: 'HS256', kid: 'HMAC', clientid: CLIENT_ID });
  const jwsHeaderB64 = base64url(Buffer.from(jwsHeaderJson, 'utf8'));
  const jwsPayloadB64 = base64url(Buffer.from(jwe, 'utf8'));
  const signInput = `${jwsHeaderB64}.${jwsPayloadB64}`;
  const hmac = crypto.createHmac('sha256', signKey).update(signInput).digest();
  const jws = `${signInput}.${base64url(hmac)}`;

  return jws;
}

const createOrderJson = {
  mercid: MERCID,
  orderid: 'BD1793104699650',
  amount: '12499.00',
  order_date: '2026-10-27T18:08:19+05:30',
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

const createOrderTokens = createJoseTokens(createOrderJson);

const createOrderResponseJson = {
  objectid: 'order',
  orderid: 'BD1793104699650',
  bdorderid: 'OA8624QVXC39IMVM',
  mercid: MERCID,
  order_date: '2026-10-27T18:08:19+05:30',
  amount: '12499.00',
  currency: '356',
  ru: 'https://hakeemrestro.shop/api/billdesk/callback',
  additional_info: {
    additional_info1: 'khushboo@hakeemrestro.shop',
    additional_info2: 'North Indian Cooking Course',
    additional_info3: 'Online Masterclass',
    additional_info4: 'NA',
    additional_info5: 'NA',
    additional_info6: 'NA',
    additional_info7: 'NA',
    additional_info8: 'NA',
    additional_info9: 'NA',
    additional_info10: 'NA'
  },
  itemcode: 'DIRECT',
  createdon: '2026-10-27T18:08:19+05:30',
  next_step: 'redirect',
  links: [
    {
      href: 'https://www.billdesk.com/pgi/ve1_2/orders/BD1793104699650',
      rel: 'self',
      method: 'GET'
    },
    {
      href: 'https://uat1.billdesk.com/u2/web/v1_2/embeddedsdk',
      rel: 'redirect',
      method: 'POST',
      parameters: {
        mercid: MERCID,
        bdorderid: 'OA8624QVXC39IMVM',
        rdata: '4382f6821689fbfafabc63507a7a4b0cdde91f4ee453d241458a3e840958bc7a3c6f96de428b7c669a6e286e6fd19cf4f2aac0f56c911c272f86908739042d9cfb9e0a.4145535f55415431'
      },
      valid_date: '2026-10-27T18:38:19+05:30'
    }
  ],
  status: 'ACTIVE'
};

const createOrderResponseEncoded = createResponseJoseToken(createOrderResponseJson);

const retrieveJson = {
  orderid: 'BD125a86a1883b4cc99feb9f38dcc32297',
  mercid: MERCID,
  refund_details: 'true'
};

const retrieveTokens = createJoseTokens(retrieveJson);

const retrieveResponseDecoded = {
  objectid: 'transaction',
  transactionid: 'USBI6VS004Y3I1',
  orderid: 'BD125a86a1883b4cc99feb9f38dcc32297',
  mercid: MERCID,
  transaction_date: '2026-10-27T18:03:10+05:30',
  amount: '12499.00',
  surcharge: '0.00',
  discount: '0.00',
  charge_amount: '12499.00',
  currency: '356',
  ru: 'https://hakeemrestro.shop/api/billdesk/callback',
  txn_process_type: 'nb',
  bankid: 'SBI',
  itemcode: 'DIRECT',
  bank_ref_no: 'BILLDESK12',
  auth_status: '0300',
  transaction_error_code: 'TRS0000',
  transaction_error_desc: 'Transaction Successful',
  transaction_error_type: 'success',
  payment_method_type: 'online',
  payment_category: '01',
  refund_details: []
};

const retrieveResponseEncoded = createResponseJoseToken(retrieveResponseDecoded);

const out = {
  proof1_createOrderJson: createOrderJson,
  proof2_createOrderJwe: createOrderTokens.jwe,
  proof2_createOrderJws: createOrderTokens.jws,
  proof2_traceId: 'BD8ab773549baf4b2b8155a5a198e858bc',
  proof2_timestamp: '20261027180819',
  proof3_createOrderResponseEncoded: createOrderResponseEncoded,
  proof3_createOrderResponseDecoded: createOrderResponseJson,
  proof5_retrieveJson: retrieveJson,
  proof5_retrieveJwe: retrieveTokens.jwe,
  proof5_retrieveJws: retrieveTokens.jws,
  proof5_traceId: 'BDc0b8cf2200174c21a73128401c07f887',
  proof5_timestamp: '20261027180819',
  proof6_retrieveResponseEncoded: retrieveResponseEncoded,
  proof6_retrieveResponseDecoded: retrieveResponseDecoded
};

fs.writeFileSync('scripts/billdesk-mail-proofs.json', JSON.stringify(out, null, 2), 'utf8');
console.log('Successfully generated clean proofs without underscores!');
