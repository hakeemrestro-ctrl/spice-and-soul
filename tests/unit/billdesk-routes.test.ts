// @vitest-environment node
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), fulfill: vi.fn(), process: vi.fn() }));
vi.mock('../../lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock('../../lib/billdesk-fulfillment', () => ({ fulfillBilldeskOrder: mocks.fulfill }));
vi.mock('../../lib/billdesk-payment', () => ({ processBilldeskPayment: mocks.process }));
import { readBilldeskToken, handleBilldeskPayment } from '../../lib/billdesk-handler';
import { POST as callback } from '../../app/api/billdesk/callback/route';
import { POST as webhook } from '../../app/api/billdesk/webhook/route';
import { POST as initiate } from '../../app/api/billdesk/initiate/route';

beforeEach(() => { vi.stubEnv('BILLDESK_ENV','UAT');vi.stubEnv('BILLDESK_UAT_APP_ORIGIN','https://uat.example.invalid'); });
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function request(body = 'fixture-token', type = 'application/jose') {
  return new NextRequest('https://fixture.invalid/api/billdesk/webhook', {
    method: 'POST', headers: { 'content-type': type }, body,
  });
}
describe('BillDesk route boundaries', () => {
  it('callback has no production origin fallback',async()=>{
    vi.stubEnv('BILLDESK_UAT_APP_ORIGIN','');expect((await callback(request())).status).toBe(503);expect(mocks.process).not.toHaveBeenCalled();
  });
  it('uses the separately configured production callback origin',async()=>{
    vi.stubEnv('BILLDESK_ENV','PROD');vi.stubEnv('BILLDESK_APP_ORIGIN','https://www.example.invalid');
    mocks.process.mockResolvedValue({status:'pending'});const result=await callback(request());
    expect(result.status).toBe(303);expect(result.headers.get('location')).toBe('https://www.example.invalid/courses?payment=pending');
  });
  it('disabled initiation returns before database or payment processing', async () => {
    vi.stubEnv('BILLDESK_UPSTREAM_ENABLED','false');
    try {
      const result = await initiate(request());
      expect(result.status).toBe(503); expect(await result.json()).toEqual({error:'UPSTREAM_DISABLED'});
      expect(mocks.rpc).not.toHaveBeenCalled(); expect(mocks.process).not.toHaveBeenCalled();
    } finally { vi.unstubAllEnvs(); }
  });
  for (const [type, body] of [
    ['application/jose', 'fixture-token'], ['text/plain', 'fixture-token'],
    ['application/json', JSON.stringify({ transaction_response: 'fixture-token' })],
    ['application/x-www-form-urlencoded', 'transaction_response=fixture-token'],
  ]) it(`reads ${type}`, async () => { expect(await readBilldeskToken(request(body, type))).toBe('fixture-token'); });
  it('rejects duplicated form fields', async () => {
    await expect(readBilldeskToken(request('transaction_response=a&transaction_response=b', 'application/x-www-form-urlencoded'))).rejects.toThrow();
  });
  it('rejects oversized body', async () => {
    await expect(readBilldeskToken(request('x'.repeat(262145)))).rejects.toThrow('Body too large');
  });
  it('rejects unsupported content type', async () => {
    await expect(readBilldeskToken(request('fixture-token', 'application/octet-stream'))).rejects.toThrow();
  });
  it('callback only redirects to success after completed fulfillment', async () => {
    mocks.process.mockResolvedValue({ status: 'paid', txnId: 'TESTTXN00000001' });
    const result = await callback(request());
    expect(result.status).toBe(303); expect(result.headers.get('location')).toContain('/thank-you?payment_intent=TESTTXN00000001');
  });
  it('callback uses pending for fulfillment review', async () => {
    mocks.process.mockResolvedValue({ status: 'review' });
    expect((await callback(request())).headers.get('location')).toContain('payment=pending');
  });
  it('webhook does not acknowledge failed fulfillment as complete', async () => {
    mocks.process.mockResolvedValue({ status: 'review' }); expect((await webhook(request())).status).toBe(503);
  });
  it('webhook acknowledges pending without creating an event dedupe barrier', async () => {
    mocks.process.mockResolvedValue({ status: 'pending' }); expect((await webhook(request())).status).toBe(200);
  });
  it('both routes delegate to the same processor', async () => {
    mocks.process.mockResolvedValue({ status: 'paid', txnId: 'TESTTXN00000001' });
    await callback(request()); await webhook(request()); expect(mocks.process).toHaveBeenCalledTimes(2);
  });
  it('RPC errors fail closed without fulfillment', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Synthetic error' } });
    mocks.process.mockImplementation(async (_token, deps) => deps.store.claim('BD_test', 'TESTTXN00000001', '0300', 12345));
    await expect(handleBilldeskPayment('fixture-token')).rejects.toThrow('claim unavailable');
    expect(mocks.fulfill).not.toHaveBeenCalled();
  });
  it('passes claim and finish parameters without raw payload persistence', async () => {
    mocks.rpc.mockResolvedValue({ data: { action: 'pending' }, error: null });
    mocks.process.mockImplementation(async (_token, deps) => {
      await deps.store.claim('BD_test', 'TESTTXN00000001', '0300', 12345);
      await deps.store.finish('BD_test', 'TESTTXN00000001', true);
      return { status: 'paid' };
    });
    await handleBilldeskPayment('fixture-token');
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'billdesk_claim_payment', {
      p_order_id: 'BD_test', p_txn_id: 'TESTTXN00000001', p_status: '0300', p_amount: 12345,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'billdesk_finish_payment', {
      p_order_id: 'BD_test', p_txn_id: 'TESTTXN00000001', p_complete: true,
    });
  });
});
