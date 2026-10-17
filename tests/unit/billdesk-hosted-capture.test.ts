import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CaptureStore } from '../../adapter/billdesk/capture-store';
import { captureHeaders, validateCaptureBody, verifyCapture } from '../../adapter/billdesk/capture-protocol';
import { sendHostedCapture } from '../../lib/billdesk-hosted-capture';
const secret = 'synthetic-capture-secret-'.repeat(3);
const id = 'capture-' + 'a'.repeat(64);
const mail = { captureOnly: true, delivered: false, to: 'tester@example.invalid', subject: 'Synthetic', html: '<p>Test</p>' };
const body = Buffer.from(JSON.stringify({ id, mail }));
beforeEach(() => {
  vi.stubEnv('BILLDESK_ENV', 'UAT'); vi.stubEnv('BILLDESK_EMAIL_CAPTURE', 'https');
  vi.stubEnv('BILLDESK_EMAIL_CAPTURE_URL', 'https://adapter.hakeemrestro.shop/uat/email-capture');
  vi.stubEnv('BILLDESK_EMAIL_CAPTURE_SECRET', secret);
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden'); }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });
it('authenticates exact body and rejects tampering, stale time and wrong secret', () => {
  const now = 1800000000000;
  const h = new Headers(captureHeaders(secret, body, now));
  expect(verifyCapture(h, body, secret, now)).toBeTruthy();
  expect(() => verifyCapture(h, Buffer.from('{}'), secret, now)).toThrow();
  expect(() => verifyCapture(h, body, secret, now + 120001)).toThrow();
  expect(() => verifyCapture(h, body, 'different'.repeat(8), now)).toThrow();
  h.set('content-encoding', 'gzip'); expect(() => verifyCapture(h, body, secret, now)).toThrow();
});
it('validates recipients and rejects forwarded attachments or extra fields', () => {
  const allow = new Set(['tester@example.invalid']);
  expect(validateCaptureBody(body, allow).id).toBe(id);
  for (const change of [{ cc: 'outsider@example.invalid' }, { delivered: true }, { attachments: [{ path: 'https://example.invalid' }] }, { secret: 'fixture' }]) {
    expect(() => validateCaptureBody(Buffer.from(JSON.stringify({ id, mail: { ...mail, ...change } })), allow)).toThrow();
  }
});
it('persists idempotent capture across reopen; rejects replay and changed content', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'billdesk-hosted-store-')), 'capture.sqlite');
  let store = new CaptureStore(path);
  const nonce = randomUUID(), now = Date.now(), payload = JSON.stringify(mail);
  try {
    expect(store.capture(id, payload, nonce, now)).toMatchObject({ status: 'captured', delivered: false });
    expect(() => store.capture(id, payload, nonce, now)).toThrow();
  } finally { store.close(); }
  store = new CaptureStore(path);
  try {
    expect(store.capture(id, payload, randomUUID(), now).messageId).toBe(id);
    expect(() => store.capture(id, JSON.stringify({ ...mail, subject: 'changed' }), randomUUID(), now)).toThrow();
  } finally { store.close(); }
});
it('client and authenticated receiver contract integrate without external network', async () => {
  const store = new CaptureStore(join(mkdtempSync(join(tmpdir(), 'billdesk-hosted-flow-')), 'capture.sqlite'));
  const transport = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    expect(init?.redirect).toBe('error');
    const raw = Buffer.from(init?.body as Uint8Array);
    const nonce = verifyCapture(new Headers(init?.headers), raw, secret);
    const value = validateCaptureBody(raw, new Set(['tester@example.invalid']));
    return Response.json(store.capture(value.id, value.payload, nonce, Date.now()));
  }) as unknown as typeof fetch;
  try { expect(await sendHostedCapture(id, JSON.stringify(mail), transport)).toEqual({ messageId: id, status: 'captured', delivered: false }); }
  finally { store.close(); }
  expect(fetch).not.toHaveBeenCalled();
});
it('client blocks production, redirects, ambiguous receipts and secret reuse', async () => {
  const transport = vi.fn(async () => Response.json({ messageId: 'wrong', status: 'captured', delivered: false }));
  await expect(sendHostedCapture(id, JSON.stringify(mail), transport)).rejects.toThrow();
  vi.stubEnv('BILLDESK_ENV', 'PROD');
  await expect(sendHostedCapture(id, JSON.stringify(mail), transport)).rejects.toThrow();
  expect(transport).toHaveBeenCalledTimes(1);
  vi.stubEnv('BILLDESK_ENV', 'UAT'); vi.stubEnv('BILLDESK_ADAPTER_AUTH_SECRET', secret);
  await expect(sendHostedCapture(id, JSON.stringify(mail), transport)).rejects.toThrow();
  expect(transport).toHaveBeenCalledTimes(1);
});
