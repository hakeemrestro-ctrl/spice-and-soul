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
