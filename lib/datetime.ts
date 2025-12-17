/**
 * Datetime utility functions for Solara
 *
 * IMPORTANT: Solara displays dates/times exactly as the user entered them.
 * No timezone conversions should be applied to display values.
 */

/**
 * Format a date string (YYYY-MM-DD) for display WITHOUT timezone conversion
 *
 * @param dateString - ISO date string like "1992-05-04"
 * @returns Formatted date like "May 4, 1992"
 */
export function formatDateForDisplay(dateString: string | null): string {
  if (!dateString) return "Unknown";

  // Parse the date components directly from the string (no Date object to avoid timezone issues)
  const [year, month, day] = dateString.split("-").map(Number);

  if (!year || !month || !day) return dateString;

  // Create date in local timezone explicitly
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
