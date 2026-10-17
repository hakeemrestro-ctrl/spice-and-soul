// @vitest-environment node
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const insert = vi.fn();
  const from = vi.fn(() => ({ select, insert }));
  const rpc = vi.fn();
  const fulfill = vi.fn();
  const process = vi.fn();
  const verify = vi.fn();
  return { rpc, fulfill, process, verify, from, select, eq, maybeSingle, insert };
});

vi.mock('../../lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
    from: mocks.from,
  }),
}));
vi.mock('../../lib/billdesk-fulfillment', () => ({ fulfillBilldeskOrder: mocks.fulfill }));
vi.mock('../../lib/billdesk-payment', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../lib/billdesk-payment')>(),
  processBilldeskPayment: mocks.process,
}));
vi.mock('../../lib/billdesk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/billdesk')>();
  return {
    ...actual,
    BILLDESK_MERCID: 'fixture',
    BILLDESK_CLIENT_ID: 'fixture-client',
    verifyJwsToken: mocks.verify,
  };
});

import { readBilldeskToken, handleBilldeskPayment } from '../../lib/billdesk-handler';
import { POST as callback } from '../../app/api/billdesk/callback/route';
import { POST as webhook } from '../../app/api/billdesk/webhook/route';
import { POST as initiate } from '../../app/api/billdesk/initiate/route';

const boundOrder = { order_id: 'BD_test', amount_cents: 10000, metadata: { paymentGateway: 'billdesk' } };

beforeEach(() => {
  vi.stubEnv('BILLDESK_ENV', 'UAT');
  vi.stubEnv('BILLDESK_UAT_APP_ORIGIN', 'https://uat.example.invalid');
  mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
  mocks.verify.mockResolvedValue({
    payload: {
      orderid: 'BD_test',
      auth_status: '0300',
      transactionid: 'TESTTXN00000001',
      mercid: 'fixture',
      amount: '100.00',
      currency: '356',
    },
    jwsHeader: {},
    jweHeader: {},
  });
  mocks.rpc.mockResolvedValue({ data: null, error: null });
});

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function request(body = 'fixture-token', type = 'application/jose') {
  return new NextRequest('https://fixture.invalid/api/billdesk/webhook', {
    method: 'POST',
    headers: { 'content-type': type },
    body,
  });
}

describe('BillDesk route boundaries', () => {
  it('callback has no production origin fallback', async () => {
    vi.stubEnv('BILLDESK_UAT_APP_ORIGIN', '');
    expect((await callback(request())).status).toBe(503);
    expect(mocks.process).not.toHaveBeenCalled();
    expect(mocks.fulfill).not.toHaveBeenCalled();
  });

  it('uses the separately configured production callback origin', async () => {
    vi.stubEnv('BILLDESK_ENV', 'PROD');
    vi.stubEnv('BILLDESK_APP_ORIGIN', 'https://www.example.invalid');
    mocks.maybeSingle.mockResolvedValue({ data: { ...boundOrder, status: 'pending', txn_id: null }, error: null });
    const result = await callback(request());
    expect(result.status).toBe(303);
    expect(result.headers.get('location')).toBe('https://www.example.invalid/courses?payment=pending');
  });

  it('disabled initiation returns before database or payment processing', async () => {
    vi.stubEnv('BILLDESK_UPSTREAM_ENABLED', 'false');
    try {
      const result = await initiate(request());
      expect(result.status).toBe(503);
      expect(await result.json()).toEqual({ error: 'UPSTREAM_DISABLED' });
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(mocks.process).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  for (const [type, body] of [
    ['application/jose', 'fixture-token'],
    ['text/plain', 'fixture-token'],
    ['application/json', JSON.stringify({ transaction_response: 'fixture-token' })],
    ['application/x-www-form-urlencoded', 'transaction_response=fixture-token'],
  ]) {
    it(`reads ${type}`, async () => {
      expect(await readBilldeskToken(request(body, type))).toBe('fixture-token');
    });
  }

  it('rejects duplicated form fields', async () => {
    await expect(
      readBilldeskToken(request('transaction_response=a&transaction_response=b', 'application/x-www-form-urlencoded')),
    ).rejects.toThrow();
  });

  it('rejects oversized body', async () => {
    await expect(readBilldeskToken(request('x'.repeat(262145)))).rejects.toThrow('Body too large');
  });

  it('rejects unsupported content type', async () => {
    await expect(readBilldeskToken(request('fixture-token', 'application/octet-stream'))).rejects.toThrow();
  });

  it('callback displays acknowledgement and NEVER triggers payment claiming or fulfillment', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { ...boundOrder, status: 'pending', txn_id: null }, error: null });
    const result = await callback(request());
    expect(result.status).toBe(303);
    expect(result.headers.get('location')).toBe('https://uat.example.invalid/courses?payment=pending');
    // Verify callback NEVER called payment processor, fulfillment, or claim RPC
    expect(mocks.process).not.toHaveBeenCalled();
    expect(mocks.fulfill).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalledWith('billdesk_claim_payment', expect.anything());
  });

  it('callback redirects to thank-you only when order is already marked paid in database', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { ...boundOrder, status: 'paid', txn_id: 'TESTTXN00000001' }, error: null });
    const result = await callback(request());
    expect(result.status).toBe(303);
    expect(result.headers.get('location')).toBe('https://uat.example.invalid/thank-you?payment_intent=TESTTXN00000001');
    expect(mocks.process).not.toHaveBeenCalled();
    expect(mocks.fulfill).not.toHaveBeenCalled();
    expect(mocks.eq).toHaveBeenCalledWith('order_id', 'BD_test');
    expect(mocks.rpc).toHaveBeenCalledWith('billdesk_record_raw_audit', {
      p_order_id: 'BD_test', p_operation: 'callback_response', p_raw_token: 'fixture-token',
    });
  });

  it('callback does not use a token transaction ID when the paid database row lacks one', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { ...boundOrder, status: 'paid', txn_id: null }, error: null });
    const result = await callback(request());
    expect(result.headers.get('location')).toBe('https://uat.example.invalid/courses?payment=pending');
  });

  it('callback does not mark a failed token as final while the database remains pending', async () => {
    mocks.verify.mockResolvedValue({
      payload: { orderid: 'BD_test', auth_status: '0399', mercid: 'fixture', currency: '356', amount: '100.00' },
      jwsHeader: {},
      jweHeader: {},
    });
    mocks.maybeSingle.mockResolvedValue({ data: { ...boundOrder, status: 'pending', txn_id: null }, error: null });
    const result = await callback(request());
    expect(result.headers.get('location')).toBe('https://uat.example.invalid/courses?payment=pending');
  });

  it('callback displays failure only for a bound failure and failed database status', async () => {
    mocks.verify.mockResolvedValue({
      payload: { orderid: 'BD_test', auth_status: '0399', mercid: 'fixture', currency: '356', amount: '100.00' },
      jwsHeader: {},
      jweHeader: {},
    });
    mocks.maybeSingle.mockResolvedValue({ data: { ...boundOrder, status: 'failed', txn_id: null }, error: null });
    const result = await callback(request());
    expect(result.status).toBe(200);
    expect(await result.text()).toContain('Payment not completed');
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(mocks.process).not.toHaveBeenCalled();
    expect(mocks.fulfill).not.toHaveBeenCalled();
  });

  it.each([
    ['order ID', { orderid: 'unrelated' }],
    ['merchant', { mercid: 'different-merchant' }],
    ['client', { clientid: 'different-client' }],
    ['currency', { currency: '840' }],
    ['amount', { amount: 'invalid' }],
    ['status type', { auth_status: 399 }],
    ['missing success transaction', { transactionid: undefined }],
  ])('callback rejects invalid %s before audit or database access', async (_name, fields) => {
    mocks.verify.mockResolvedValue({ payload: {
      orderid: 'BD_test', mercid: 'fixture', currency: '356', amount: '100.00',
      auth_status: '0300', transactionid: 'TESTTXN00000001', ...fields,
    } });
    expect((await callback(request())).headers.get('location')).toContain('payment=pending');
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it.each([
    ['different order', { order_id: 'BD_other' }],
    ['different gateway', { metadata: { paymentGateway: 'paytm' } }],
    ['missing gateway', { metadata: null }],
    ['different amount', { amount_cents: 20000 }],
    ['different transaction', { txn_id: 'TESTTXN00000002' }],
  ])('callback hides terminal status for %s', async (_name, fields) => {
    mocks.maybeSingle.mockResolvedValue({ data: {
      ...boundOrder, status: 'paid', txn_id: 'TESTTXN00000001', ...fields,
    }, error: null });
    expect((await callback(request())).headers.get('location')).toContain('payment=pending');
    expect(mocks.process).not.toHaveBeenCalled();
    expect(mocks.fulfill).not.toHaveBeenCalled();
  });

  it('callback rejects an invalid signature without retaining its raw body', async () => {
    mocks.verify.mockRejectedValue(new Error('Invalid BillDesk JOSE message'));
    expect((await callback(request())).headers.get('location')).toContain('payment=pending');
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('callback hides status on audit failure and never reads or fulfills the order', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'private database diagnostic' } });
    const result = await callback(request());
    expect(result.status).toBe(303);
    expect(result.headers.get('location')).toContain('payment=pending');
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.process).not.toHaveBeenCalled();
    expect(mocks.fulfill).not.toHaveBeenCalled();
  });

  it('callback hides status on database lookup failure', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { ...boundOrder, status: 'paid', txn_id: 'TESTTXN00000001' }, error: { message: 'unavailable' } });
    expect((await callback(request())).headers.get('location')).toContain('payment=pending');
  });

  it('callback does not display stale failure for a success notification', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { ...boundOrder, status: 'failed', txn_id: null }, error: null });
    expect((await callback(request())).headers.get('location')).toContain('payment=pending');
  });

  it('webhook relies on verified webhook processing alone to trigger payment claiming and fulfillment', async () => {
    mocks.process.mockResolvedValue({ status: 'paid', txnId: 'TESTTXN00000001' });
    const result = await webhook(request());
    expect(result.status).toBe(200);
    expect(mocks.process).toHaveBeenCalledTimes(1);
    expect(mocks.process).toHaveBeenCalledWith('fixture-token', expect.objectContaining({
      store: expect.any(Object),
      fulfill: expect.any(Function),
      audit: expect.any(Function),
    }));
  });

  it('webhook does not acknowledge failed fulfillment as complete', async () => {
    mocks.process.mockResolvedValue({ status: 'review' });
    expect((await webhook(request())).status).toBe(503);
  });

  it('webhook acknowledges pending without creating an event dedupe barrier', async () => {
    mocks.process.mockResolvedValue({ status: 'pending' });
    expect((await webhook(request())).status).toBe(200);
  });

  it('RPC errors fail closed without fulfillment', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Synthetic error' } });
    mocks.process.mockImplementation(async (_token, deps) => deps.store.claim('BD_test', 'TESTTXN00000001', '0300', 12345));
    await expect(handleBilldeskPayment('fixture-token')).rejects.toThrow('claim unavailable');
    expect(mocks.fulfill).not.toHaveBeenCalled();
  });

  it('passes claim and finish parameters and injects raw audit recorder', async () => {
    mocks.rpc.mockResolvedValue({ data: { action: 'pending' }, error: null });
    mocks.process.mockImplementation(async (_token, deps) => {
      await deps.store.claim('BD_test', 'TESTTXN00000001', '0300', 12345);
      await deps.store.finish('BD_test', 'TESTTXN00000001', true);
      if (deps.audit) {
        await deps.audit('BD_test', 'webhook_response', 'fixture-token');
      }
      return { status: 'paid' };
    });
    await handleBilldeskPayment('fixture-token');
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'billdesk_claim_payment', {
      p_order_id: 'BD_test',
      p_txn_id: 'TESTTXN00000001',
      p_status: '0300',
      p_amount: 12345,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'billdesk_finish_payment', {
      p_order_id: 'BD_test',
      p_txn_id: 'TESTTXN00000001',
      p_complete: true,
    });
  });
});
