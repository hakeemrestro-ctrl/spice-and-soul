import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ construct: vi.fn(), send: vi.fn(), admin: vi.fn() }));
vi.mock('resend', () => ({ Resend: class {
  emails = { send: mocks.send };
  constructor() { mocks.construct(); }
} }));
vi.mock('../../lib/supabase/admin', () => ({ createAdminClient: mocks.admin }));
import { resend } from '../../lib/resend';
import { GET as digest } from '../../app/api/cron/daily-digest/route';
import { GET as reviews } from '../../app/api/cron/review-requests/route';
import nextConfig from '../../next.config';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden'); }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('omits the production canonical redirect in UAT while preserving non-UAT configuration', async () => {
  vi.stubEnv('BILLDESK_ENV', 'UAT');
  expect(await nextConfig.redirects!()).toEqual([]);
  vi.stubEnv('BILLDESK_ENV', 'PROD');
  expect(await nextConfig.redirects!()).toEqual([expect.objectContaining({
    destination: 'https://hakeemrestro.shop/:path*', permanent: true,
  })]);
});

it('blocks UAT mail before constructing the provider or sending', () => {
  vi.stubEnv('BILLDESK_ENV', 'UAT');
  expect(() => resend.emails).toThrow('UAT email delivery disabled');
  expect(mocks.construct).not.toHaveBeenCalled();
  expect(mocks.send).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});

it('preserves non-UAT delivery and blocks UAT even after client caching', () => {
  vi.stubEnv('BILLDESK_ENV', 'PROD');
  expect(resend.emails.send).toBe(mocks.send);
  vi.stubEnv('BILLDESK_ENV', 'UAT');
  expect(() => resend.emails).toThrow('UAT email delivery disabled');
  expect(mocks.send).not.toHaveBeenCalled();
});

for (const [name, route] of [['digest', digest], ['reviews', reviews]] as const) {
  it(`${name} stops UAT scheduling before database or email access`, async () => {
    vi.stubEnv('BILLDESK_ENV', 'UAT');
    vi.stubEnv('CRON_SECRET', 'synthetic-fixture');
    const result = await route(new NextRequest('https://uat.example.invalid/api/cron', {
      headers: { authorization: 'Bearer synthetic-fixture' },
    }));
    expect(result.status).toBe(503);
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it(`${name} rejects missing cron configuration before database access`, async () => {
    vi.stubEnv('BILLDESK_ENV', 'PROD');
    vi.stubEnv('CRON_SECRET', '');
    expect((await route(new NextRequest('https://fixture.invalid/api/cron'))).status).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
}
