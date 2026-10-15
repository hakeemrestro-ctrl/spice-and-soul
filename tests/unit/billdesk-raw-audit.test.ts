// @vitest-environment node
import { beforeAll, beforeEach, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { BilldeskStore } from '../../lib/billdesk-payment';
import type { BilldeskAuditOperation } from '../../lib/billdesk-audit';
import { recordBilldeskRawAudit } from '../../lib/billdesk-audit';
import type { SupabaseClient } from '@supabase/supabase-js';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), fulfill: vi.fn() }));
vi.mock('../../lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock('../../lib/billdesk-fulfillment', () => ({ fulfillBilldeskOrder: mocks.fulfill }));

let bd: typeof import('../../lib/billdesk');
let payment: typeof import('../../lib/billdesk-payment');
let webhook: typeof import('../../app/api/billdesk/webhook/route').POST;

beforeAll(async () => {
  for (const [key, value] of Object.entries({
    BILLDESK_ENV: 'UAT',
    BILLDESK_MERCID: 'TESTMER',
    BILLDESK_CLIENT_ID: 'testclient',
    BILLDESK_KEY_ID: 'testkid',
    BILLDESK_JWE_PASSWORD: 'e'.repeat(32),
    BILLDESK_JWS_PASSWORD: 's'.repeat(32),
    BILLDESK_KEY_ENCODING: 'utf8',
    BILLDESK_JWS_ALGORITHM: 'HS256',
    BILLDESK_TIMESTAMP_FORMAT: 'ist-calendar',
    BILLDESK_UPSTREAM_ENABLED: 'true',
    BILLDESK_ADAPTER_URL: 'https://adapter.example.invalid',
    BILLDESK_ADAPTER_AUTH_KEY_ID: 'fixture',
    BILLDESK_ADAPTER_AUTH_SECRET: 'a'.repeat(32),
  })) {
    vi.stubEnv(key, value);
  }
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden'); }));
  bd = await import('../../lib/billdesk');
  payment = await import('../../lib/billdesk-payment');
  webhook = (await import('../../app/api/billdesk/webhook/route')).POST;
});

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden'); }));
  mocks.rpc.mockReset();
  mocks.fulfill.mockReset();
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); });

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const payload = (status = '0300') => ({
  orderid: 'BD_test',
  mercid: 'TESTMER',
  currency: '356',
  clientid: 'testclient',
  amount: '123.45',
  transactionid: 'TESTTXN00000001',
  auth_status: status,
});

function webhookRequest(token: string) {
  return new NextRequest('https://uat.example.invalid/api/billdesk/webhook', {
    method: 'POST', headers: { 'content-type': 'application/jose' }, body: token,
  });
}

describe('BillDesk Raw Encoded String Preservation & Webhook-Only Fulfillment', () => {
  it('fails closed when the audit migration or RPC is unavailable', async () => {
    const rpc = vi.fn(async () => ({ error: { message: 'unavailable' } }));
    const from = vi.fn();
    await expect(recordBilldeskRawAudit('BD_test', 'create_order_request', 'fixture-token', { rpc, from } as unknown as SupabaseClient))
      .rejects.toThrow('BillDesk audit persistence unavailable');
    expect(from).not.toHaveBeenCalled();
  });

  it('webhook response and retrieve request/response compact strings are preserved unchanged', async () => {
    const auditCalls: { orderId: string; operation: BilldeskAuditOperation; rawToken: string }[] = [];
    const recordAudit = vi.fn(async (orderId: string, operation: BilldeskAuditOperation, rawToken: string) => {
      auditCalls.push({ orderId, operation, rawToken });
    });

    const store: BilldeskStore = {
      claim: vi.fn(async () => ({
        action: 'claimed' as const,
        txnId: 'TESTTXN00000001',
        pending: {
          order_id: 'BD_test',
          amount_cents: 12345,
          course_id: 'fixture',
          customer_email: 'fixture@example.invalid',
          customer_name: 'Fixture',
          metadata: {},
        },
      })),
      finish: vi.fn(async () => {}),
    };
    const fulfill = vi.fn(async () => {});

    // Create a genuine signed & encrypted JWS/JWE compact string
    const incomingWebhookRawToken = await bd.createJwsToken(payload('0300'));
    const retrieveResponseRawToken = await bd.createJwsToken(payload('0300'));

    let dispatchedToken = '';
    // Exercise real Retrieve + adapter client + JOSE; only the network is synthetic.
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      expect(url).toBe('https://adapter.example.invalid/uat/transactions/get');
      dispatchedToken = JSON.parse(String(init.body)).jose;
      expect(auditCalls.map(call => call.operation)).toEqual(['webhook_response', 'retrieve_transaction_request']);
      expect(auditCalls[1].rawToken).toBe(dispatchedToken);
      expect((await bd.verifyJwsToken(dispatchedToken)).payload).toEqual({
        mercid: 'TESTMER', orderid: 'BD_test', refund_details: true,
      });
      return new Response(retrieveResponseRawToken, { headers: { 'content-type': 'application/jose' } });
    }));

    const outcome = await payment.processBilldeskPayment(incomingWebhookRawToken, {
      store,
      fulfill,
      audit: recordAudit,
    });

    expect(outcome.status).toBe('paid');
    expect(fulfill).toHaveBeenCalledTimes(1);

    // Assert that raw tokens were recorded unchanged
    expect(auditCalls).toHaveLength(3);

    // 1. Webhook response token recorded unchanged after verification/validation
    expect(auditCalls[0]).toEqual({
      orderId: 'BD_test',
      operation: 'webhook_response',
      rawToken: incomingWebhookRawToken,
    });
    // Compact JWS format (header.payload.signature)
    expect(auditCalls[0].rawToken.split('.')).toHaveLength(3);

    // 2. Retrieve request token recorded unchanged
    expect(auditCalls[1]).toEqual({
      orderId: 'BD_test',
      operation: 'retrieve_transaction_request',
      rawToken: dispatchedToken,
    });

    // 3. Retrieve response token recorded unchanged
    expect(auditCalls[2]).toEqual({
      orderId: 'BD_test',
      operation: 'retrieve_transaction_response',
      rawToken: retrieveResponseRawToken,
    });
    expect(auditCalls[2].rawToken.split('.')).toHaveLength(3);
    expect(store.claim).toHaveBeenCalledWith('BD_test', 'TESTTXN00000001', '0300', 12345);
  });

  it.each(['webhook_response', 'retrieve_transaction_request', 'retrieve_transaction_response'])(
    '%s audit failure prevents claiming, fulfillment, and successful webhook acknowledgement', async operation => {
      const token = await bd.createJwsToken(payload());
      const responseToken = await bd.createJwsToken(payload());
      mocks.rpc.mockImplementation(async (name, args) => {
        if (name !== 'billdesk_record_raw_audit') throw new Error('Unexpected payment claim');
        return { error: args.p_operation === operation ? { message: 'private database error' } : null };
      });
      vi.stubGlobal('fetch', vi.fn(async () => new Response(responseToken, { headers: { 'content-type': 'application/jose' } })));
      const result = await webhook(webhookRequest(token));
      expect(result.status).toBe(503);
      expect(await result.json()).toEqual({ error: 'Unable to process notification' });
      expect(fetch).toHaveBeenCalledTimes(operation === 'retrieve_transaction_response' ? 1 : 0);
      expect(mocks.rpc.mock.calls.every(([name]) => name === 'billdesk_record_raw_audit')).toBe(true);
      expect(mocks.fulfill).not.toHaveBeenCalled();
      const logged = JSON.stringify(vi.mocked(console.info).mock.calls);
      expect(logged).not.toContain(token);
      expect(logged).not.toContain(responseToken);
      expect(logged).not.toContain('private database error');
    },
  );

  it('does not retain or retrieve a rejected inbound token', async () => {
    const result = await webhook(webhookRequest('invalid-fixture-token'));
    expect(result.status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.fulfill).not.toHaveBeenCalled();
  });

  it('does not retain a signed inbound token with invalid merchant binding', async () => {
    const token = await bd.createJwsToken({ ...payload(), mercid: 'different-merchant' });
    expect((await webhook(webhookRequest(token))).status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ['HTTP error', 502, 'application/jose', ['webhook_response', 'retrieve_transaction_request']],
    ['wrong content type', 200, 'text/plain', ['webhook_response', 'retrieve_transaction_request']],
    ['invalid JOSE', 200, 'application/jose', ['webhook_response', 'retrieve_transaction_request', 'retrieve_transaction_response']],
  ])('%s response has the documented audit boundary and cannot claim payment', async (_name, status, contentType, operations) => {
    const token = await bd.createJwsToken(payload());
    mocks.rpc.mockResolvedValue({ error: null });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('invalid-response-fixture', {
      status, headers: { 'content-type': contentType },
    })));
    expect((await webhook(webhookRequest(token))).status).toBe(503);
    expect(mocks.rpc.mock.calls.map(([, args]) => args.p_operation)).toEqual(operations);
    expect(mocks.rpc.mock.calls.every(([name]) => name === 'billdesk_record_raw_audit')).toBe(true);
    expect(mocks.fulfill).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain('invalid-response-fixture');
  });

  it('proves only verified webhook plus authoritative retrieve status triggers fulfillment', async () => {
    const store: BilldeskStore = {
      claim: vi.fn(async () => ({ action: 'pending' as const })),
      finish: vi.fn(async () => {}),
    };
    const fulfill = vi.fn(async () => {});

    const webhookToken = await bd.createJwsToken(payload('0300'));

    // Retrieve returns 0002 (pending) - authoritative retrieve supersedes notification
    const retrieve = vi.fn(async () => payload('0002'));

    const outcome = await payment.processBilldeskPayment(webhookToken, {
      store,
      fulfill,
      retrieve,
    });

    expect(outcome.status).toBe('pending');
    // Fulfill MUST NOT be called when retrieve status is pending
    expect(fulfill).not.toHaveBeenCalled();
    expect(store.claim).toHaveBeenCalledWith('BD_test', 'TESTTXN00000001', '0002', 12345);
  });

  it('audit function never receives or logs passwords, secrets, or keys', async () => {
    const recordedTokens: string[] = [];
    const audit = vi.fn(async (_orderId: string, _op: string, token: string) => {
      recordedTokens.push(token);
    });

    const store: BilldeskStore = {
      claim: vi.fn(async () => ({ action: 'claimed' as const, pending: { order_id: 'BD_test', amount_cents: 12345, course_id: 'c', customer_email: 'e', customer_name: 'n', metadata: {} }, txnId: 'T' })),
      finish: vi.fn(async () => {}),
    };

    const webhookToken = await bd.createJwsToken(payload('0300'));
    await payment.processBilldeskPayment(webhookToken, {
      store,
      fulfill: vi.fn(async () => {}),
      retrieve: vi.fn(async () => payload('0300')),
      audit,
    });

    for (const token of recordedTokens) {
      // Must not leak passwords or encryption keys
      expect(token).not.toContain(process.env.BILLDESK_JWE_PASSWORD!);
      expect(token).not.toContain(process.env.BILLDESK_JWS_PASSWORD!);
    }
  });
});
