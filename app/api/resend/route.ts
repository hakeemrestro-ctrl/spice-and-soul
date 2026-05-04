export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { ResendInputSchema } from "@/lib/validations/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCourseEmail } from "@/lib/send-course-email";
import type { Course, Recipe } from "@/types";

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ResendInputSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const supabase = createAdminClient();

  // Top-level paid orders only — bundle children are re-expanded server-side
  // by sendCourseEmail when course.is_bundle is true.
  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .eq("customer_email", email)
    .eq("status", "paid")
    .is("parent_order_id", null);

  if (error) {
    console.error("Resend orders lookup failed:", error);
    return NextResponse.json(
      { error: "Failed to look up orders" },
      { status: 500 },
    );
  }

  // Always return generic success to avoid email enumeration
  if (!orders || orders.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const resendUrl = `${process.env.NEXT_PUBLIC_APP_URL}/resend`;

  // One email per top-level order. For bundles, sendCourseEmail re-expands
  // bundle_course_ids and attaches one PDF per included course.
  await Promise.all(
    orders.map(async (order) => {
      const { data: course } = await supabase
        .from("courses")
        .select("*")
        .eq("id", order.course_id)
        .single<Course>();

      if (!course) return;

      let bundleChildren:
        | { course: Course; recipes: Recipe[] }[]
        | undefined;
      let recipes: Recipe[] = [];

      if (course.is_bundle && course.bundle_course_ids?.length) {
        const { data: children } = await supabase
          .from("courses")
          .select("*")
          .in("id", course.bundle_course_ids)
          .returns<Course[]>();

        if (children) {
          const childRecipes = await Promise.all(
            children.map((c) =>
              supabase
                .from("recipes")
                .select("*")
                .eq("course_id", c.id)
                .order("sort_order", { ascending: true })
                .returns<Recipe[]>(),
            ),
          );
          bundleChildren = children.map((c, i) => ({
            course: c,
            recipes: childRecipes[i].data ?? [],
          }));
        }
      } else {
        const { data } = await supabase
          .from("recipes")
          .select("*")
          .eq("course_id", course.id)
          .order("sort_order", { ascending: true })
          .returns<Recipe[]>();
        recipes = data ?? [];
      }

      try {
        await sendCourseEmail({
          customerEmail: order.customer_email,
          customerName: order.customer_name ?? order.customer_email,
          course,
          recipes,
          priceCents: order.amount_cents,
          invoiceNumber: order.invoice_number,
          last4: order.stripe_last4 ?? undefined,
          resendUrl,
          bundleChildren,
        });
      } catch (err) {
        console.error(`Resend failed for order ${order.id}:`, err);
      }
    }),
  );

  return NextResponse.json({ ok: true });
}
