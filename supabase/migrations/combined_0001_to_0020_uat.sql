BEGIN;

-- ======================================================================
-- Combined UAT Migrations 0001 through 0020 for project: spice-and-soul-uat
-- Target Ref: alytmroxgxmybvjgevhn
-- Generated: 2026-10-14T19:07:31.717Z
-- ======================================================================

-- ==========================================
-- MIGRATION: 0001_init.sql
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users (mirrors Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Courses (includes bundles via is_bundle flag)
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  price_cents INTEGER NOT NULL,
  difficulty TEXT,
  recipe_count INTEGER DEFAULT 0,
  image_url TEXT,
  published BOOLEAN DEFAULT FALSE,
  is_bundle BOOLEAN DEFAULT FALSE,
  bundle_course_ids UUID[] DEFAULT NULL,
  stripe_price_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recipes
CREATE TABLE public.recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  servings INTEGER,
  ingredients JSONB,
  steps JSONB,
  tips JSONB,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  course_id UUID REFERENCES public.courses(id),
  stripe_payment_intent_id TEXT UNIQUE NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT DEFAULT 'pending',
  invoice_number TEXT UNIQUE NOT NULL,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  stripe_last4 TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_recipes_course_id ON public.recipes(course_id);
CREATE INDEX idx_recipes_sort_order ON public.recipes(course_id, sort_order);
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_course_id ON public.orders(course_id);
CREATE INDEX idx_orders_status ON public.orders(status);

-- RLS Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Courses: anyone can read published courses
CREATE POLICY "Public can read published courses"
  ON public.courses FOR SELECT
  USING (published = TRUE);

-- Recipes: anyone can read recipes for published courses
CREATE POLICY "Public can read recipes of published courses"
  ON public.recipes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.courses c
      WHERE c.id = course_id AND c.published = TRUE
    )
  );

-- Orders: users can read their own orders
CREATE POLICY "Users can read own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

-- Users: can read own profile
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- MIGRATION: 0002_bundle_orders.sql
-- ==========================================

-- Bundle order expansion: one Stripe payment can produce multiple orders rows
-- (one parent row + N child rows, one per included course). Lets dashboard /
-- analytics / refunds operate per-course while keeping a single payment trail.

ALTER TABLE public.orders
  ADD COLUMN parent_order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE;

CREATE INDEX idx_orders_parent_order_id ON public.orders(parent_order_id);

-- Drop scalar UNIQUE constraints — they prevented N child rows sharing the same
-- payment intent / invoice number. Replace with a composite uniqueness check
-- per (payment_intent, course) so a single child course is never inserted twice.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_stripe_payment_intent_id_key;
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_invoice_number_key;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_payment_intent_course_unique
  UNIQUE (stripe_payment_intent_id, course_id);

-- ==========================================
-- MIGRATION: 0003_phase3.sql
-- ==========================================

-- Phase 3: Lead-magnet subscribers, reviews, coupons, reservations
-- + extend orders with coupon_code and acquisition_source

-- ── Subscribers ───────────────────────────────────────────────────────────────
CREATE TABLE public.subscribers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT NOT NULL,
  name               TEXT,
  source             TEXT NOT NULL DEFAULT 'website',  -- 'website' | 'reservation' | 'checkout'
  sampler_sent_at    TIMESTAMPTZ,
  last_drip_step     INT NOT NULL DEFAULT 0,
  last_drip_sent_at  TIMESTAMPTZ,
  unsubscribed_at    TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_subscribers_email ON public.subscribers (lower(email));
CREATE INDEX idx_subscribers_source      ON public.subscribers (source);

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
-- Admins may read/write; public may insert (lead magnet signup)
CREATE POLICY "subscribers_admin_all"   ON public.subscribers FOR ALL    USING (auth.jwt() ->> 'is_admin' = 'true');
CREATE POLICY "subscribers_insert_anon" ON public.subscribers FOR INSERT WITH CHECK (true);


-- ── Reviews ───────────────────────────────────────────────────────────────────
CREATE TABLE public.reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id       UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  order_id        UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  rating          INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body            TEXT,
  customer_name   TEXT NOT NULL,
  customer_email  TEXT NOT NULL,
  token           UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  published       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_course_id  ON public.reviews (course_id);
CREATE INDEX idx_reviews_token      ON public.reviews (token);
CREATE INDEX idx_reviews_published  ON public.reviews (published) WHERE published = true;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_admin_all"     ON public.reviews FOR ALL    USING (auth.jwt() ->> 'is_admin' = 'true');
CREATE POLICY "reviews_read_published" ON public.reviews FOR SELECT USING (published = true);
-- Anyone with the right token may insert (magic-link review submission)
CREATE POLICY "reviews_insert_anon"   ON public.reviews FOR INSERT WITH CHECK (true);


-- ── Coupons ───────────────────────────────────────────────────────────────────
CREATE TABLE public.coupons (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT NOT NULL,
  discount_percent      INT CHECK (discount_percent BETWEEN 1 AND 100),
  discount_cents        INT CHECK (discount_cents > 0),
  max_uses              INT,
  uses_count            INT NOT NULL DEFAULT 0,
  expires_at            TIMESTAMPTZ,
  applies_to_course_ids UUID[],          -- NULL = applies to all courses
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT coupon_has_discount CHECK (
    (discount_percent IS NOT NULL) OR (discount_cents IS NOT NULL)
  )
);

CREATE UNIQUE INDEX idx_coupons_code ON public.coupons (upper(code));

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coupons_admin_all" ON public.coupons FOR ALL USING (auth.jwt() ->> 'is_admin' = 'true');


-- ── Reservations ──────────────────────────────────────────────────────────────
CREATE TABLE public.reservations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  party_size      INT NOT NULL DEFAULT 2 CHECK (party_size BETWEEN 1 AND 20),
  preferred_date  DATE,
  notes           TEXT,
  source          TEXT NOT NULL DEFAULT 'website',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reservations_email        ON public.reservations (lower(email));
CREATE INDEX idx_reservations_preferred_date ON public.reservations (preferred_date);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reservations_admin_all"   ON public.reservations FOR ALL    USING (auth.jwt() ->> 'is_admin' = 'true');
CREATE POLICY "reservations_insert_anon" ON public.reservations FOR INSERT WITH CHECK (true);


-- ── Extend orders table ───────────────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS coupon_code        TEXT,
  ADD COLUMN IF NOT EXISTS acquisition_source TEXT;

CREATE INDEX idx_orders_coupon_code          ON public.orders (coupon_code) WHERE coupon_code IS NOT NULL;
CREATE INDEX idx_orders_acquisition_source   ON public.orders (acquisition_source) WHERE acquisition_source IS NOT NULL;

-- ==========================================
-- MIGRATION: 0004_phase4.sql
-- ==========================================

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

-- ==========================================
-- MIGRATION: 0005_coupon_rpc.sql
-- ==========================================

-- Atomic coupon redemption counter.
-- Replaces racy read-modify-write in the Stripe webhook handler.
-- Returns new uses_count when increment succeeds, NULL when blocked
-- (inactive, expired, or max_uses reached) so caller can log.

create or replace function public.increment_coupon_use(p_code text)
returns integer
language sql
security definer
set search_path = public
as $$
  update coupons
     set uses_count = uses_count + 1
   where lower(code) = lower(p_code)
     and is_active = true
     and (max_uses is null or uses_count < max_uses)
     and (expires_at is null or expires_at > now())
  returning uses_count;
$$;

revoke all on function public.increment_coupon_use(text) from public;
grant execute on function public.increment_coupon_use(text) to service_role;

-- ==========================================
-- MIGRATION: 0006_reservation_status.sql
-- ==========================================

-- Add status column to reservations for admin workflow tracking.
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'confirmed', 'seated', 'no-show', 'cancelled'));

CREATE INDEX idx_reservations_status ON public.reservations (status);

-- ==========================================
-- MIGRATION: 0007_course_region.sql
-- ==========================================

-- Add region column to courses for filter chips
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS region text;

-- ==========================================
-- MIGRATION: 0008_orders_utm.sql
-- ==========================================

-- Add UTM tracking columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS utm_source   text,
  ADD COLUMN IF NOT EXISTS utm_medium   text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content  text,
  ADD COLUMN IF NOT EXISTS utm_term     text;

-- ==========================================
-- MIGRATION: 0009_course_stats_view.sql
-- ==========================================

-- View for bestseller badge: orders in last 30 days per course
CREATE OR REPLACE VIEW public.mv_course_stats AS
SELECT
  course_id,
  COUNT(*) AS orders_30d
FROM public.orders
WHERE
  status = 'paid'
  AND parent_order_id IS NULL
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY course_id;

-- ==========================================
-- MIGRATION: 0012_webhook_events.sql
-- ==========================================

-- Webhook events audit log + idempotency layer
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id  TEXT         NOT NULL UNIQUE,
  type             TEXT         NOT NULL,
  payload          JSONB        NOT NULL DEFAULT '{}',
  processed_at     TIMESTAMPTZ,
  error            TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- Only service role can access
CREATE POLICY "service_role_only" ON public.webhook_events
  USING (false) WITH CHECK (false);

-- ==========================================
-- MIGRATION: 0015_course_preview_video.sql
-- ==========================================

-- YouTube preview video URL for course detail page
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS preview_video_url TEXT;

-- ==========================================
-- MIGRATION: 0016_pending_orders.sql
-- ==========================================

-- Paytm migration: pending_orders bridges initiate → callback fulfillment.
-- Paytm's callback only echoes ORDERID + TXNID. We need the original courseId,
-- email, name, coupon, and UTM metadata when fulfilling, so we stash them here
-- on initiate and look them up on the server-to-server callback.

CREATE TABLE IF NOT EXISTS pending_orders (
  order_id       TEXT PRIMARY KEY,
  course_id      UUID NOT NULL REFERENCES courses(id),
  amount_cents   INTEGER NOT NULL CHECK (amount_cents > 0),
  customer_email TEXT NOT NULL,
  customer_name  TEXT NOT NULL,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'paid', 'failed', 'expired')),
  txn_id         TEXT,                 -- Paytm TXNID, populated after callback
  resp_code      TEXT,                 -- Paytm response code, for debugging
  resp_msg       TEXT,                 -- Paytm response message
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_orders_status   ON pending_orders(status);
CREATE INDEX IF NOT EXISTS idx_pending_orders_email    ON pending_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_pending_orders_created  ON pending_orders(created_at);

-- updated_at trigger
CREATE OR REPLACE FUNCTION pending_orders_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pending_orders_updated_at ON pending_orders;
CREATE TRIGGER trg_pending_orders_updated_at
  BEFORE UPDATE ON pending_orders
  FOR EACH ROW EXECUTE FUNCTION pending_orders_set_updated_at();

-- RLS: only service role can touch this table
ALTER TABLE pending_orders ENABLE ROW LEVEL SECURITY;
-- No policies = anon/authenticated roles see nothing. Service role bypasses RLS.

-- ==========================================
-- MIGRATION: 0017_pending_orders_paid_unfulfilled.sql
-- ==========================================

-- Extend pending_orders.status enum to allow 'paid_unfulfilled' — a state
-- where Paytm confirmed payment but downstream fulfillment (email, PDFs,
-- bundle child rows, certificate) threw. Customer was charged; admin must
-- remediate. Without this, callback couldn't write the marker and the row
-- would stay at status='paid' looking healthy while the customer got nothing.

ALTER TABLE pending_orders
  DROP CONSTRAINT IF EXISTS pending_orders_status_check;

ALTER TABLE pending_orders
  ADD CONSTRAINT pending_orders_status_check
    CHECK (status IN ('pending', 'paid', 'paid_unfulfilled', 'failed', 'expired'));

CREATE INDEX IF NOT EXISTS idx_pending_orders_paid_unfulfilled
  ON pending_orders(status)
  WHERE status = 'paid_unfulfilled';

-- ==========================================
-- MIGRATION: 0018_billdesk_payment_claims.sql
-- ==========================================

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

CREATE OR REPLACE FUNCTION public.billdesk_claim_payment(p_order_id text, p_txn_id text, p_status text, p_amount bigint)
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

CREATE OR REPLACE FUNCTION public.billdesk_finish_payment(p_order_id text, p_txn_id text, p_complete boolean)
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

-- ==========================================
-- MIGRATION: 0019_billdesk_checkout_attempts.sql
-- ==========================================

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

CREATE OR REPLACE FUNCTION public.billdesk_reserve_checkout(p_attempt_id uuid, p_actor_ref text, p_course_id uuid,
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
CREATE OR REPLACE FUNCTION public.billdesk_finish_checkout(p_order_id text, p_state text, p_response jsonb)
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

-- ==========================================
-- MIGRATION: 0020_billdesk_fulfillment_steps.sql
-- ==========================================

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

CREATE OR REPLACE FUNCTION public.billdesk_step(p_order_id text,p_txn_id text,p_action text,p_step text DEFAULT NULL,
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
CREATE OR REPLACE FUNCTION public.billdesk_reconcile_step(p_order_id text,p_step text,p_resolution text,p_result jsonb,
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

COMMIT;
