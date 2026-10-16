import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '../../proxy';

afterEach(() => vi.unstubAllEnvs());

for (const path of ['/api/paytm/initiate', '/api/paytm/callback', '/api/payglocal/initiate',
  '/api/payglocal/callback', '/api/billdesk/initiate', '/api/billdesk/webhook',
  '/api/gift', '/api/reservations', '/api/sampler', '/api/cron/daily-digest',
  '/checkout', '/gift/example', '/admin/login', '/resend']) {
  it(`blocks ${path} before route processing in UAT preview`, () => {
    vi.stubEnv('BILLDESK_ENV', 'UAT');
    vi.stubEnv('UAT_SITE_PREVIEW', undefined);
    const result = proxy(new NextRequest(`https://uat.example.invalid${path}`));
    expect(result.status).toBe(503);
    expect(result.headers.get('x-middleware-next')).toBeNull();
    expect(result.headers.get('cache-control')).toBe('no-store');
  });
}

it('allows read-only marketing pages and prevents indexing', () => {
  vi.stubEnv('BILLDESK_ENV', 'UAT');
  vi.stubEnv('UAT_SITE_PREVIEW', 'true');
  const result = proxy(new NextRequest('https://uat.example.invalid/courses'));
  expect(result.headers.get('x-middleware-next')).toBe('1');
  expect(result.headers.get('x-robots-tag')).toBe('noindex, nofollow');
});

it('blocks server-action POST requests outside API routes', () => {
  vi.stubEnv('BILLDESK_ENV', 'UAT');
  vi.stubEnv('UAT_SITE_PREVIEW', 'true');
  expect(proxy(new NextRequest('https://uat.example.invalid/', { method: 'POST' })).status).toBe(503);
});

it('does not alter non-UAT routes', () => {
  vi.stubEnv('BILLDESK_ENV', 'PROD');
  vi.stubEnv('UAT_SITE_PREVIEW', 'true');
  expect(proxy(new NextRequest('https://fixture.invalid/api/paytm/initiate', { method: 'POST' }))
    .headers.get('x-middleware-next')).toBe('1');
});
