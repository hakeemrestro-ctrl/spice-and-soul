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

  redirect(input.next && input.next.startsWith("/admin") ? input.next : "/admin");
}
