import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { StatusPill } from "@/components/admin/status-pill";
import type { Course } from "@/types";

export const metadata = { title: "Courses — Admin" };

function formatMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US")}`;
}

export default async function AdminCoursesPage() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: false });

  const courses = (data ?? []) as Course[];
  const publishedCount = courses.filter((c) => c.published).length;

  return (
    <>
      <PageHeader
        title="Courses"
        subtitle={`${courses.length} courses · ${publishedCount} published`}
      />

      <DataTable
        cols={["Title", "Slug", "Price", "Recipes", "Status"]}
        emptyMessage="No courses yet."
        rows={courses.map((c) => [
          <Link
            key="t"
            href={`/courses/${c.slug}`}
            className="font-semibold text-clove-700 no-underline hover:text-saffron-600"
          >
            {c.title}
          </Link>,
          <span key="s" className="font-mono text-xs text-clove-400">
            {c.slug}
          </span>,
          formatMoney(c.price_cents),
          c.recipe_count,
          <div key="st" className="flex flex-wrap gap-1.5">
            <StatusPill status={c.published ? "published" : "draft"} />
            {c.is_bundle && <StatusPill status="bundle" />}
          </div>,
        ])}
      />
    </>
  );
}
