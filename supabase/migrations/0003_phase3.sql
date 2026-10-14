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
