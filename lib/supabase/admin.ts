import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://placeholder.supabase.co";
const DEFAULT_SERVICE_ROLE_KEY = "placeholder-service-key";

// Only import this in server-only contexts (API routes, server actions)
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || DEFAULT_SERVICE_ROLE_KEY;
  return createClient(
    url,
    key,
    { auth: { persistSession: false } }
  );
}
