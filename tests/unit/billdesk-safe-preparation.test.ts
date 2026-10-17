import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdir, mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createElement } from 'react';
import { planBilldeskReconciliation } from '../../lib/billdesk-reconciliation';
import { billdeskCustomerMessage, billdeskFailureHtml } from '../../lib/billdesk-customer-message';
import { captureBilldeskEmail } from '../../lib/billdesk-email-capture';

beforeEach(() => vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden'); })));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const now = new Date('2026-10-17T08:00:00Z');
const row = { orderId: 'BD_fixture', createdAt: '2026-10-17T07:00:00Z', status: 'pending', gateway: 'billdesk' };
it('plans only after 60 minutes and explicit policy; never dispatches or enables retry', () => {
  expect(planBilldeskReconciliation([row], now)[0].reason).toBe('late-success-policy-unconfirmed');
  expect(planBilldeskReconciliation([row], new Date(now.getTime() - 1), 'settle')[0].action).toBe('wait');
  expect(planBilldeskReconciliation([row], now, 'settle')[0]).toMatchObject({ action: 'retrieve-candidate', dispatch: false, allowNewPayment: false });
  expect(fetch).not.toHaveBeenCalled();
});
it('applies IST day boundary instead of UTC for auto-cancel policy', () => {
  const previous = { ...row, createdAt: '2026-10-16T18:29:59Z' };
  expect(planBilldeskReconciliation([previous], now, 'auto-cancel')[0].reason).toBe('same-day-retrieve-only');
  expect(planBilldeskReconciliation([{ ...previous, createdAt: '2026-10-16T18:30:00Z' }], now, 'auto-cancel')[0].action).toBe('retrieve-candidate');
});
it('never retries terminal or ambiguous orders and rejects duplicate input', () => {
  for (const status of ['paid', 'failed']) expect(planBilldeskReconciliation([{ ...row, status }], now, 'settle')[0].action).toBe('skip');
  expect(planBilldeskReconciliation([{ ...row, status: 'paid_unfulfilled' }], now, 'settle')[0].action).toBe('review');
  expect(planBilldeskReconciliation([{ ...row, createdAt: 'invalid' }], now)[0].action).toBe('review');
  expect(() => planBilldeskReconciliation([row, row], now)).toThrow();
});
it('shows pending guidance without using untrusted query text as a reason', () => {
  expect(billdeskCustomerMessage('pending')).toContain('60 minutes');
  expect(billdeskCustomerMessage('failed')).toContain('not completed');
  expect(billdeskCustomerMessage('<script>')).toBeNull();
  const html = billdeskFailureHtml('<script>alert(1)</script>', 'https://uat.example.invalid');
  expect(html).not.toContain('<script>'); expect(html).toContain('&lt;script&gt;');
  expect(billdeskFailureHtml('x'.repeat(501), 'https://uat.example.invalid')).not.toContain('x'.repeat(501));
});
async function captureSetup() {
  const base = join(tmpdir(), 'billdesk-uat-capture');
  await mkdir(base, { recursive: true, mode: 0o700 });
  const root = await mkdtemp(join(base, 'test-'));
  vi.stubEnv('BILLDESK_ENV', 'UAT'); vi.stubEnv('VERCEL', '');
  vi.stubEnv('BILLDESK_EMAIL_CAPTURE', 'local'); vi.stubEnv('BILLDESK_EMAIL_CAPTURE_DIR', root);
  vi.stubEnv('BILLDESK_EMAIL_CAPTURE_RECIPIENTS', 'tester@example.invalid');
  return root;
}
const mail = { from: 'fixture@example.invalid', to: 'tester@example.invalid', subject: 'Synthetic capture', html: '<p>Fixture</p>' };
it('captures inline HTML and attachments locally, idempotently and without delivery', async () => {
  const root = await captureSetup();
  const input = { ...mail, attachments: [{ filename: 'fixture.txt', content: Buffer.from('fixture') }] };
  const first = await captureBilldeskEmail(input, 'fixture/order/welcome');
  expect(first).toMatchObject({ status: 'captured', delivered: false });
  expect(await captureBilldeskEmail(input, 'fixture/order/welcome')).toEqual(first);
  expect(await readdir(root)).toHaveLength(1);
  const saved = JSON.parse(await readFile(join(root, first.messageId + '.json'), 'utf8'));
  expect(saved.html).toBe(mail.html); expect(saved.attachments[0].content).toBe(Buffer.from('fixture').toString('base64'));
  await expect(captureBilldeskEmail({ ...mail, subject: 'changed' }, 'fixture/order/welcome')).rejects.toThrow('review');
  expect(fetch).not.toHaveBeenCalled();
});
it('renders React email content into capture without network', async () => {
  const root = await captureSetup();
  const captured = await captureBilldeskEmail({ ...mail, react: createElement('p', null, 'synthetic React') }, 'react');
  expect(await readFile(join(root, captured.messageId + '.json'), 'utf8')).toContain('synthetic React');
  expect(fetch).not.toHaveBeenCalled();
});
it('blocks production, hosted capture and default-disabled capture', async () => {
  await captureSetup(); vi.stubEnv('BILLDESK_ENV', 'PROD');
  await expect(captureBilldeskEmail(mail, 'one')).rejects.toThrow('disabled');
  vi.stubEnv('BILLDESK_ENV', 'UAT'); vi.stubEnv('VERCEL', '1');
  await expect(captureBilldeskEmail(mail, 'one')).rejects.toThrow('disabled');
  vi.stubEnv('VERCEL', ''); vi.stubEnv('BILLDESK_EMAIL_CAPTURE', '');
  await expect(captureBilldeskEmail(mail, 'one')).rejects.toThrow('disabled');
});
it('blocks unapproved To/Cc/Bcc recipients and attachment paths', async () => {
  const root = await captureSetup();
  for (const field of ['to', 'cc', 'bcc']) await expect(captureBilldeskEmail({ ...mail, [field]: 'outsider@example.invalid' }, field)).rejects.toThrow('recipient');
  await expect(captureBilldeskEmail({ ...mail, attachments: [{ path: 'https://example.invalid/file' }] }, 'path')).rejects.toThrow('inline');
  expect(await readdir(root)).toHaveLength(0); expect(fetch).not.toHaveBeenCalled();
});
it('rejects capture inside repository including a dot-prefixed sibling-like name', async () => {
  await captureSetup();
  for (const dir of [process.cwd(), join(process.cwd(), 'public'), join(process.cwd(), '..private')]) {
    vi.stubEnv('BILLDESK_EMAIL_CAPTURE_DIR', dir);
    await expect(captureBilldeskEmail(mail, 'inside')).rejects.toThrow('outside repository');
  }
});
