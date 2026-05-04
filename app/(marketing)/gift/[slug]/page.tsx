import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { GiftCheckoutClient } from "./gift-checkout-client";
import type { Course } from "@/types";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("title, tagline")
    .eq("slug", slug)
    .eq("published", true)
    .single();
  if (!data) return {};
  return {
    title: `Gift ${data.title} — Spice & Soul Academy`,
    description: `Give the gift of authentic Indian cooking. ${data.tagline}`,
  };
}

export default async function GiftCoursePage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!data) notFound();
  const course = data as Course;

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <div className="eyebrow mb-4 text-saffron-500">GIFT A COURSE</div>
      <h1 className="mb-2 font-display text-[clamp(32px,5vw,48px)] leading-[1.05] text-clove-700">
        {course.title}
      </h1>
      <p className="mb-8 font-display text-xl italic leading-snug text-clove-500">
        {course.tagline}
      </p>
      <div className="rounded-2xl border border-cream-200 bg-cream-50 p-7 shadow-warm-sm">
        <GiftCheckoutClient course={course} />
      </div>
      <p className="mt-4 text-center font-sans text-xs text-clove-400">
        Recipient gets an email with their PDF recipe book and a personalised message from you.
      </p>
    </main>
  );
}
