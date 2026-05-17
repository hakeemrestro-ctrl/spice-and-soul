import { z } from "zod";

// Restrict to alphanumeric + `-` / `_`. Blocks `%` and `_` wildcard characters
// that ilike would otherwise honor — `code = "%"` would match every coupon.
const CODE_PATTERN = /^[A-Za-z0-9_-]{1,50}$/;

export const ValidateCouponSchema = z.object({
  code: z.string().regex(CODE_PATTERN, "Invalid coupon code format"),
  courseId: z.string().uuid(),
});

export type ValidateCouponInput = z.infer<typeof ValidateCouponSchema>;
