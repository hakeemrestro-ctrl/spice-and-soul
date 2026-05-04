import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Admin login — Spice & Soul Academy",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    if (profile?.is_admin) redirect(params.next ?? "/admin");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <h1 className="mb-2 font-display text-3xl text-clove-700">
        Admin sign-in
      </h1>
      <p className="mb-8 font-sans text-sm text-clove-500">
        Restricted area. Use your admin credentials.
      </p>
      <LoginForm next={params.next} initialError={params.error} />
    </main>
  );
}
