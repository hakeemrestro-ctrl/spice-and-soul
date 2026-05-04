-- YouTube preview video URL for course detail page
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS preview_video_url TEXT;
