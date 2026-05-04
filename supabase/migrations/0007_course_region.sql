-- Add region column to courses for filter chips
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS region text;
