-- PREPARED ONLY: validate on an isolated database before application. No live migration.
CREATE TABLE public.billdesk_checkout_attempts (
  attempt_id uuid PRIMARY KEY,
  -- SHA-256/HMAC pseudonymous binding. Never store the customer email here.
  actor_ref text NOT NULL CHECK (actor_ref ~ '^[a-f0-9]{64}$'),
  course_id uuid NOT NULL REFERENCES public.courses(id),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  order_id text NOT NULL UNIQUE REFERENCES public.pending_orders(order_id),
  state text NOT NULL CHECK (state IN ('started','unknown','responded')),
  response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- One unresolved/purchased course per bound tester/customer. A fresh browser
  -- key cannot bypass an ambiguous attempt. A repeat purchase needs review.
  UNIQUE(actor_ref, course_id),
  CHECK ((state = 'responded') = (response IS NOT NULL))
);
ALTER TABLE public.billdesk_checkout_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.billdesk_checkout_attempts FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.billdesk_reserve_checkout(p_attempt_id uuid, p_actor_ref text, p_course_id uuid,
 p_amount bigint, p_fingerprint text, p_order_id text, p_email text, p_name text, p_metadata jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.billdesk_checkout_attempts%ROWTYPE;
BEGIN
  IF p_actor_ref IS NULL OR p_actor_ref !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid checkout actor'; END IF;
  -- Serialize all attempts for the same bound customer, including different keys.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor_ref, 0));
  SELECT * INTO a FROM public.billdesk_checkout_attempts WHERE attempt_id = p_attempt_id;
  IF FOUND THEN
    IF a.actor_ref IS DISTINCT FROM p_actor_ref OR a.course_id IS DISTINCT FROM p_course_id OR
       a.amount_cents IS DISTINCT FROM p_amount OR a.fingerprint IS DISTINCT FROM p_fingerprint THEN
      RAISE EXCEPTION 'Checkout binding mismatch';
    END IF;
    RETURN jsonb_build_object('dispatch', false, 'orderId', a.order_id, 'state', a.state, 'response', a.response);
  END IF;
  IF EXISTS(SELECT 1 FROM public.billdesk_checkout_attempts WHERE actor_ref = p_actor_ref AND course_id = p_course_id) THEN
    RAISE EXCEPTION 'Existing checkout requires reconciliation';
  END IF;
  IF p_metadata->>'paymentGateway' IS DISTINCT FROM 'billdesk' THEN RAISE EXCEPTION 'Invalid gateway'; END IF;
  INSERT INTO public.pending_orders(order_id,course_id,amount_cents,customer_email,customer_name,metadata,status)
    VALUES(p_order_id,p_course_id,p_amount,p_email,p_name,p_metadata,'pending');
  INSERT INTO public.billdesk_checkout_attempts(attempt_id,actor_ref,course_id,amount_cents,fingerprint,order_id,state)
    VALUES(p_attempt_id,p_actor_ref,p_course_id,p_amount,p_fingerprint,p_order_id,'started');
  RETURN jsonb_build_object('dispatch',true,'orderId',p_order_id,'state','started');
END;
$$;
CREATE FUNCTION public.billdesk_finish_checkout(p_order_id text, p_state text, p_response jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_state IS NULL OR p_state NOT IN ('unknown','responded') THEN RAISE EXCEPTION 'Invalid checkout state'; END IF;
  UPDATE public.billdesk_checkout_attempts SET state=p_state,response=p_response WHERE order_id=p_order_id AND state='started';
  IF NOT FOUND THEN RAISE EXCEPTION 'Checkout transition unavailable'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.billdesk_reserve_checkout(uuid,text,uuid,bigint,text,text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.billdesk_finish_checkout(text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.billdesk_reserve_checkout(uuid,text,uuid,bigint,text,text,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.billdesk_finish_checkout(text,text,jsonb) TO service_role;
