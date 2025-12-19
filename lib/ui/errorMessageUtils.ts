/**
 * Utility functions for formatting error messages.
 */

/**
 * Format retry time in a human-friendly way.
 * - <60s → "12s"
 * - <3600s → "2 min"
 * - >=3600s → "1 hr 5 min"
 *
 * @param retryAfterSeconds - Number of seconds to wait
 * @returns Formatted time string
 */
export function formatRetryAfter(retryAfterSeconds?: number): string {
  if (!retryAfterSeconds || retryAfterSeconds <= 0) {
    return "a moment";
  }

  if (retryAfterSeconds < 60) {
    return `${retryAfterSeconds}s`;
  }

  if (retryAfterSeconds < 3600) {
    const minutes = Math.ceil(retryAfterSeconds / 60);
    return `${minutes} min`;
  }

  const hours = Math.floor(retryAfterSeconds / 3600);
  const remainingMinutes = Math.ceil((retryAfterSeconds % 3600) / 60);

  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainingMinutes} min`;
}

/**
 * Replace {X} placeholder in template with formatted retry time.
 *
 * @param template - Message template containing {X}
 * @param options - Options with retryAfterSeconds
 * @returns Formatted message with {X} replaced
 */
export function formatErrorMessage(
  template: string,
  options: { retryAfterSeconds?: number }
): string {
  const timeStr = formatRetryAfter(options.retryAfterSeconds);
  return template.replace(/\{X\}/g, timeStr);
}

/**
 * Generate a short request ID for debugging.
 * Returns 8 character base36 string.
 */
export function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 10);
}
