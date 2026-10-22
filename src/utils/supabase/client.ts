import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://example.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "example-anon-key";
  return createBrowserClient(url, key);
}
