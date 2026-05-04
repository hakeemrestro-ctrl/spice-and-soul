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
