-- PREPARED ONLY. Service-role-only durable results may contain private artifacts/PII.
-- Do not expose this table through customer-facing APIs, logs or analytics.
-- Existing claims have unknown legacy effects. Do NOT initialize a fresh plan
-- for them; only new claims get this default after the column has been added.
ALTER TABLE public.billdesk_payment_claims ADD COLUMN fulfillment_version text;
ALTER TABLE public.billdesk_payment_claims ALTER COLUMN fulfillment_version SET DEFAULT 'steps-v1';
CREATE TABLE public.billdesk_fulfillment_steps (
 order_id text NOT NULL REFERENCES public.billdesk_payment_claims(order_id),
 step text NOT NULL,
 state text NOT NULL CHECK(state IN ('pending','running','completed','failed','unknown')),
 owner uuid,
 result jsonb,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(order_id,step)
);
ALTER TABLE public.billdesk_fulfillment_steps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billdesk_fulfillment_steps FROM PUBLIC,anon,authenticated;
CREATE TABLE public.billdesk_step_reconciliations (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id text NOT NULL,
 step text NOT NULL,
 evidence_ref text NOT NULL,
 resolution text NOT NULL CHECK(resolution IN ('not_applied','completed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(order_id,step) REFERENCES public.billdesk_fulfillment_steps(order_id,step)
);
ALTER TABLE public.billdesk_step_reconciliations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billdesk_step_reconciliations FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.billdesk_step(p_order_id text,p_txn_id text,p_action text,p_step text DEFAULT NULL,
 p_owner uuid DEFAULT NULL,p_state text DEFAULT NULL,p_result jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.billdesk_fulfillment_steps%ROWTYPE;
 names text[] := ARRAY['snapshot','user','parent_order','child_orders','coupon','recipe_documents','invoice_document',
 'welcome_email','invoice_email','gift_order','gift_documents','gift_email','certificate_document','certificate_record','certificate_email'];
BEGIN
 PERFORM 1 FROM public.billdesk_payment_claims WHERE order_id=p_order_id AND txn_id=p_txn_id AND state IN ('processing','review') AND fulfillment_version='steps-v1' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active fulfillment unavailable'; END IF;
 IF p_action='prepare' THEN
   INSERT INTO public.billdesk_fulfillment_steps(order_id,step,state)
     SELECT p_order_id,unnest(names),'pending' ON CONFLICT DO NOTHING;
   RETURN '{}'::jsonb;
 END IF;
 IF p_step IS NULL OR NOT(p_step=ANY(names)) THEN RAISE EXCEPTION 'Invalid step'; END IF;
 SELECT * INTO s FROM public.billdesk_fulfillment_steps WHERE order_id=p_order_id AND step=p_step FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Missing fulfillment plan'; END IF;
 IF p_action='claim' THEN
   IF s.state='completed' THEN RETURN jsonb_build_object('state','completed','result',s.result); END IF;
   IF s.state NOT IN ('pending','failed') THEN RETURN jsonb_build_object('state','review'); END IF;
   IF p_owner IS NULL THEN RAISE EXCEPTION 'Owner required'; END IF;
   UPDATE public.billdesk_fulfillment_steps SET state='running',owner=p_owner,updated_at=now() WHERE order_id=p_order_id AND step=p_step;
   RETURN jsonb_build_object('state','claimed');
 ELSIF p_action='finish' THEN
   IF p_state IS NULL OR p_state NOT IN ('completed','failed','unknown') THEN RAISE EXCEPTION 'Invalid state'; END IF;
   UPDATE public.billdesk_fulfillment_steps SET state=p_state,result=p_result,updated_at=now()
    WHERE order_id=p_order_id AND step=p_step AND state='running' AND owner=p_owner;
   IF NOT FOUND THEN RAISE EXCEPTION 'Step owner mismatch'; END IF;
   RETURN '{}'::jsonb;
 END IF;
 RAISE EXCEPTION 'Invalid action';
END;
$$;

-- No HTTP route calls this. An operator must stop all workers for this order,
-- inspect provider/database evidence and explicitly attest quiescence. No TTL replay.
CREATE FUNCTION public.billdesk_reconcile_step(p_order_id text,p_step text,p_resolution text,p_result jsonb,
 p_evidence_ref text,p_workers_stopped boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF p_workers_stopped IS DISTINCT FROM true OR p_evidence_ref IS NULL OR length(p_evidence_ref)<8 OR
 p_resolution IS NULL OR p_resolution NOT IN ('not_applied','completed') THEN RAISE EXCEPTION 'Reconciliation evidence required'; END IF;
 PERFORM 1 FROM public.billdesk_payment_claims WHERE order_id=p_order_id AND state IN ('review','processing') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Claim unavailable'; END IF;
 UPDATE public.billdesk_fulfillment_steps SET state=CASE WHEN p_resolution='completed' THEN 'completed' ELSE 'pending' END,
   result=CASE WHEN p_resolution='completed' THEN p_result ELSE NULL END,owner=NULL,updated_at=now()
 WHERE order_id=p_order_id AND step=p_step AND state IN ('running','unknown','failed');
 IF NOT FOUND THEN RAISE EXCEPTION 'Step not reconcilable'; END IF;
 INSERT INTO public.billdesk_step_reconciliations(order_id,step,evidence_ref,resolution) VALUES(p_order_id,p_step,p_evidence_ref,p_resolution);
END;
$$;

CREATE OR REPLACE FUNCTION public.billdesk_finish_payment(p_order_id text,p_txn_id text,p_complete boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF p_complete IS NULL THEN RAISE EXCEPTION 'Completion state required'; END IF;
 PERFORM 1 FROM public.pending_orders WHERE order_id=p_order_id FOR UPDATE;
 PERFORM 1 FROM public.billdesk_payment_claims WHERE order_id=p_order_id AND txn_id=p_txn_id AND state IN ('processing','review') FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active claim unavailable'; END IF;
 IF p_complete AND (NOT EXISTS(SELECT 1 FROM public.billdesk_payment_claims WHERE order_id=p_order_id AND fulfillment_version='steps-v1') OR
   (SELECT count(*) FROM public.billdesk_fulfillment_steps WHERE order_id=p_order_id) <> 15 OR
   EXISTS(SELECT 1 FROM public.billdesk_fulfillment_steps WHERE order_id=p_order_id AND state<>'completed')) THEN
   RAISE EXCEPTION 'Required fulfillment incomplete';
 END IF;
 UPDATE public.billdesk_payment_claims SET state=CASE WHEN p_complete THEN 'completed' ELSE 'review' END,updated_at=now() WHERE order_id=p_order_id;
 UPDATE public.pending_orders SET status=CASE WHEN p_complete THEN 'paid' ELSE 'paid_unfulfilled' END,
 resp_msg=CASE WHEN p_complete THEN 'BillDesk required steps completed; email acceptance recorded' ELSE 'BillDesk fulfillment requires review' END
 WHERE order_id=p_order_id AND txn_id=p_txn_id AND status='paid_unfulfilled';
 IF NOT FOUND THEN RAISE EXCEPTION 'Payment state mismatch'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.billdesk_step(text,text,text,text,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.billdesk_reconcile_step(text,text,text,jsonb,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.billdesk_step(text,text,text,text,uuid,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.billdesk_reconcile_step(text,text,text,jsonb,text,boolean) TO service_role;
