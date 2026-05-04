import { z } from "zod";

export const ResendInputSchema = z.object({
  email: z.string().email().max(254),
});

export type ResendInput = z.infer<typeof ResendInputSchema>;
