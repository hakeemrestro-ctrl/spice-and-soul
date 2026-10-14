import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Checkout from '../../app/(marketing)/checkout/checkout-client';
import type { Course } from '../../types';

const course: Course = {
  id: 'fixture', slug: 'fixture', title: 'Fixture course', tagline: 'Fixture',
  description: 'Fixture', price_cents: 10000, difficulty: 'Beginner', recipe_count: 1,
  image_url: null, published: true, is_bundle: false, bundle_course_ids: null,
  stripe_price_id: null, region: null, preview_video_url: null, created_at: '2026-01-01T00:00:00Z',
};
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_PAYGLOCAL_ENABLED', 'true');
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Network forbidden'); }));
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

for (const flag of [undefined, 'false', 'TRUE']) it(`hides BillDesk without exact opt-in (${flag}) and preserves other choices`, () => {
  vi.stubEnv('NEXT_PUBLIC_BILLDESK_ENABLED', flag);
  render(<Checkout course={course} />);
  expect(screen.queryByRole('button', { name: /BillDesk/ })).toBeNull();
  expect(screen.getByRole('button', { name: /Paytm/ })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: /PayGlocal/ }));
  expect(screen.getByRole('button', { name: /PayGlocal/ })).toHaveAttribute('aria-pressed', 'true');
  expect(fetch).not.toHaveBeenCalled();
});
it('adds BillDesk only with explicit opt-in without changing the default payment method', () => {
  vi.stubEnv('NEXT_PUBLIC_BILLDESK_ENABLED', 'true');
  render(<Checkout course={course} />);
  expect(screen.getByRole('button', { name: /Paytm/ })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: /BillDesk/ }));
  expect(screen.getByRole('button', { name: /BillDesk/ })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: /PayGlocal/ })).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});
