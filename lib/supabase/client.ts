import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

// Type assertion: After the check above, we know these are strings
const url: string = supabaseUrl;
const key: string = supabaseAnonKey;

/**
 * Create a browser-side Supabase client.
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient(url, key);
}

// Export a singleton instance for convenience
export const supabase = createBrowserSupabaseClient();
