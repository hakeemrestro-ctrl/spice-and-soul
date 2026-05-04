import Link from "next/link";
import { PartyPopper, Mail, Inbox, ChefHat, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Course } from "@/types";

export const metadata = { title: "Thank You — Spice & Soul Academy" };

async function getOrderContext(paymentIntentId: string | undefined) {
  if (!paymentIntentId) return null;
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("course_id, amount_cents")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .is("parent_order_id", null)
    .maybeSingle();

  if (!order) return null;

  const { data: course } = await supabase
    .from("courses")
    .select("id, slug, is_bundle")
    .eq("id", order.course_id)
    .single<Pick<Course, "id" | "slug" | "is_bundle">>();

  if (!course || course.is_bundle) return null;

  // Fetch bundle to show upsell
  const { data: bundle } = await supabase
    .from("courses")
    .select("id, slug, title, price_cents")
    .eq("is_bundle", true)
    .eq("published", true)
    .single<Pick<Course, "id" | "slug" | "title" | "price_cents">>();

  return bundle ?? null;
}

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ payment_intent?: string }>;
}) {
  const { payment_intent } = await searchParams;
  const bundle = await getOrderContext(payment_intent);

  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <div className="mx-auto mb-6 inline-flex size-18 items-center justify-center rounded-3xl bg-saffron-100">
        <PartyPopper className="size-9 text-saffron-500" aria-hidden />
      </div>
      <h1 className="mb-4 font-display text-[clamp(40px,5vw,54px)] leading-[1.05] text-clove-700">
        Your course is{" "}
        <span className="italic text-paprika-600">on its way.</span>
      </h1>
      <p className="mb-8 font-sans text-lg leading-relaxed text-clove-500">
        Check your inbox in the next minute or two — your recipe PDFs and
        invoice are attached.
      </p>

      <ol className="mb-10 grid gap-4 text-left sm:grid-cols-3">
        <li className="rounded-2xl border border-cream-200 bg-cream-50 p-5">
          <Inbox className="mb-2 size-5 text-saffron-500" aria-hidden />
          <p className="font-sans text-sm font-semibold text-clove-700">
            1. Check email
          </p>
          <p className="mt-1 font-sans text-xs text-clove-500">
            Recipe book + invoice PDFs arrive within minutes.
          </p>
        </li>
        <li className="rounded-2xl border border-cream-200 bg-cream-50 p-5">
          <Mail className="mb-2 size-5 text-saffron-500" aria-hidden />
          <p className="font-sans text-sm font-semibold text-clove-700">
            2. Lost the email?
          </p>
          <p className="mt-1 font-sans text-xs text-clove-500">
            Visit{" "}
            <Link href="/resend" className="text-paprika-600 underline">
              /resend
            </Link>{" "}
            anytime to send again.
          </p>
        </li>
        <li className="rounded-2xl border border-cream-200 bg-cream-50 p-5">
          <ChefHat className="mb-2 size-5 text-saffron-500" aria-hidden />
          <p className="font-sans text-sm font-semibold text-clove-700">
            3. Start cooking
          </p>
          <p className="mt-1 font-sans text-xs text-clove-500">
            Open the PDF, pick a recipe, light the stove.
          </p>
        </li>
      </ol>

      {/* Bundle upsell — only shows if single course was purchased */}
      {bundle && (
        <div className="mb-8 overflow-hidden rounded-3xl border-[1.5px] border-saffron-300 bg-gradient-to-br from-saffron-50 to-cream-100 p-6 text-left shadow-warm-md">
          <div className="eyebrow mb-2 text-saffron-600">COMPLETE THE COLLECTION</div>
          <p className="mb-1 font-display text-2xl text-clove-700">
            {bundle.title}
          </p>
          <p className="mb-4 font-sans text-sm text-clove-500">
            All 5 courses · 114 recipes · One price.
          </p>
          <Button
            variant="saffron"
            size="lg"
            className="gap-1.5"
            render={
              <Link href={`/courses/${bundle.slug}`}>
                Get the full bundle — ${(bundle.price_cents / 100).toLocaleString()}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            }
            nativeButton={false}
          />
        </div>
      )}

      <Button
        variant="outline"
        size="lg"
        className="h-12 px-6 text-base"
        render={<Link href="/courses">Browse more courses</Link>}
        nativeButton={false}
      />
    </main>
  );
}
