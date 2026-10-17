import 'server-only';

export type ReconciliationRow = { orderId: string; createdAt: string; status: string; gateway: string };
export type LateSuccessPolicy = 'unconfirmed' | 'auto-cancel' | 'settle';
const istDay = (time: number) => new Date(time + 330 * 60000).toISOString().slice(0, 10);

/** Pure dry-run plan: no credentials, database writes, network or automatic retries. */
export function planBilldeskReconciliation(rows: readonly ReconciliationRow[], now: Date,
  policy: LateSuccessPolicy = 'unconfirmed') {
  if (!Number.isFinite(now.getTime()) || !['unconfirmed', 'auto-cancel', 'settle'].includes(policy)) {
    throw new Error('Invalid reconciliation input');
  }
  const seen = new Set<string>();
  return rows.map(row => {
    const created = Date.parse(row.createdAt);
    let action: 'skip' | 'wait' | 'review' | 'retrieve-candidate' = 'review';
    let reason = 'invalid-order';
    if (seen.has(row.orderId)) throw new Error('Duplicate reconciliation order');
    seen.add(row.orderId);
    if (row.gateway !== 'billdesk') { action = 'skip'; reason = 'other-gateway'; }
    else if (!/^(?:BD[a-f0-9]{32}|BD_[A-Za-z0-9_]{1,116})$/.test(row.orderId) ||
      !Number.isFinite(created) || created > now.getTime()) { reason = 'invalid-order'; }
    else if (['paid', 'failed'].includes(row.status)) { action = 'skip'; reason = 'terminal'; }
    else if (!['pending', 'dropped'].includes(row.status)) { reason = 'ambiguous-state'; }
    else if (now.getTime() - created < 60 * 60000) { action = 'wait'; reason = 'before-60-minutes'; }
    else if (policy === 'unconfirmed') { reason = 'late-success-policy-unconfirmed'; }
    else if (policy === 'auto-cancel' && istDay(created) !== istDay(now.getTime())) {
      reason = 'same-day-retrieve-only';
    } else { action = 'retrieve-candidate'; reason = 'pending-at-least-60-minutes'; }
    return { orderId: row.orderId, action, reason, dispatch: false as const, allowNewPayment: false as const };
  });
}
