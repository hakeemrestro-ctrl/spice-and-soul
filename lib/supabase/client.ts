import { createBrowserClient } from "@supabase/ssr";

const DEFAULT_SUPABASE_URL = "https://placeholder.supabase.co";
const DEFAULT_ANON_KEY = "placeholder-anon-key";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_ANON_KEY;
  return createBrowserClient(
    url,
    key
  );
}
