import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable } from "@/components/admin/data-table";
import { PublishReviewButton } from "@/components/admin/publish-review-button";

export const metadata = { title: "Reviews — Admin" };

type Review = {
  id: string;
  rating: number;
  body: string | null;
  customer_name: string;
  customer_email: string;
  published: boolean;
  created_at: string;
  courses: { title: string } | null;
};

function stars(n: number) {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function ReviewsPage() {
  const supabase = createAdminClient();

  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, rating, body, customer_name, customer_email, published, created_at, courses(title)")
    .not("rating", "is", null)
    .order("created_at", { ascending: false })
    .returns<Review[]>();

  return (
    <>
      <PageHeader
        title="Reviews"
        subtitle="Moderate customer reviews before publishing."
      />

      <DataTable
        cols={["Rating", "Reviewer", "Course", "Review", "Date", ""]}
        emptyMessage="No reviews yet."
        rows={(reviews ?? []).map((r) => [
          <span key="stars" className="font-sans text-saffron-500">{stars(r.rating)}</span>,
          <div key="reviewer">
            <div className="font-sans text-sm font-medium text-clove-700">{r.customer_name}</div>
            <div className="font-sans text-xs text-clove-400">{r.customer_email}</div>
          </div>,
          <span key="course" className="font-sans text-sm text-clove-600">
            {r.courses?.title ?? "—"}
          </span>,
          <p key="body" className="max-w-xs font-sans text-xs leading-relaxed text-clove-600 line-clamp-3">
            {r.body ?? <span className="italic text-clove-300">No written review</span>}
          </p>,
          formatDate(r.created_at),
          <PublishReviewButton
            key="publish"
            reviewId={r.id}
            published={r.published}
          />,
        ])}
      />
    </>
  );
}
