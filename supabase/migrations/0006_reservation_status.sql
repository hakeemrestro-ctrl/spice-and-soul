-- Add status column to reservations for admin workflow tracking.
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'confirmed', 'seated', 'no-show', 'cancelled'));

CREATE INDEX idx_reservations_status ON public.reservations (status);
