import 'server-only';
type Operation = 'initiate' | 'callback' | 'webhook' | 'fulfillment';
type Category = 'accepted' | 'rejected' | 'unknown' | 'completed' | 'review';
export function billdeskLog(operation: Operation, category: Category, correlationId: string, durationMs: number) {
  // Construct an allowlisted object; do not spread caller objects or accept errors.
  console.info(JSON.stringify({ operation, category,
    correlationId: /^[a-f0-9-]{36}$/i.test(correlationId) ? correlationId : 'invalid',
    durationMs: Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : 0 }));
}
