import { z } from "zod";

export const CheckoutInputSchema = z.object({
  courseId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  couponCode: z.string().min(1).max(50).optional(),
  acquisitionSource: z.string().max(100).optional(),
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  utmCampaign: z.string().max(200).optional(),
  utmContent: z.string().max(200).optional(),
  utmTerm: z.string().max(200).optional(),
});

export type CheckoutInput = z.infer<typeof CheckoutInputSchema>;
