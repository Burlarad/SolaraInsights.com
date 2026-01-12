/**
 * Supabase Configuration Utilities
 *
 * Safe logging and validation of Supabase configuration.
 * NEVER logs or exposes API keys - only URLs and project refs.
 */

/**
 * Extract project ref from Supabase URL.
 * Returns "local" for local development, or the project ref for cloud.
 *
 * Examples:
 * - http://127.0.0.1:54321 → "local"
 * - https://abcdef123456.supabase.co → "abcdef123456"
 */
export function getSupabaseProjectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    return "NOT_CONFIGURED";
  }

  // Local Supabase
  if (url.includes("127.0.0.1") || url.includes("localhost")) {
    return "local";
  }

  // Cloud Supabase: extract project ref from URL
  const match = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (match) {
    return match[1];
  }

  // Custom domain or unknown
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return "INVALID_URL";
  }
}

/**
 * Get environment type based on Supabase URL.
 */
export function getSupabaseEnvironment(): "local" | "cloud" | "unknown" {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!url) {
    return "unknown";
  }

  if (url.includes("127.0.0.1") || url.includes("localhost")) {
    return "local";
  }

  if (url.includes("supabase.co")) {
    return "cloud";
  }

  return "unknown";
}

/**
 * Validate that required Supabase environment variables are set.
 * Throws an error if any required variables are missing.
 */
export function validateSupabaseConfig(): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    errors.push("Missing NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    errors.push("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  // Service role key is optional in client context, required in server context
  // This function is primarily for server-side validation

  return {
    isValid: errors.length === 0,
    errors,
  };
}

function isBuildTime(): boolean {
  // Next.js build phase OR npm build lifecycle OR direct `next build`
  const phase = process.env.NEXT_PHASE || "";
  const lifecycle = process.env.npm_lifecycle_event || "";
  const argv = Array.isArray(process.argv) ? process.argv.join(" ") : "";

  return (
    lifecycle === "build" ||
    lifecycle === "prebuild" ||
    lifecycle === "postbuild" ||
    phase.toLowerCase().includes("build") ||
    (argv.includes("next") && argv.includes("build"))
  );
}

/**
 * Log Supabase configuration safely.
 * CRITICAL: Never logs API keys - only URL origin and project ref.
 *
 * Only runs in development or when explicitly enabled.
 */
export function logSupabaseConfig(): void {
  // Avoid noisy logs during `next build` / `npm run build`
  // (You can still force it with NEXT_PUBLIC_SOLARA_DEBUG_BUILD=1)
  if (isBuildTime() && process.env.NEXT_PUBLIC_SOLARA_DEBUG_BUILD !== "1") {
    return;
  }

  // Only log in development, or when explicitly enabled
  if (
    process.env.NODE_ENV !== "development" &&
    process.env.NEXT_PUBLIC_SOLARA_DEBUG !== "1"
  ) {
    return;
  }

  // Log at most once per server process
  const g = globalThis as unknown as { __solaraSupabaseConfigLogged?: boolean };
  if (g.__solaraSupabaseConfigLogged) {
    return;
  }
  g.__solaraSupabaseConfigLogged = true;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "NOT_SET";
  const env = getSupabaseEnvironment();
  const projectRef = getSupabaseProjectRef();

  // Safe to log - no secrets
  const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log("[Supabase Config]", {
    environment: env,
    projectRef: projectRef,
    urlOrigin: url.split("/").slice(0, 3).join("/"), // Only protocol + host
    hasAnonKey,
    hasServiceKey,
  });

  // Warn if using local Supabase in non-development
  if (env === "local" && process.env.NODE_ENV === "production") {
    console.warn(
      "[Supabase Config] WARNING: Using local Supabase URL in production build!"
    );
  }

  // Warn if cloud URL but no service key
  if (env === "cloud" && !hasServiceKey) {
    console.warn(
      "[Supabase Config] WARNING: Cloud Supabase but no SUPABASE_SERVICE_ROLE_KEY set"
    );
  }
}

// Auto-log on module load in development
if (typeof window === "undefined") {
  // Server-side only
  // Avoid any logging during build unless explicitly requested.
  // (Build-time logs can be very noisy and misleading when `.env.local` points to local Supabase.)
  logSupabaseConfig();
}
