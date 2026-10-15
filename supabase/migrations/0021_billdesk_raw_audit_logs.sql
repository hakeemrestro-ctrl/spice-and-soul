-- PREPARED ONLY: validate on an isolated database before application. No live migration.
-- Selected encoded BillDesk messages, unchanged; see the UAT plan for capture exclusions.
-- Apply as the trusted migration owner (normally postgres), NOT service_role.
-- Retention duration/legal holds/backup expiry require owner approval before UAT.
-- No automatic deletion is configured. A separate privileged operator must handle
-- approved retention deletion; the application has only EXECUTE on the insert RPC.
-- Owner/superuser access remains: this is not tamper-proof or immutable storage.
CREATE TABLE public.billdesk_raw_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL,
  operation text NOT NULL CHECK (operation IN (
    'create_order_request',
    'create_order_response',
    'retrieve_transaction_request',
    'retrieve_transaction_response',
    'callback_response',
    'webhook_response'
  )),
  raw_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_billdesk_raw_audit_order_id ON public.billdesk_raw_audit_logs(order_id);

ALTER TABLE public.billdesk_raw_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billdesk_raw_audit_logs FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.billdesk_record_raw_audit(
  p_order_id text,
  p_operation text,
  p_raw_token text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_order_id IS NULL OR p_operation IS NULL OR p_raw_token IS NULL THEN
    RAISE EXCEPTION 'Invalid raw audit parameters';
  END IF;
  IF p_operation NOT IN (
    'create_order_request',
    'create_order_response',
    'retrieve_transaction_request',
    'retrieve_transaction_response',
    'callback_response',
    'webhook_response'
  ) THEN
    RAISE EXCEPTION 'Unsupported audit operation';
  END IF;
  INSERT INTO public.billdesk_raw_audit_logs(order_id, operation, raw_token)
  VALUES (p_order_id, p_operation, p_raw_token);
END;
$$;

REVOKE ALL ON FUNCTION public.billdesk_record_raw_audit(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billdesk_record_raw_audit(text, text, text) TO service_role;
