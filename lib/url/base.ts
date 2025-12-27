/**
 * Base URL helpers for consistent URL construction across the app.
 *
 * In production, NEXT_PUBLIC_SITE_URL is the canonical URL.
 * In development, we may use different URLs for different purposes.
 *
 * These helpers eliminate ad-hoc localhost fallback hacks in page components.
 */

/**
 * Get the base URL for client-side operations.
 * Used for OAuth redirects and other client-initiated requests.
 *
 * Priority:
 * 1. NEXT_PUBLIC_SITE_URL (if set) - for production/staging
 * 2. window.location.origin - fallback for local dev
 */
export function getClientBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredUrl) {
    return configuredUrl;
  }

  // Client-side only - use actual origin
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // Fallback for SSR (should not be used for OAuth)
  return "http://localhost:3000";
}

/**
 * Get the base URL for server-side operations.
 * Used for API routes, callbacks, and server-side redirects.
 *
 * Priority:
 * 1. NEXT_PUBLIC_SITE_URL (if set) - canonical site URL
 * 2. http://localhost:3000 - local development fallback
 */
export function getServerBaseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

/**
 * Build the OAuth callback URL for Supabase OAuth flows.
 * Always uses the canonical site URL to ensure Supabase redirects correctly.
 */
export function getOauthCallbackUrl(): string {
  return `${getClientBaseUrl()}/auth/callback`;
}
