import { z } from "zod";

export const ValidateCouponSchema = z.object({
  code: z.string().min(1).max(50),
  courseId: z.string().uuid(),
});

export type ValidateCouponInput = z.infer<typeof ValidateCouponSchema>;
