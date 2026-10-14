-- PREPARED ONLY: apply to an isolated UAT database after review, never automatically.
-- BillDesk-specific durable, non-expiring claim. Do not auto-reclaim after a crash:
-- external email/fulfillment effects cannot be rolled back. Reconcile manually.
CREATE TABLE public.billdesk_payment_claims (
  order_id text PRIMARY KEY REFERENCES public.pending_orders(order_id),
  txn_id text NOT NULL UNIQUE,
  state text NOT NULL CHECK (state IN ('processing', 'completed', 'review')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.billdesk_payment_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billdesk_payment_claims FROM anon, authenticated;

CREATE FUNCTION public.billdesk_claim_payment(p_order_id text, p_txn_id text, p_status text, p_amount bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.pending_orders%ROWTYPE; c public.billdesk_payment_claims%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.pending_orders WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND OR p.metadata->>'paymentGateway' IS DISTINCT FROM 'billdesk' THEN
    RAISE EXCEPTION 'BillDesk order unavailable';
  END IF;
  IF p_amount IS NULL OR p_amount <> p.amount_cents OR p_amount <= 0 THEN
    RAISE EXCEPTION 'BillDesk amount mismatch';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('0300', '0002', '0399') THEN
    RAISE EXCEPTION 'Unsupported BillDesk status';
  END IF;
  SELECT * INTO c FROM public.billdesk_payment_claims WHERE order_id = p_order_id;
  IF FOUND THEN
    IF p_txn_id IS NOT NULL AND p_txn_id <> c.txn_id THEN RAISE EXCEPTION 'BillDesk transaction mismatch'; END IF;
    RETURN jsonb_build_object('action', CASE WHEN c.state = 'completed' THEN 'paid' ELSE 'review' END, 'txnId', c.txn_id);
  END IF;
  -- Legacy paid orders are never re-fulfilled or downgraded.
  IF p.status IN ('paid', 'paid_unfulfilled') THEN
    IF p_txn_id IS NOT NULL AND p.txn_id IS DISTINCT FROM p_txn_id THEN RAISE EXCEPTION 'BillDesk transaction mismatch'; END IF;
    RETURN jsonb_build_object('action', CASE WHEN p.status = 'paid' THEN 'paid' ELSE 'review' END, 'txnId', p.txn_id);
  END IF;
  IF p_status = '0002' THEN RETURN jsonb_build_object('action', 'pending'); END IF;
  IF p_status = '0399' THEN
    UPDATE public.pending_orders SET status = 'failed', resp_code = '0399', resp_msg = 'BillDesk payment failed'
    WHERE order_id = p_order_id AND status IN ('pending', 'failed', 'expired');
    RETURN jsonb_build_object('action', 'failed');
  END IF;
  IF p_txn_id IS NULL OR p_txn_id !~ '^[A-Za-z0-9]{14,35}$' THEN RAISE EXCEPTION 'Invalid BillDesk transaction'; END IF;
  INSERT INTO public.billdesk_payment_claims(order_id, txn_id, state) VALUES (p_order_id, p_txn_id, 'processing');
  UPDATE public.pending_orders SET status = 'paid_unfulfilled', txn_id = p_txn_id,
    resp_code = '0300', resp_msg = 'BillDesk fulfillment claimed' WHERE order_id = p_order_id;
  RETURN jsonb_build_object('action', 'claimed', 'pending', to_jsonb(p), 'txnId', p_txn_id);
END;
$$;

CREATE FUNCTION public.billdesk_finish_payment(p_order_id text, p_txn_id text, p_complete boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Same lock order as claim; only the unique claimant can reach this call.
  PERFORM 1 FROM public.pending_orders WHERE order_id = p_order_id FOR UPDATE;
  UPDATE public.billdesk_payment_claims SET state = CASE WHEN p_complete THEN 'completed' ELSE 'review' END,
    updated_at = now() WHERE order_id = p_order_id AND txn_id = p_txn_id AND state = 'processing';
  IF NOT FOUND THEN RAISE EXCEPTION 'BillDesk active claim unavailable'; END IF;
  UPDATE public.pending_orders SET status = CASE WHEN p_complete THEN 'paid' ELSE 'paid_unfulfilled' END,
    resp_msg = CASE WHEN p_complete THEN 'BillDesk fulfillment returned' ELSE 'BillDesk fulfillment requires review' END
    WHERE order_id = p_order_id AND txn_id = p_txn_id AND status = 'paid_unfulfilled';
  IF NOT FOUND THEN RAISE EXCEPTION 'BillDesk completion state mismatch'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.billdesk_claim_payment(text,text,text,bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billdesk_finish_payment(text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billdesk_claim_payment(text,text,text,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.billdesk_finish_payment(text,text,boolean) TO service_role;
