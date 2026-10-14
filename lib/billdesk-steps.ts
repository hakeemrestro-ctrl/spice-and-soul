import 'server-only';
import { randomUUID } from 'node:crypto';
export const BILLDESK_STEPS = ['snapshot','user','parent_order','child_orders','coupon','recipe_documents','invoice_document',
  'welcome_email','invoice_email','gift_order','gift_documents','gift_email','certificate_document','certificate_record','certificate_email'] as const;
export type StepName = typeof BILLDESK_STEPS[number];
export interface StepStore {
  prepare(): Promise<void>;
  claim(step: StepName, owner: string): Promise<{ state: string; result: unknown }>;
  finish(step: StepName, owner: string, state: 'completed' | 'failed' | 'unknown', result: unknown): Promise<void>;
}
export function stepRunner(store: StepStore) {
  return async function run<T>(step: StepName, external: boolean, work: () => Promise<T>): Promise<T> {
    const owner = randomUUID();
    const claim = await store.claim(step, owner);
    if (claim.state === 'completed') return claim.result as T;
    if (claim.state !== 'claimed') throw new Error('Fulfillment step requires reconciliation');
    try {
      const result = await work();
      await store.finish(step, owner, 'completed', result);
      return result;
    } catch {
      // External uncertainty must not automatically replay. Crash-before-finish
      // leaves running, which also blocks replay until an operator reconciles it.
      await store.finish(step, owner, external ? 'unknown' : 'failed', null).catch(() => {});
      throw new Error('Fulfillment step incomplete');
    }
  };
}
