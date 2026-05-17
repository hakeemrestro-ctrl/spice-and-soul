export const revalidate = 3600; // ISR: re-render at most once per hour

import Link from "next/link";
import { BookOpen, Mail, Infinity as InfinityIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CourseCard } from "@/components/course-card";
import { Button } from "@/components/ui/button";
import { NewsletterSignup } from "@/components/newsletter-signup";
import { Testimonials, type Testimonial } from "@/components/testimonials";
import { InstructorBio } from "@/components/instructor-bio";
import type { Course } from "@/types";

const FEATURES = [
  {
    Icon: BookOpen,
    title: "114 Authentic Recipes",
    body: "Every recipe is tested, structured, and written for home cooks — not professional chefs.",
  },
  {
    Icon: Mail,
    title: "Instant Delivery",
    body: "Purchase any course and receive full content + invoice in your inbox within 30 seconds.",
  },
  {
    Icon: InfinityIcon,
    title: "Lifetime Access",
    body: "Buy once, keep forever. Re-send your PDFs anytime — no login needed.",
  },
] as const;

export default async function HomePage() {
  const supabase = await createClient();
  const adminClient = createAdminClient();

  const [{ data: featuredCourses }, { data: dbReviews }] = await Promise.all([
    supabase
      .from("courses")
      .select("*")
      .eq("published", true)
      .eq("is_bundle", false)
      .order("price_cents", { ascending: true })
      .limit(3),
    adminClient
      .from("reviews")
      .select("body, rating, customer_name")
      .eq("published", true)
      .gte("rating", 4)
      .not("body", "is", null)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const courses = (featuredCourses ?? []) as Course[];

  const testimonials: Testimonial[] = (dbReviews ?? [])
    .filter((r): r is { body: string; rating: number; customer_name: string } => r.body !== null)
    .map((r) => ({
      quote: r.body,
      name: r.customer_name,
      city: "",
      rating: r.rating,
    }));

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-cream-50 to-saffron-50 px-6 py-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[url('/brand/dot-pattern.svg')] opacity-50"
        />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <div className="eyebrow mb-4 motion-safe:animate-fade-in">SPICE &amp; SOUL ACADEMY</div>
          <h1 className="mb-7 font-display text-[clamp(44px,6vw,72px)] leading-[1.08] tracking-tight text-clove-700 motion-safe:animate-slide-up motion-safe:delay-75">
            Master Indian cooking{" "}
            <span className="italic text-paprika-600">from your kitchen.</span>
          </h1>
          <p className="mx-auto mb-9 max-w-xl font-sans text-lg leading-relaxed text-clove-500 motion-safe:animate-slide-up motion-safe:delay-150">
            5 curated courses. 114 authentic recipes. From dal to biryani — learn the flavors of India step by step.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row motion-safe:animate-slide-up motion-safe:delay-225">
            <Button
              variant="saffron"
              size="xl"
              render={<Link href="/courses">Browse All Courses</Link>}
              nativeButton={false}
            />
          </div>
          <p className="mt-8 font-sans text-sm text-clove-500 motion-safe:animate-fade-in motion-safe:delay-375">
            <span className="text-saffron-500">★</span> 4.9 from 1,200+ home cooks · Instant email delivery · Lifetime access
          </p>
        </div>
      </section>

      {/* Featured */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-12 text-center">
          <div className="eyebrow mb-3">FEATURED</div>
          <h2 className="mb-3 font-display text-4xl text-clove-700">
            Start anywhere. Learn everything.
          </h2>
          <p className="lead">One course, or all five.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course, i) => (
            <div
              key={course.id}
              className={`motion-safe:animate-slide-up ${
                i === 0 ? "motion-safe:delay-75" :
                i === 1 ? "motion-safe:delay-150" :
                          "motion-safe:delay-225"
              }`}
            >
              <CourseCard course={course} priority={i === 0} showFeatures />
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <Button
            variant="outline"
            size="lg"
            render={<Link href="/courses">View All 5 Courses →</Link>}
            nativeButton={false}
          />
        </div>
      </section>

      {/* Instructor Bio */}
      <section className="mx-auto max-w-4xl px-6 pb-16 pt-8">
        <InstructorBio />
      </section>

      {/* Why Us */}
      <section className="border-y border-cream-200 bg-cream-100 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <div className="eyebrow mb-3">WHY SPICE &amp; SOUL</div>
            <h2 className="font-display text-4xl text-clove-700">
              The kitchen is the classroom.
            </h2>
          </div>
          <div className="grid gap-10 sm:grid-cols-3">
            {FEATURES.map(({ Icon, title, body }) => (
              <div key={title}>
                <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-saffron-100">
                  <Icon className="size-7 text-saffron-500" />
                </div>
                <h3 className="mb-2 font-display text-xl text-clove-700">{title}</h3>
                <p className="font-sans text-clove-500">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <Testimonials testimonials={testimonials.length >= 3 ? testimonials : undefined} />
      </section>

      {/* Dark CTA */}
      <section className="relative overflow-hidden bg-clove-700 px-6 py-24 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[url('/brand/dot-pattern.svg')] opacity-[0.18]"
        />
        <div className="relative z-10 mx-auto max-w-xl">
          <div className="mb-3 font-sans text-xs font-semibold uppercase tracking-[0.18em] text-saffron-300">
            GET STARTED
          </div>
          <h2 className="mb-4 font-display text-4xl text-cream-50">
            Ready to start <span className="italic text-saffron-300">cooking?</span>
          </h2>
          <p className="mb-9 font-display text-xl italic text-clove-200">
            Join 1,200+ home cooks mastering Indian cuisine.
          </p>
          <Button
            variant="saffron"
            size="xl"
            render={<Link href="/courses">Browse Courses</Link>}
            nativeButton={false}
          />
        </div>
      </section>

      {/* Free sampler signup */}
      <section className="mx-auto max-w-2xl px-6 py-16">
        <NewsletterSignup variant="card" />
      </section>
    </>
  );
}
