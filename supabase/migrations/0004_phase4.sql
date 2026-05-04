-- Phase 4: Subscriptions (payment plans), certificates, gift orders

-- ── Subscriptions (installment plans) ────────────────────────────────────────
CREATE TABLE public.subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id               UUID NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  stripe_subscription_id  TEXT NOT NULL UNIQUE,
  stripe_customer_id      TEXT NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete')),
  monthly_cents           INT NOT NULL,
  total_cents             INT NOT NULL,
  installments_total      INT NOT NULL DEFAULT 3,
  installments_paid       INT NOT NULL DEFAULT 0,
  customer_email          TEXT NOT NULL,
  customer_name           TEXT,
  started_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  canceled_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_user_id               ON public.subscriptions (user_id);
CREATE INDEX idx_subscriptions_course_id             ON public.subscriptions (course_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON public.subscriptions (stripe_subscription_id);
CREATE INDEX idx_subscriptions_status                ON public.subscriptions (status);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions_admin_all" ON public.subscriptions FOR ALL USING (auth.jwt() ->> 'is_admin' = 'true');


-- ── Certificates ──────────────────────────────────────────────────────────────
CREATE TABLE public.certificates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  customer_name   TEXT NOT NULL,
  customer_email  TEXT NOT NULL,
  certificate_url TEXT,        -- storage URL once generated
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_certificates_order_id  ON public.certificates (order_id);
CREATE INDEX idx_certificates_course_id ON public.certificates (course_id);

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "certificates_admin_all" ON public.certificates FOR ALL USING (auth.jwt() ->> 'is_admin' = 'true');


-- ── Gift orders ───────────────────────────────────────────────────────────────
CREATE TABLE public.gift_orders (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_order_id       UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_email          TEXT NOT NULL,
  sender_name           TEXT,
  recipient_email       TEXT NOT NULL,
  recipient_name        TEXT,
  course_id             UUID NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
  message               TEXT,
  redemption_token      UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  redeemed_at           TIMESTAMPTZ,
  redeemed_order_id     UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_gift_orders_sender_order_id    ON public.gift_orders (sender_order_id);
CREATE INDEX idx_gift_orders_recipient_email    ON public.gift_orders (lower(recipient_email));
CREATE INDEX idx_gift_orders_redemption_token   ON public.gift_orders (redemption_token);

ALTER TABLE public.gift_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gift_orders_admin_all"   ON public.gift_orders FOR ALL    USING (auth.jwt() ->> 'is_admin' = 'true');
CREATE POLICY "gift_orders_insert_anon" ON public.gift_orders FOR INSERT WITH CHECK (true);
