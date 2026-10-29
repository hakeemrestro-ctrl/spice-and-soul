import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CheckoutPageClient from "./checkout-client";
import type { Course } from "@/types";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{
    courseId?: string;
    courseld?: string;
    courseid?: string;
    course_id?: string;
  }>;
}) {
  const params = await searchParams;
  const courseId =
    params.courseId ||
    params.courseld ||
    params.courseid ||
    params.course_id;

  if (!courseId) notFound();

  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  if (!course) notFound();

  return <CheckoutPageClient course={course as Course} />;
}
