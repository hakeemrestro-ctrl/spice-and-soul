export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend } from "@/lib/resend";
import { generateRecipePdf } from "@/lib/generate-recipe-pdf";
import { SamplerEmail } from "@/components/email-templates/sampler-email";
import { createElement } from "react";
import type { Course, Recipe } from "@/types";

const SamplerSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().max(100).optional(),
});

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://hakeemrestro.shop";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = SamplerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const { email, name } = parsed.data;
  const supabase = createAdminClient();

  // Upsert subscriber (case-insensitive email, update name if provided)
  const { data: existing } = await supabase
    .from("subscribers")
    .select("id, name, sampler_sent_at")
    .ilike("email", email)
    .maybeSingle();

  if (existing?.sampler_sent_at) {
    // Already sent — silently OK (anti-enumeration)
    return NextResponse.json({ ok: true });
  }

  if (existing) {
    await supabase
      .from("subscribers")
      .update({ name: name ?? existing.name, sampler_sent_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("subscribers")
      .insert({ email: email.toLowerCase(), name, source: "website", sampler_sent_at: new Date().toISOString() });
  }

  // Fetch up to 3 sample recipes (from published non-bundle courses, sorted by sort_order)
  const { data: courses } = await supabase
    .from("courses")
    .select("id, slug, title, tagline, description, price_cents, difficulty, recipe_count, image_url, published, is_bundle, bundle_course_ids, stripe_price_id, created_at")
    .eq("published", true)
    .eq("is_bundle", false)
    .order("created_at")
    .limit(1)
    .returns<Course[]>();

  const samplerCourse = courses?.[0];

  if (samplerCourse) {
    const { data: recipes } = await supabase
      .from("recipes")
      .select("*")
      .eq("course_id", samplerCourse.id)
      .order("sort_order")
      .limit(3)
      .returns<Recipe[]>();

    if (recipes && recipes.length > 0) {
      try {
        const pdfBuffer = await generateRecipePdf({
          course: { ...samplerCourse, title: "Free Sampler — Spice & Soul" },
          recipes,
          customerName: name ?? "Friend",
        });

        await resend.emails.send({
          from: "Spice & Soul Academy <hello@hakeemrestro.shop>",
          replyTo: "hakeemrestro@gmail.com",
          to: email,
          subject: "Your free Indian cooking sampler — 3 recipes from Hakeem",
          react: createElement(SamplerEmail, {
            name,
            coursesUrl: `${BASE}/courses`,
          }),
          attachments: [
            {
              filename: "spice-and-soul-sampler.pdf",
              content: pdfBuffer.toString("base64"),
            },
          ],
        });
      } catch (err) {
        console.error("Failed to send sampler email:", err);
        // Don't surface to client — subscriber is saved, can retry
      }
    }
  }

  return NextResponse.json({ ok: true });
}
