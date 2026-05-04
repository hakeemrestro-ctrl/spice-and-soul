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
