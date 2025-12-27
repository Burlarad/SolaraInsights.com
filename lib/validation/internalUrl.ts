/**
 * Validate and sanitize an internal URL path for open redirect protection.
 *
 * SECURITY: This function prevents open redirect attacks by ensuring
 * the URL is a safe internal path. It rejects:
 * - External URLs (http://, https://, //, etc.)
 * - Protocol-relative URLs
 * - Backslash tricks (/\evil.com)
 * - Encoded slashes that could bypass checks
 * - Null bytes and other injection attempts
 *
 * @param raw - The raw URL string to validate (may come from query params, cookies, etc.)
 * @param fallback - The fallback path if validation fails (default: "/sanctuary")
 * @returns A safe internal path
 */
export function toSafeInternalPath(
  raw: string | null | undefined,
  fallback: string = "/sanctuary"
): string {
  if (!raw) return fallback;

  // Decode first to catch encoded attacks
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Malformed encoding - reject
    return fallback;
  }

  // Must start with "/" (relative path)
  if (!decoded.startsWith("/")) return fallback;

  // Must not be protocol-relative URL (//)
  if (decoded.startsWith("//")) return fallback;

  // Must not contain protocol indicators
  const lower = decoded.toLowerCase();
  if (lower.includes("http:") || lower.includes("https:")) return fallback;

  // Must not contain :// anywhere (catches all protocols)
  if (decoded.includes("://")) return fallback;

  // Must not contain backslash (prevents /\evil.com tricks)
  if (decoded.includes("\\")) return fallback;

  // Must not contain null bytes
  if (decoded.includes("\0")) return fallback;

  // Re-check for encoded slashes after decode (double-encoding attacks)
  if (decoded.includes("%2f") || decoded.includes("%2F")) return fallback;

  return decoded;
}

/**
 * Type guard version that returns boolean instead of the path.
 * Useful when you need to check validity without getting the fallback.
 */
export function isValidInternalPath(url: string | null | undefined): url is string {
  if (!url) return false;
  return toSafeInternalPath(url, "__INVALID__") !== "__INVALID__";
}
