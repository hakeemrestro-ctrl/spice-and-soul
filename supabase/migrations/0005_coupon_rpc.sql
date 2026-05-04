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
