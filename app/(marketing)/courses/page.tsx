export const revalidate = 3600; // ISR: course list rarely changes

import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { CourseCard } from "@/components/course-card";
import { Badge } from "@/components/ui/badge";
import { CourseFilters } from "./course-filters";
import type { Course } from "@/types";

export const metadata = {
  title: "All Courses — Spice & Soul Academy",
};

type Props = {
  searchParams: Promise<{ difficulty?: string; region?: string }>;
};

export default async function CoursesPage({ searchParams }: Props) {
  const { difficulty, region } = await searchParams;

  const supabase = await createClient();
  const [{ data }, { data: statsData }] = await Promise.all([
    supabase
      .from("courses")
      .select("*")
      .eq("published", true)
      .order("is_bundle", { ascending: true })
      .order("price_cents", { ascending: true }),
    supabase
      .from("mv_course_stats")
      .select("course_id, orders_30d")
      .order("orders_30d", { ascending: false })
      .limit(1),
  ]);

  const allCourses = (data ?? []) as Course[];
  const bestsellerCourseId = statsData?.[0]?.course_id ?? null;

  // Extract unique difficulty/region values for filter chips
  const difficulties = [...new Set(
    allCourses.filter((c) => !c.is_bundle && c.difficulty).map((c) => c.difficulty.toLowerCase())
  )].sort();
  const regions = [...new Set(
    allCourses.filter((c) => !c.is_bundle && c.region).map((c) => c.region as string)
  )].sort();

  // Apply filters (only to individual courses; bundles always shown)
  const filtered = allCourses.filter((c) => {
    if (c.is_bundle) return true;
    if (difficulty && c.difficulty.toLowerCase() !== difficulty.toLowerCase()) return false;
    if (region && c.region !== region) return false;
    return true;
  });

  const bundles = filtered.filter((c) => c.is_bundle);
  const individual = filtered.filter((c) => !c.is_bundle);
  const allIndividual = allCourses.filter((c) => !c.is_bundle);

  const individualSumCents = allIndividual.reduce((s, c) => s + c.price_cents, 0);

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-14 text-center">
        <div className="eyebrow mb-3">CATALOG</div>
        <h1 className="mb-3 font-display text-[clamp(40px,5vw,60px)] leading-tight tracking-tight text-clove-700">
          Indian Cooking Courses
        </h1>
        <p className="lead">
          5 expert-curated courses · 114 authentic recipes
        </p>
      </div>

      <Suspense>
        <CourseFilters difficulties={difficulties} regions={regions} />
      </Suspense>

      {bundles.length > 0 && (
        <section className="mb-20">
          <div className="mb-6 flex items-center gap-3">
            <h2 className="font-display text-2xl text-clove-700">Best Value</h2>
            <Badge variant="saffronSoft" className="text-[10px] tracking-[0.12em]">
              BUNDLE
            </Badge>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {bundles.map((bundle, i) => {
              const savings = Math.max(individualSumCents - bundle.price_cents, 0);
              return (
                <div key={bundle.id}>
                  <CourseCard
                    course={bundle}
                    bundleSavingsCents={savings > 0 ? savings : undefined}
                    bundleOriginalCents={savings > 0 ? individualSumCents : undefined}
                    priority={i === 0}
                    showFeatures
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-6 font-display text-2xl text-clove-700">Individual Courses</h2>
        {individual.length === 0 ? (
          <p className="font-sans text-[15px] text-clove-400">No courses match those filters.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {individual.map((course, i) => (
              <div key={course.id}>
                <CourseCard
                  course={course}
                  isBestseller={course.id === bestsellerCourseId}
                  priority={i === 0}
                  showFeatures
                />
              </div>
            ))}
          </div>
        )}
      </section>

    </main>
  );
}
