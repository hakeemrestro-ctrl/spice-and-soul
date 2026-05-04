import { z } from "zod";

export const CourseInputSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(200),
  tagline: z.string().max(300).optional(),
  description: z.string().min(1),
  price_cents: z.number().int().positive(),
  difficulty: z.string().min(1),
  recipe_count: z.number().int().nonnegative(),
  published: z.boolean().default(false),
  is_bundle: z.boolean().default(false),
  bundle_course_ids: z.array(z.string().uuid()).nullable().optional(),
  stripe_price_id: z.string().nullable().optional(),
});

export type CourseInput = z.infer<typeof CourseInputSchema>;
