import 'server-only';
import { createHash } from 'node:crypto';
export type CheckoutBinding = { actorRef: string; attemptId: string; courseId: string; amount: number; email: string; name: string; coupon: string };
export function checkoutFingerprint(binding: CheckoutBinding) {
  if (!/^[a-f0-9]{64}$/.test(binding.actorRef) || !/^[a-f0-9-]{36}$/.test(binding.attemptId) || !Number.isSafeInteger(binding.amount) || binding.amount <= 0) throw new Error('Invalid checkout attempt');
  return createHash('sha256').update(JSON.stringify([binding.actorRef, binding.attemptId, binding.courseId,
    binding.amount, binding.email, binding.name, binding.coupon])).digest('hex');
}
export type CheckoutReservation = { dispatch: boolean; orderId: string; state: 'started' | 'unknown' | 'responded'; response?: Record<string, unknown> };
export interface CheckoutStore {
  reserve(binding: CheckoutBinding, fingerprint: string): Promise<CheckoutReservation>;
  finish(orderId: string, state: 'unknown' | 'responded', response: Record<string, unknown> | null): Promise<void>;
}
export async function runBilldeskCheckout(binding: CheckoutBinding, store: CheckoutStore,
  dispatch: (orderId: string) => Promise<Record<string, unknown>>) {
  const reservation = await store.reserve(binding, checkoutFingerprint(binding));
  if (!reservation.dispatch) {
    if (reservation.state === 'responded' && reservation.response) return reservation.response;
    // A persisted started record after a crash is just as ambiguous as a timeout.
    throw new Error('CHECKOUT_REQUIRES_RECONCILIATION');
  }
  try {
    const response = await dispatch(reservation.orderId);
    await store.finish(reservation.orderId, 'responded', response);
    return response;
  } catch (err: unknown) {
    // Failure to save unknown leaves started; neither state allows another dispatch.
    await store.finish(reservation.orderId, 'unknown', null).catch(() => {});
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`CHECKOUT_REQUIRES_RECONCILIATION: ${msg}`);
  }
}
