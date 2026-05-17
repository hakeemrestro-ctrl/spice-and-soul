import { notFound } from "next/navigation";
import Link from "next/link";
import { Check, ShieldCheck, Lock } from "lucide-react";
export const revalidate = 3600; // ISR: course content rarely changes

import { createClient } from "@/lib/supabase/server";
import { InstructorBio } from "@/components/instructor-bio";
import { Testimonials } from "@/components/testimonials";
import { FaqAccordion } from "@/components/faq-accordion";
import { NewsletterSignup } from "@/components/newsletter-signup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Course } from "@/types";

type Props = { params: Promise<{ slug: string }> };

function youtubeEmbedId(url: string | null): string | null {
  if (!url) return null;
  const m =
    url.match(/[?&]v=([^&#]+)/) ??
    url.match(/youtu\.be\/([^?#]+)/) ??
    url.match(/youtube\.com\/embed\/([^?#]+)/);
  return m?.[1] ?? null;
}

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://hakeemrestro.shop";

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("title, tagline, price_cents, image_url")
    .eq("slug", slug)
    .single();
  if (!data) return {};
  return {
    title: `${data.title} — Spice & Soul Academy`,
    description: data.tagline,
    openGraph: {
      title: `${data.title} — Spice & Soul Academy`,
      description: data.tagline,
      type: "website",
      images: data.image_url
        ? [{ url: data.image_url, width: 1200, height: 630 }]
        : [{ url: "/opengraph-image", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: `${data.title} — Spice & Soul Academy`,
      description: data.tagline,
      images: [data.image_url ?? "/opengraph-image"],
    },
  };
}

const FEATURE_LIST = [
  "{count} authentic recipes",
  "Lifetime access — yours forever",
  "Instant email delivery",
  "Re-send PDFs anytime",
  "PDF invoice included",
];

export default async function CourseDetailPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: courseData } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", slug)
    .eq("published", true)
    .single();

  if (!courseData) notFound();

  const course = courseData as Course;

  const priceDisplay = `₹${(course.price_cents / 100).toLocaleString("en-IN")}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.description,
    url: `${BASE}/courses/${course.slug}`,
    image: course.image_url ?? undefined,
    provider: {
      "@type": "Organization",
      name: "Spice & Soul Academy by Hakeem",
      url: BASE,
    },
    offers: {
      "@type": "Offer",
      price: (course.price_cents / 100).toFixed(2),
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
      url: `${BASE}/checkout?courseId=${course.id}`,
    },
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "online",
      instructor: {
        "@type": "Person",
        name: "Chef Hakeem",
        description: "Head chef and founder of Hakeem Restaurant, Bhopal",
      },
    },
  };

  return (
    <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
    <main className="mx-auto max-w-4xl px-6 py-14">
      {/* Header */}
      <div className="mb-10">
        <div className="mb-5 flex flex-wrap gap-2">
          <Badge variant="cardamom">{course.difficulty}</Badge>
          <Badge variant="outline">{course.recipe_count} recipes</Badge>
          {course.is_bundle && (
            <Badge variant="saffronSoft" className="text-[10px] tracking-[0.12em]">
              BUNDLE
            </Badge>
          )}
        </div>
        <h1 className="mb-3 font-display text-[clamp(40px,5vw,60px)] leading-[1.05] tracking-tight text-clove-700">
          {course.title}
        </h1>
        <p className="font-display text-[22px] italic leading-snug text-clove-500">
          {course.tagline}
        </p>
      </div>

      <hr className="mb-12 border-cream-200" />

      <div className="grid gap-12 lg:grid-cols-3">
        {/* Left: description + recipes */}
        <div className="space-y-12 lg:col-span-2">
          <InstructorBio />

          {youtubeEmbedId(course.preview_video_url) && (
            <section>
              <h2 className="mb-4 font-display text-2xl text-clove-700">
                Preview
              </h2>
              <div className="overflow-hidden rounded-2xl border border-cream-200 shadow-warm-sm">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${youtubeEmbedId(course.preview_video_url)}`}
                  title={`${course.title} preview`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="aspect-video w-full"
                />
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-4 font-display text-2xl text-clove-700">
              About this course
            </h2>
            <div className="space-y-4 font-sans leading-relaxed text-clove-600">
              {course.description
                .split(/(?<=\.)\s+(?=[A-Z])/)
                .reduce<string[][]>((acc, sentence, i) => {
                  const group = Math.floor(i / 2);
                  if (!acc[group]) acc[group] = [];
                  acc[group].push(sentence);
                  return acc;
                }, [])
                .map((sentences, i) => (
                  <p key={i}>{sentences.join(" ")}</p>
                ))}
            </div>
          </section>

          <Testimonials />

          <NewsletterSignup variant="card" />

          <FaqAccordion />
        </div>

        {/* Right: purchase aside */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 rounded-3xl border border-cream-200 bg-cream-100 p-7 shadow-warm-sm">
            {/* Social proof pill */}
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-saffron-100 px-3 py-1.5">
              <span className="font-sans text-xs font-semibold text-saffron-600">★ 4.9</span>
              <span className="font-sans text-xs text-clove-500">· 1,200+ home cooks</span>
            </div>
            <div className="eyebrow mb-2">COURSE PRICE</div>
            <div className="mb-5 font-display text-5xl leading-none text-clove-700">
              {priceDisplay}
            </div>
            <Button
              variant="saffron"
              size="lg"
              className="mb-2 h-12 w-full text-base"
              render={
                <Link href={`/checkout?courseId=${course.id}`}>Enroll Now</Link>
              }
              nativeButton={false}
            />
            {/* Secure checkout */}
            <p className="mb-3 flex items-center justify-center gap-1.5 font-sans text-xs text-clove-400">
              <Lock className="size-3 shrink-0" aria-hidden />
              Secure checkout · Paytm
            </p>
            <div className="mb-5 flex items-center justify-center gap-2 rounded-lg bg-cardamom-100 px-3 py-2 font-sans text-xs font-medium text-cardamom-600">
              <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
              <span>30-day money-back guarantee</span>
            </div>
            <hr className="mb-5 border-cream-200" />
            <ul className="space-y-3 font-sans text-sm text-clove-600">
              {FEATURE_LIST.map((tpl, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-cardamom-600"
                    aria-hidden
                  />
                  <span>{tpl.replace("{count}", String(course.recipe_count))}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </main>
    </>
  );
}
