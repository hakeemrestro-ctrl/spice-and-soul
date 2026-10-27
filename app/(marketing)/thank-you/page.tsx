import Link from "next/link";
import { PartyPopper, Mail, Inbox, ChefHat, ArrowRight, CheckCircle2, Receipt, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Course } from "@/types";

export const metadata = { title: "Payment Confirmation & Receipt — Spice & Soul Academy" };

async function getOrderContext(paymentIntentId: string | undefined) {
  if (!paymentIntentId) return null;
  const supabase = createAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, course_id, amount_cents, invoice_number, customer_email, customer_name, stripe_last4, created_at, status")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .is("parent_order_id", null)
    .maybeSingle();

  let purchasedCourse = null;
  if (order?.course_id) {
    const { data: course } = await supabase
      .from("courses")
      .select("id, slug, title, is_bundle")
      .eq("id", order.course_id)
      .single<Pick<Course, "id" | "slug" | "title" | "is_bundle">>();
    purchasedCourse = course;
  }

  // Fetch bundle to show upsell
  let bundle = null;
  if (!purchasedCourse || !purchasedCourse.is_bundle) {
    const { data: bundleData } = await supabase
      .from("courses")
      .select("id, slug, title, price_cents")
      .eq("is_bundle", true)
      .eq("published", true)
      .single<Pick<Course, "id" | "slug" | "title" | "price_cents">>();
    bundle = bundleData ?? null;
  }

  return { order, purchasedCourse, bundle };
}

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ payment_intent?: string }>;
}) {
  const { payment_intent } = await searchParams;
  const context = await getOrderContext(payment_intent);
  const order = context?.order;
  const purchasedCourse = context?.purchasedCourse;
  const bundle = context?.bundle;

  const amountRupees = order ? (order.amount_cents / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : null;

  return (
    <main className="mx-auto max-w-xl px-6 py-20 text-center">
      <div className="mx-auto mb-6 inline-flex size-18 items-center justify-center rounded-3xl bg-saffron-100 shadow-sm">
        <PartyPopper className="size-9 text-saffron-500" aria-hidden />
      </div>
      <h1 className="mb-3 font-display text-[clamp(36px,5vw,50px)] leading-[1.05] text-clove-700">
        Payment <span className="italic text-emerald-600">Successful!</span>
      </h1>
      <p className="mb-8 font-sans text-base leading-relaxed text-clove-500">
        Thank you for your enrollment. Your official invoice and course material have been confirmed.
      </p>

      {/* Official Payment Receipt Card */}
      {payment_intent && (
        <div className="mb-10 overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 text-left shadow-sm">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600" />
              <span className="font-sans text-sm font-bold uppercase tracking-wider text-emerald-800">
                Official Payment Receipt
              </span>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 font-sans text-xs font-semibold text-emerald-700">
              STATUS: PAID (0300)
            </span>
          </div>

          <div className="grid gap-3 font-sans text-sm text-clove-700">
            <div className="flex justify-between">
              <span className="text-clove-500">Transaction ID:</span>
              <span className="font-mono font-medium">{payment_intent}</span>
            </div>
            {order?.invoice_number && (
              <div className="flex justify-between">
                <span className="text-clove-500">Invoice No:</span>
                <span className="font-mono font-medium">{order.invoice_number}</span>
              </div>
            )}
            {purchasedCourse && (
              <div className="flex justify-between">
                <span className="text-clove-500">Course:</span>
                <span className="font-medium text-clove-900">{purchasedCourse.title}</span>
              </div>
            )}
            {amountRupees && (
              <div className="flex justify-between border-t border-emerald-100 pt-3">
                <span className="font-semibold text-clove-800">Amount Paid:</span>
                <span className="font-display text-lg font-bold text-emerald-700">₹{amountRupees}</span>
              </div>
            )}
          </div>
        </div>
      )}

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
