import 'server-only';
import { createAdminClient } from './supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';

export type BilldeskAuditOperation =
  | 'create_order_request'
  | 'create_order_response'
  | 'retrieve_transaction_request'
  | 'retrieve_transaction_response'
  | 'callback_response'
  | 'webhook_response';

/**
 * Persists the supplied encoded string unchanged. Timing is caller-specific:
 * requests before dispatch; successful adapter JOSE bodies before verification;
 * inbound callback/webhook tokens after signature and envelope validation.
 * Rejected inbound tokens and transport/non-success adapter bodies are excluded.
 * This is not a universal wire capture or a claim that every stored body is valid.
 *
 * Security:
 * - Operates strictly with service_role client.
 * - Table has RLS enabled with permissions revoked from public, anon, and authenticated.
 * - Raw tokens, encryption passwords, and secrets are NEVER logged to stdout/stderr.
 */
export async function recordBilldeskRawAudit(
  orderId: string,
  operation: BilldeskAuditOperation,
  rawToken: string,
  client?: SupabaseClient,
): Promise<void> {
  if (!orderId || typeof rawToken !== 'string' || !rawToken) {
    throw new Error('BillDesk audit input unavailable');
  }

  const db = client ?? createAdminClient();
  try {
    const { error: rpcErr } = await db.rpc('billdesk_record_raw_audit', {
      p_order_id: orderId,
      p_operation: operation,
      p_raw_token: rawToken,
    });
    if (rpcErr) throw new Error('BillDesk audit persistence unavailable');
  } catch {
    // Callers stop dispatch/claiming or webhook success acknowledgement on failure.
    // The browser callback instead returns a generic pending redirect.
    // Keep database details and raw tokens out of the error surface.
    throw new Error('BillDesk audit persistence unavailable');
  }
}
