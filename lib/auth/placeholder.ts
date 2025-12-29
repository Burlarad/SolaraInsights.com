/**
 * Placeholder Email Utilities
 *
 * Custom OAuth providers (TikTok, X) require a placeholder email
 * because Supabase auth.users requires an email.
 *
 * We use: {provider}_{user_id}@solarainsights.com
 *
 * CRITICAL: Never send emails to placeholder addresses.
 */

const PLACEHOLDER_DOMAIN = "@solarainsights.com";
const TIKTOK_PREFIX = "tiktok_";
const X_PREFIX = "x_";

/**
 * Generate a placeholder email for TikTok users
 */
export function generateTikTokPlaceholderEmail(openId: string): string {
  return `${TIKTOK_PREFIX}${openId}${PLACEHOLDER_DOMAIN}`;
}

/**
 * Generate a placeholder email for X (Twitter) users
 */
export function generateXPlaceholderEmail(userId: string): string {
  return `${X_PREFIX}${userId}${PLACEHOLDER_DOMAIN}`;
}

/**
 * Check if an email is a placeholder email
 * Returns true if:
 * - Ends with @solarainsights.com AND starts with a known provider prefix
 * - OR user_metadata.placeholder_email === true (checked separately)
 */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  if (!email.endsWith(PLACEHOLDER_DOMAIN)) return false;
  return email.startsWith(TIKTOK_PREFIX) || email.startsWith(X_PREFIX);
}

/**
 * Check if a user has a placeholder email based on metadata or email format
 */
export function hasPlaceholderEmail(user: {
  email?: string | null;
  user_metadata?: { placeholder_email?: boolean };
} | null): boolean {
  if (!user) return false;

  // Check metadata flag first (most reliable)
  if (user.user_metadata?.placeholder_email === true) {
    return true;
  }

  // Fall back to email format check
  return isPlaceholderEmail(user.email);
}

/**
 * Get the OAuth provider from a placeholder email
 * Returns null if not a placeholder email
 */
export function getProviderFromPlaceholderEmail(email: string | null | undefined): string | null {
  if (!email || !email.endsWith(PLACEHOLDER_DOMAIN)) return null;

  if (email.startsWith(TIKTOK_PREFIX)) {
    return "tiktok";
  }

  if (email.startsWith(X_PREFIX)) {
    return "x";
  }

  return null;
}
