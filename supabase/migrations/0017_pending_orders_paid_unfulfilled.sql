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
