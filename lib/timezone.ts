/**
 * Timezone constants for Solara Insights
 *
 * Common IANA timezones for settings UI dropdown.
 */

/**
 * Common IANA timezones for settings UI
 */
export const COMMON_TIMEZONES = [
  // US timezones
  "America/New_York",      // Eastern
  "America/Chicago",       // Central
  "America/Denver",        // Mountain
  "America/Phoenix",       // Arizona (no DST)
  "America/Los_Angeles",   // Pacific
  "America/Anchorage",     // Alaska
  "Pacific/Honolulu",      // Hawaii

  // Major international cities
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Vienna",
  "Europe/Prague",
  "Europe/Warsaw",
  "Europe/Moscow",

  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Singapore",
  "Asia/Seoul",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",

  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Perth",

  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Buenos_Aires",

  "Africa/Cairo",
  "Africa/Johannesburg",

  "Pacific/Auckland",

  "UTC",
] as const;
