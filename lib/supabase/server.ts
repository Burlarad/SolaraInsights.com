import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { validateSupabaseConfig, logSupabaseConfig } from "./config";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate configuration on module load
const configValidation = validateSupabaseConfig();
if (!configValidation.isValid) {
  throw new Error(
    `Supabase configuration error: ${configValidation.errors.join(", ")}`
  );
}

// Log configuration safely (development only)
logSupabaseConfig();

// Type assertion: After validation, we know these are strings
const url: string = supabaseUrl!;
const key: string = supabaseAnonKey!;

/**
 * Creates a Supabase client for use in Server Components and Route Handlers.
 * This client respects the user's session from cookies.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}

/**
 * Creates a Supabase client with admin privileges using the service role key.
 * ⚠️ WARNING: This bypasses Row Level Security. Use with extreme caution.
 * Only use this for admin operations that require elevated permissions.
 */
export function createAdminSupabaseClient() {
  if (!supabaseServiceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. This is required for admin operations."
    );
  }

  const serviceKey: string = supabaseServiceRoleKey;

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
