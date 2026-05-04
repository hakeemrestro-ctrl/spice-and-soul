-- Bundle order expansion: one Stripe payment can produce multiple orders rows
-- (one parent row + N child rows, one per included course). Lets dashboard /
-- analytics / refunds operate per-course while keeping a single payment trail.

ALTER TABLE public.orders
  ADD COLUMN parent_order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE;

CREATE INDEX idx_orders_parent_order_id ON public.orders(parent_order_id);

-- Drop scalar UNIQUE constraints — they prevented N child rows sharing the same
-- payment intent / invoice number. Replace with a composite uniqueness check
-- per (payment_intent, course) so a single child course is never inserted twice.
ALTER TABLE public.orders DROP CONSTRAINT orders_stripe_payment_intent_id_key;
ALTER TABLE public.orders DROP CONSTRAINT orders_invoice_number_key;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_intent_course_unique
  UNIQUE (stripe_payment_intent_id, course_id);
