// Safe authenticated contract test for BillDesk static-IP adapter.
// Validates end-to-end HTTPS, Caddy proxying, and HMAC authentication
// without enabling upstream access or contacting BillDesk.

import { createHash, createHmac, randomUUID } from 'node:crypto';
import fs from 'node:fs';

function getEnv() {
  const envFile = fs.readFileSync('.env.local', 'utf8');
  const get = (key) => {
    const m = envFile.match(new RegExp('^' + key + '=(.*)$', 'm'));
    return m ? m[1].trim() : null;
  };
  return {
    url: get('BILLDESK_ADAPTER_URL'),
    keyId: get('BILLDESK_ADAPTER_AUTH_KEY_ID'),
    secret: get('BILLDESK_ADAPTER_AUTH_SECRET'),
  };
}

const { url, keyId, secret } = getEnv();

if (!url || !keyId || !secret) {
  console.log('Adapter settings not yet fully configured in .env.local:');
  console.log('  BILLDESK_ADAPTER_URL:', url || '<missing>');
  console.log('  BILLDESK_ADAPTER_AUTH_KEY_ID:', keyId || '<missing>');
  console.log('  BILLDESK_ADAPTER_AUTH_SECRET:', secret ? '[CONFIGURED length ' + secret.length + ']' : '<missing>');
  process.exit(1);
}

const path = '/uat/orders/create';
const testData = {
  operationId: randomUUID(),
  traceId: 'BDTEST' + Date.now(),
  timestamp: String(Math.floor(Date.now() / 1000)),
  jose: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpPU0UifQ.e30.dummy_signature_for_contract_test',
};

const body = Buffer.from(JSON.stringify(testData));
const bodyDigest = createHash('sha256').update(body).digest('hex');
const timestamp = String(Math.floor(Date.now() / 1000));
const nonce = randomUUID();

const hmacPayload = ['v1', keyId, 'POST', path, timestamp, nonce, bodyDigest].join('\n');
const signature = createHmac('sha256', secret).update(hmacPayload).digest('hex');

const targetUrl = new URL(path, url).href;
console.log('Testing adapter contract against:', targetUrl);

try {
  const res = await fetch(targetUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-adapter-key-id': keyId,
      'x-adapter-timestamp': timestamp,
      'x-adapter-nonce': nonce,
      'x-adapter-signature': signature,
    },
    body,
  });

  const responseText = await res.text();
  console.log('HTTP Status:', res.status, res.statusText);
  console.log('Response Body:', responseText);

  if (res.status === 503 && responseText.includes('UPSTREAM_DISABLED')) {
    console.log('\n[PASS] Adapter contract and HMAC authentication fully verified!');
    console.log('Caddy reverse-proxy, TLS, and Droplet adapter loopback (3100) are working perfectly.');
    console.log('Upstream remains safely disabled.');
  } else if (res.status === 401) {
    console.log('\n[FAIL] Authentication failed (401). Check that BILLDESK_ADAPTER_AUTH_KEY_ID and BILLDESK_ADAPTER_AUTH_SECRET match the Droplet exactly.');
  } else {
    console.log('\n[UNEXPECTED] Received status ' + res.status);
  }
} catch (err) {
  console.error('\n[NETWORK ERROR] Could not reach adapter:', err.message);
}
