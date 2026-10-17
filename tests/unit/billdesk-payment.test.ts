// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import type { BilldeskStore } from '../../lib/billdesk-payment';

let bd: typeof import('../../lib/billdesk');
let payment: typeof import('../../lib/billdesk-payment');
beforeAll(async () => {
  for (const [key, value] of Object.entries({
    BILLDESK_ENV: 'UAT', BILLDESK_MERCID: 'TESTMER', BILLDESK_CLIENT_ID: 'testclient', BILLDESK_KEY_ID: 'testkid',
    BILLDESK_JWE_PASSWORD: 'e'.repeat(32), BILLDESK_JWS_PASSWORD: 's'.repeat(32),
    BILLDESK_KEY_ENCODING: 'utf8', BILLDESK_JWS_ALGORITHM: 'HS256', BILLDESK_TIMESTAMP_FORMAT: 'ist-calendar',
  })) vi.stubEnv(key, value);
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden'); }));
  bd = await import('../../lib/billdesk');
  payment = await import('../../lib/billdesk-payment');
});
afterAll(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
const payload = (status = '0300') => ({ orderid: 'BD_test', mercid: 'TESTMER', currency: '356',
  clientid: 'testclient', amount: '123.45', transactionid: 'TESTTXN00000001', auth_status: status });

// In-memory atomic store models the RPC contract; it does NOT validate PostgreSQL
// locking/grants. The migration requires separate isolated database validation.
function fixture() {
  let claim: 'processing' | 'completed' | 'review' | undefined;
  let status = 'pending';
  const store: BilldeskStore = {
    async claim(_order, txn, responseStatus, amount) {
      if (amount !== 12345) throw new Error('Amount mismatch');
      if (claim) return { action: claim === 'completed' ? 'paid' : 'review', txnId: txn! };
      if (responseStatus === '0002') return { action: 'pending' };
      if (responseStatus === '0399') { status = 'failed'; return { action: 'failed' }; }
      claim = 'processing'; status = 'paid_unfulfilled';
      return { action: 'claimed', pending: { order_id: 'BD_test', amount_cents: 12345, course_id: 'fixture',
        customer_email: 'fixture@example.invalid', customer_name: 'Fixture', metadata: {} } };
    },
    async finish(_order, _txn, complete) { claim = complete ? 'completed' : 'review'; status = complete ? 'paid' : 'paid_unfulfilled'; },
  };
  const fulfill = vi.fn(async () => {});
  const run = async (notification = payload(), response = notification) => payment.processBilldeskPayment(
    await bd.createJwsToken(notification), { store, fulfill, retrieve: vi.fn(async () => response) });
  return { run, fulfill, store, state: () => status };
}

describe('BillDesk payment validation and shared callback/webhook processor', () => {
  for (const refundInfo of [null, {}, 'unknown', [{ refund_status: '0799', refund_amount: '123.45' }],
    [{ refund_status: '0699', refund_amount: '123.45' }], [{ refund_status: '0799', refund_amount: '1.00' }],
    [{ refund_status: 'pending' }], [{}]]) {
    it(`requires review without claiming or fulfilling refund evidence ${JSON.stringify(refundInfo)}`, async () => {
      const f = fixture();
      const claim = vi.spyOn(f.store, 'claim');
      const finish = vi.spyOn(f.store, 'finish');
      const response = { ...payload(), refundInfo };
      expect((await f.run(payload(), response)).status).toBe('review');
      expect(claim).not.toHaveBeenCalled();
      expect(finish).not.toHaveBeenCalled();
      expect(f.fulfill).not.toHaveBeenCalled();
      expect(f.state()).toBe('pending');
    });
  }
  it('accepts an empty refund array after verified Retrieve', async () => {
    const f = fixture(); const response = { ...payload(), refundInfo: [] };
    expect((await f.run(payload(), response)).status).toBe('paid');
    expect(f.fulfill).toHaveBeenCalledTimes(1);
  });
  it('generates unique merchant-kit alphanumeric IDs accepted by payment validation', () => {
    const ids = Array.from({ length: 100 }, () => bd.generateOrderId());
    expect(new Set(ids).size).toBe(ids.length);
    for (const orderid of ids) {
      expect(orderid).toMatch(/^[A-Za-z0-9]{10,35}$/);
      expect(payment.validatePayment({ ...payload(), orderid }).orderId).toBe(orderid);
    }
    expect(bd.generateTraceId()).toMatch(/^[A-Za-z0-9]{10,35}$/);
    expect(payment.validatePayment(payload()).orderId).toBe('BD_test');
  });
  it('pending followed by success fulfills once', async () => {
    const f = fixture(); expect((await f.run(payload('0002'))).status).toBe('pending');
    expect(f.fulfill).not.toHaveBeenCalled(); expect((await f.run()).status).toBe('paid');
    expect(f.fulfill).toHaveBeenCalledTimes(1);
  });
  it('retrieval success supersedes delayed pending notification', async () => {
    const f = fixture(); expect((await f.run(payload('0002'), payload())).status).toBe('paid');
    expect(f.fulfill).toHaveBeenCalledTimes(1);
  });
  for (const source of ['callback', 'webhook']) it(`duplicate ${source} does not fulfill twice`, async () => {
    const f = fixture(); await f.run(); await f.run(); expect(f.fulfill).toHaveBeenCalledTimes(1);
  });
  it('concurrent callback and webhook only claim once', async () => {
    const f = fixture(); await Promise.all(Array.from({ length: 20 }, () => f.run()));
    expect(f.fulfill).toHaveBeenCalledTimes(1); expect(f.state()).toBe('paid');
  });
  it('later failure or pending cannot overwrite paid', async () => {
    const f = fixture(); await f.run(); await f.run(payload('0399')); await f.run(payload('0002'));
    expect(f.state()).toBe('paid'); expect(f.fulfill).toHaveBeenCalledTimes(1);
  });
  it('success after failure is recoverable', async () => {
    const f = fixture(); await f.run(payload('0399')); await f.run(); expect(f.state()).toBe('paid');
  });
  it('fulfillment failure is held for review without replay', async () => {
    const f = fixture(); f.fulfill.mockRejectedValueOnce(new Error('Synthetic failure'));
    expect((await f.run()).status).toBe('review'); expect((await f.run()).status).toBe('review');
    expect(f.state()).toBe('paid_unfulfilled'); expect(f.fulfill).toHaveBeenCalledTimes(1);
  });
  for (const field of ['orderid', 'mercid', 'clientid', 'currency', 'transactionid']) it(`rejects mismatched ${field}`, async () => {
    const f = fixture(); await expect(f.run(payload(), { ...payload(), [field]: field === 'orderid' ? 'BD_other' : 'incorrect' })).rejects.toThrow();
    expect(f.fulfill).not.toHaveBeenCalled();
  });
  it('rejects valid but different transaction ID', async () => {
    const f = fixture(); await expect(f.run(payload(), { ...payload(), transactionid: 'TESTTXN00000002' })).rejects.toThrow();
    expect(f.fulfill).not.toHaveBeenCalled();
  });
  it('checks stored amount before fulfillment', async () => {
    const f = fixture(); await expect(f.run({ ...payload(), amount: '1.00' })).rejects.toThrow();
    expect(f.fulfill).not.toHaveBeenCalled();
  });
  for (const value of ['NaN', 'Infinity', '-1.00', '0', '1.001', '1e2', '123.45junk', '', ' 123.45', 123.45, null]) {
    it(`rejects invalid amount fixture ${String(value)}`, () => { expect(() => payment.amountInPaise(value)).toThrow(); });
  }
  it('parses money without rounding untrusted floats', () => { expect(payment.amountInPaise('123.45')).toBe(12345); });
  it('does not retrieve on invalid JOSE', async () => {
    const retrieve = vi.fn(); const f = fixture();
    await expect(payment.processBilldeskPayment('invalid', { store: {} as BilldeskStore, fulfill: f.fulfill, retrieve })).rejects.toThrow();
    expect(retrieve).not.toHaveBeenCalled(); expect(f.fulfill).not.toHaveBeenCalled();
  });
});

describe('BillDesk key lengths', () => {
  for (const [encryption, signing] of [[31,32],[33,32],[64,32],[32,31],[0,32]]) {
    it(`rejects synthetic key lengths ${encryption}/${signing}`, async () => {
      vi.resetModules(); vi.stubEnv('BILLDESK_JWE_PASSWORD', 'e'.repeat(encryption)); vi.stubEnv('BILLDESK_JWS_PASSWORD', 's'.repeat(signing));
      const isolated = await import('../../lib/billdesk');
      await expect(isolated.createJwsToken({ fixture: true })).rejects.toThrow('Invalid BillDesk key length');
      vi.stubEnv('BILLDESK_JWE_PASSWORD', 'e'.repeat(32)); vi.stubEnv('BILLDESK_JWS_PASSWORD', 's'.repeat(32));
    });
  }
});
