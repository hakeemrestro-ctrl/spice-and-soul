import { BILLDESK_CLIENT_ID, BILLDESK_MERCID, getBillDeskTransactionStatus, verifyJwsToken } from './billdesk';
import type { PendingOrderRow } from './fulfill-order';
import type { BilldeskAuditOperation } from './billdesk-audit';

export type PaymentOutcome = { status: 'paid' | 'pending' | 'failed' | 'review'; txnId?: string };
type Message = Record<string, unknown>;
export interface BilldeskStore {
  claim(orderId: string, txnId: string | null, status: string, amount: number): Promise<{
    action: 'claimed' | 'paid' | 'pending' | 'failed' | 'review'; pending?: PendingOrderRow; txnId?: string;
  }>;
  finish(orderId: string, txnId: string, complete: boolean): Promise<void>;
}

export function amountInPaise(value: unknown): number {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,7})(\.[0-9]{1,2})?$/.test(value)) throw new Error('Invalid BillDesk amount');
  const [whole, fraction = ''] = value.split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(paise) || paise <= 0) throw new Error('Invalid BillDesk amount');
  return paise;
}

export function validatePayment(message: Message, orderId?: string) {
  if (typeof message.orderid !== 'string' || !/^BD_[a-zA-Z0-9_]{1,116}$/.test(message.orderid) ||
      (orderId !== undefined && message.orderid !== orderId) || message.mercid !== BILLDESK_MERCID ||
      (message.clientid !== undefined && message.clientid !== BILLDESK_CLIENT_ID) || message.currency !== '356' ||
      typeof message.auth_status !== 'string' ||
      !['0300', '0002', '0399'].includes(message.auth_status)) throw new Error('Invalid BillDesk payment binding');
  if (message.transactionid !== undefined &&
      (typeof message.transactionid !== 'string' || !/^[a-zA-Z0-9]{14,35}$/.test(message.transactionid))) {
    throw new Error('Invalid BillDesk transaction identifier');
  }
  if (message.auth_status === '0300' && !message.transactionid) throw new Error('Missing BillDesk transaction identifier');
  return { orderId: message.orderid, txnId: message.transactionid as string | undefined,
    status: message.auth_status as string, amount: amountInPaise(message.amount) };
}

export async function processBilldeskPayment(token: string, deps: {
  store: BilldeskStore;
  fulfill: (pending: PendingOrderRow, txnId: string) => Promise<void>;
  verify?: typeof verifyJwsToken;
  retrieve?: typeof getBillDeskTransactionStatus;
  audit?: (orderId: string, operation: BilldeskAuditOperation, rawToken: string) => Promise<void>;
}): Promise<PaymentOutcome> {
  const verified = await (deps.verify ?? verifyJwsToken)(token);
  const notification = validatePayment(verified.payload);

  // Only authenticated, structurally valid inbound payment tokens are retained.
  // Preserve the original string; do not serialize the decrypted payload.
  if (deps.audit) {
    await deps.audit(notification.orderId, 'webhook_response', token);
  }

  const retrievedPayload = await (deps.retrieve ?? getBillDeskTransactionStatus)(
    notification.orderId,
    deps.audit ? (op, raw) => deps.audit!(notification.orderId, op, raw) : undefined,
  );
  const retrieved = validatePayment(retrievedPayload, notification.orderId);

  if (notification.amount !== retrieved.amount ||
      (notification.txnId && retrieved.txnId && notification.txnId !== retrieved.txnId)) {
    throw new Error('BillDesk notification and retrieval disagree');
  }
  // Retrieve is authoritative: a delayed pending/failure notification can coexist
  // with a now-successful retrieval. Never key a success claim on pending events.
  const claim = await deps.store.claim(retrieved.orderId, retrieved.txnId ?? null, retrieved.status, retrieved.amount);
  if (claim.action !== 'claimed') return { status: claim.action, txnId: claim.txnId };
  if (!claim.pending || !retrieved.txnId) throw new Error('Invalid BillDesk claim');
  try {
    await deps.fulfill(claim.pending, retrieved.txnId);
  } catch {
    // Shared fulfillment has non-transactional external effects. An ambiguous
    // failure must require reconciliation, not automatic replay and double mail.
    await deps.store.finish(retrieved.orderId, retrieved.txnId, false);
    return { status: 'review', txnId: retrieved.txnId };
  }
  await deps.store.finish(retrieved.orderId, retrieved.txnId, true);
  return { status: 'paid', txnId: retrieved.txnId };
}
