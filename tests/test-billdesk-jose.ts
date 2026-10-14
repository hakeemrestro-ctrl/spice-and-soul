// Synthetic fixtures only. Never load .env.local or print JOSE/key material.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CompactSign, CompactEncrypt, compactVerify, compactDecrypt } from 'jose';

Object.assign(process.env, {
  BILLDESK_ENV: 'UAT', BILLDESK_MERCID: 'TESTMER', BILLDESK_CLIENT_ID: 'testclient', BILLDESK_KEY_ID: 'testkid',
  BILLDESK_JWE_PASSWORD: 'e'.repeat(32), BILLDESK_JWS_PASSWORD: 's'.repeat(32),
  BILLDESK_KEY_ENCODING: 'utf8', BILLDESK_JWS_ALGORITHM: 'HS256', BILLDESK_TIMESTAMP_FORMAT: 'ist-calendar',
});
globalThis.fetch = async () => { throw new Error('Network forbidden in offline tests'); };
const enc = new TextEncoder();
const encryption = enc.encode('e'.repeat(32));
const signing = enc.encode('s'.repeat(32));
const innerHeader = { alg: 'dir', enc: 'A256GCM', kid: 'testkid', clientid: 'testclient' };
const outerHeader = { alg: 'HS256', kid: 'testkid', clientid: 'testclient' };
const original = { orderid: 'BD_test', amount: '123.45', nested: { unicode: 'मिठाई', items: [1, false, null] } };
async function inner(header = innerHeader) {
  return new CompactEncrypt(enc.encode(JSON.stringify(original))).setProtectedHeader(header).encrypt(encryption);
}
async function outer(text: string, header: Record<string, string> = outerHeader, key = signing) {
  return new CompactSign(enc.encode(text)).setProtectedHeader(header as {alg: string}).sign(key);
}

async function main() {
  const bd = await import('../lib/billdesk');
  await test('nested encryption/signing and full JSON preservation', async () => {
    const token = await bd.createJwsToken(original);
    assert.equal(token.split('.').length, 3);
    const verified = await compactVerify(token, signing, { algorithms: ['HS256'] });
    const jwe = new TextDecoder().decode(verified.payload);
    assert.equal(jwe.split('.').length, 5);
    const decrypted = await compactDecrypt(jwe, encryption);
    assert.deepEqual(JSON.parse(new TextDecoder().decode(decrypted.plaintext)), original);
    assert.deepEqual((await bd.verifyJwsToken(token)).payload, original);
  });
  await test('invalid signature rejected', async () => {
    await assert.rejects(bd.verifyJwsToken(await outer(await inner(), outerHeader, enc.encode('x'.repeat(32)))));
  });
  for (const layer of ['outer', 'inner']) {
    for (const [field, value] of [['kid', 'wrongkid'], ['clientid', 'wrongclient'], ['unexpected', 'header']]) {
      await test(`${layer} ${field} rejected`, async () => {
        const jwe = await inner(layer === 'inner' ? { ...innerHeader, [field]: value } : innerHeader);
        await assert.rejects(bd.verifyJwsToken(await outer(jwe, layer === 'outer' ? { ...outerHeader, [field]: value } : outerHeader)));
      });
    }
  }
  await test('unexpected signing algorithm rejected even with valid signature', async () => {
    await assert.rejects(bd.verifyJwsToken(await outer(await inner(), { ...outerHeader, alg: 'HS384' }, enc.encode('s'.repeat(48)))));
  });
  await test('unexpected encryption method rejected', async () => {
    const jwe = await new CompactEncrypt(enc.encode('{}')).setProtectedHeader({ ...innerHeader, enc: 'A128GCM' }).encrypt(encryption.slice(0,16));
    await assert.rejects(bd.verifyJwsToken(await outer(jwe)));
  });
  await test('unexpected key management algorithm rejected', async () => {
    const jwe = await new CompactEncrypt(enc.encode('{}')).setProtectedHeader({ ...innerHeader, alg: 'A256KW' }).encrypt(encryption);
    await assert.rejects(bd.verifyJwsToken(await outer(jwe)));
  });
  await test('modified ciphertext with valid outer signature rejected', async () => {
    const parts = (await inner()).split('.');
    const bytes = Buffer.from(parts[3], 'base64url'); bytes[0] ^= 1; parts[3] = bytes.toString('base64url');
    await assert.rejects(bd.verifyJwsToken(await outer(parts.join('.'))));
  });
  await test('malformed and non-object JOSE rejected', async () => {
    for (const input of ['', 'not.a.token', await outer('not-a-jwe')]) await assert.rejects(bd.verifyJwsToken(input));
    const jwe = await new CompactEncrypt(enc.encode('[]')).setProtectedHeader(innerHeader).encrypt(encryption);
    await assert.rejects(bd.verifyJwsToken(await outer(jwe)));
  });
  await test('trace IDs alphanumeric, unique, within 35 characters', () => {
    const ids = Array.from({length: 1000}, bd.generateTraceId);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.every(id => /^[A-Za-z0-9]{1,35}$/.test(id)));
  });
  await test('explicit timestamps and missing configuration', () => {
    const date = new Date('2026-01-01T20:00:00Z');
    assert.equal(bd.billdeskTimestamp(date), '20260102013000');
    process.env.BILLDESK_TIMESTAMP_FORMAT = 'epoch-seconds';
    assert.equal(bd.billdeskTimestamp(date), String(date.getTime()/1000));
    process.env.BILLDESK_TIMESTAMP_FORMAT = 'epoch-milliseconds';
    assert.equal(bd.billdeskTimestamp(date), String(date.getTime()));
    delete process.env.BILLDESK_TIMESTAMP_FORMAT;
    assert.throws(() => bd.billdeskTimestamp(date));
    process.env.BILLDESK_TIMESTAMP_FORMAT = 'ist-calendar';
  });
  await test('unconfirmed encoding/algorithm fails closed', async () => {
    process.env.BILLDESK_KEY_ENCODING = 'base64';
    await assert.rejects(bd.createJwsToken(original));
    process.env.BILLDESK_KEY_ENCODING = 'utf8';
    process.env.BILLDESK_JWS_ALGORITHM = 'HS512';
    await assert.rejects(bd.createJwsToken(original));
    process.env.BILLDESK_JWS_ALGORITHM = 'HS256';
  });
  await test('valid JOSE does not permit malformed hosted response schema', async () => {
    const { validateCreateResponse } = await import('../lib/billdesk-create-response');
    const profile = { url:'https://uat1.billdesk.com/fixture-hosted',fields:'token' };
    const expected = { orderId:'BD_fixture',merchantId:'TESTMER',amount:'100.00' };
    const payload = { status:'ACTIVE',orderid:expected.orderId,mercid:expected.merchantId,amount:expected.amount,currency:'356',bdorderid:'fixture',
      links:[{ rel:'redirect',method:'POST',href:'https://attacker.invalid/',parameters:{token:'fixture'} }] };
    const verified = await bd.verifyJwsToken(await bd.createJwsToken(payload));
    assert.throws(() => validateCreateResponse(verified.payload,expected,profile));
  });
  await test('disabled retrieval never reaches fetch even with valid crypto profile', async () => {
    process.env.BILLDESK_UPSTREAM_ENABLED = 'false';
    await assert.rejects(bd.getBillDeskTransactionStatus('BD_fixture'), /UPSTREAM_DISABLED/);
  });
}
main().catch(() => { console.error('BillDesk offline test setup failed'); process.exitCode = 1; });
