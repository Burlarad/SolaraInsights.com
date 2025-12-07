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

/**
 * Format a time string (HH:MM) for display
 *
 * @param timeString - 24-hour time like "23:50"
 * @returns Formatted time like "11:50 PM" or the original if null
 */
export function formatTimeForDisplay(timeString: string | null): string {
  if (!timeString) return "Unknown";

  const [hours, minutes] = timeString.split(":").map(Number);

  if (hours === undefined || minutes === undefined) return timeString;

  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

/**
 * Build a complete birth datetime string for OpenAI prompts
 * This combines date, time, and location but keeps them as separate display values
 *
 * @param birthDate - ISO date string like "1992-05-04"
 * @param birthTime - 24-hour time like "23:50" or null
 * @param timezone - IANA timezone like "America/New_York"
 * @returns Object with display values and a combined string for AI context
 */
export function buildBirthDateTime(
  birthDate: string,
  birthTime: string | null,
  timezone: string
): {
  displayDate: string;
  displayTime: string;
  displayTimezone: string;
  aiContextString: string;
} {
  const displayDate = formatDateForDisplay(birthDate);
  const displayTime = birthTime || "Unknown";
  const displayTimezone = timezone;

  // For AI context, we pass the raw values plus timezone
  const aiContextString = birthTime
    ? `${birthDate} at ${birthTime} (${timezone})`
    : `${birthDate} (time unknown) in ${timezone}`;

  return {
    displayDate,
    displayTime,
    displayTimezone,
    aiContextString,
  };
}
