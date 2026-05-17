"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type LoginInput = {
  email: string;
  password: string;
  next?: string;
};

export async function adminLogin(
  input: LoginInput,
): Promise<{ error: string } | void> {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (error || !data.user) {
    return { error: "Invalid email or password." };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", data.user.id)
    .single();

  if (!profile?.is_admin) {
    await supabase.auth.signOut();
    return { error: "Account is not an admin." };
  }

  // Open-redirect guard: input.next must be a strict same-origin path under
  // /admin. Reject protocol-relative (`//evil.com/admin`), full URLs, and
  // anything that doesn't begin with a single `/admin/...` or equal `/admin`.
  const next = input.next;
  const safe =
    typeof next === "string" &&
    next.startsWith("/admin") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\") &&
    !next.includes("://");
  redirect(safe ? next : "/admin");
}
