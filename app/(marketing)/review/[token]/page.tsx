import { createAdminClient } from "@/lib/supabase/admin";
import { ReviewForm } from "./review-form";

type Props = { params: Promise<{ token: string }> };

export const metadata = {
  title: "Leave a Review — Spice & Soul Academy",
};

export default async function ReviewPage({ params }: Props) {
  const { token } = await params;
  const supabase = createAdminClient();

  // Validate token — must be a review row that hasn't been submitted yet
  const { data: review } = await supabase
    .from("reviews")
    .select("id, course_id, customer_name, body, courses(title)")
    .eq("token", token)
    .is("body", null)
    .maybeSingle();

  if (!review) {
    // Token already used or invalid — show generic message rather than 404
    return (
      <main className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="mb-3 font-display text-3xl text-clove-700">Review already submitted</h1>
        <p className="font-sans text-clove-500">
          This link has already been used or has expired. Thank you for your feedback!
        </p>
      </main>
    );
  }

  const courseTitle =
    (review.courses as unknown as { title: string } | null)?.title ?? "your course";

  return (
    <main className="mx-auto max-w-lg px-6 py-20">
      <div className="eyebrow mb-4 text-saffron-500">YOUR FEEDBACK</div>
      <h1 className="mb-2 font-display text-[clamp(28px,4vw,40px)] text-clove-700">
        How did we do?
      </h1>
      <p className="mb-8 font-sans text-[15px] leading-relaxed text-clove-600">
        You purchased <strong>{courseTitle}</strong>. We&apos;d love to hear how your cooking
        went — it takes less than a minute.
      </p>

      <div className="rounded-2xl border border-cream-200 bg-cream-50 p-7 shadow-warm-sm">
        <ReviewForm reviewId={review.id} token={token} defaultName={review.customer_name ?? ""} />
      </div>
    </main>
  );
}
