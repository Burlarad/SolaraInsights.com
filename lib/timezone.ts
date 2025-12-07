/**
 * Timezone inference helper for Solara Insights
 *
 * This is basic civil timekeeping, not astrology logic.
 * It attempts to infer an IANA timezone from a birthplace (city + region + country).
 *
 * This is a fallback for when profile.timezone is missing or clearly wrong (e.g., "UTC" for a US city).
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

/**
 * US state to timezone mapping
 * This is a simplified mapping - some states span multiple timezones.
 * We use the most populous timezone for each state.
 */
const US_STATE_TIMEZONES: Record<string, string> = {
  // Eastern Time
  "Connecticut": "America/New_York",
  "Delaware": "America/New_York",
  "Florida": "America/New_York", // Most of FL is Eastern
  "Georgia": "America/New_York",
  "Maine": "America/New_York",
  "Maryland": "America/New_York",
  "Massachusetts": "America/New_York",
  "Michigan": "America/New_York", // Most of MI is Eastern
  "New Hampshire": "America/New_York",
  "New Jersey": "America/New_York",
  "New York": "America/New_York",
  "North Carolina": "America/New_York",
  "Ohio": "America/New_York",
  "Pennsylvania": "America/New_York",
  "Rhode Island": "America/New_York",
  "South Carolina": "America/New_York",
  "Vermont": "America/New_York",
  "Virginia": "America/New_York",
  "West Virginia": "America/New_York",
  "Washington, D.C.": "America/New_York",
  "District of Columbia": "America/New_York",

  // Central Time
  "Alabama": "America/Chicago",
  "Arkansas": "America/Chicago",
  "Illinois": "America/Chicago",
  "Indiana": "America/Chicago", // Most of IN is now Eastern, but some use Central
  "Iowa": "America/Chicago",
  "Kansas": "America/Chicago", // Most of KS is Central
  "Kentucky": "America/Chicago", // Most of KY is Eastern, western part is Central
  "Louisiana": "America/Chicago",
  "Minnesota": "America/Chicago",
  "Mississippi": "America/Chicago",
  "Missouri": "America/Chicago",
  "Nebraska": "America/Chicago", // Most of NE is Central
  "North Dakota": "America/Chicago", // Most of ND is Central
  "Oklahoma": "America/Chicago",
  "South Dakota": "America/Chicago", // Most of SD is Central
  "Tennessee": "America/Chicago", // Most of TN is Central
  "Texas": "America/Chicago", // Most of TX is Central
  "Wisconsin": "America/Chicago",

  // Mountain Time
  "Arizona": "America/Phoenix", // No DST
  "Colorado": "America/Denver",
  "Idaho": "America/Denver", // Most of ID is Mountain
  "Montana": "America/Denver",
  "Nevada": "America/Denver", // Most of NV is Pacific, but some use Mountain
  "New Mexico": "America/Denver",
  "Utah": "America/Denver",
  "Wyoming": "America/Denver",

  // Pacific Time
  "California": "America/Los_Angeles",
  "Oregon": "America/Los_Angeles", // Most of OR is Pacific
  "Washington": "America/Los_Angeles",

  // Alaska Time
  "Alaska": "America/Anchorage",

  // Hawaii Time
  "Hawaii": "Pacific/Honolulu",
};

/**
 * Major city to timezone mapping (for common international cities)
 */
const CITY_TIMEZONES: Record<string, string> = {
  // UK
  "London": "Europe/London",
  "Manchester": "Europe/London",
  "Birmingham": "Europe/London",
  "Edinburgh": "Europe/London",
  "Glasgow": "Europe/London",

  // France
  "Paris": "Europe/Paris",
  "Lyon": "Europe/Paris",
  "Marseille": "Europe/Paris",

  // Germany
  "Berlin": "Europe/Berlin",
  "Munich": "Europe/Berlin",
  "Hamburg": "Europe/Berlin",
  "Frankfurt": "Europe/Berlin",

  // Canada
  "Toronto": "America/Toronto",
  "Montreal": "America/Toronto",
  "Vancouver": "America/Vancouver",
  "Calgary": "America/Denver",
  "Ottawa": "America/Toronto",

  // Australia
  "Sydney": "Australia/Sydney",
  "Melbourne": "Australia/Melbourne",
  "Brisbane": "Australia/Brisbane",
  "Perth": "Australia/Perth",

  // Asia
  "Tokyo": "Asia/Tokyo",
  "Shanghai": "Asia/Shanghai",
  "Hong Kong": "Asia/Hong_Kong",
  "Singapore": "Asia/Singapore",
  "Seoul": "Asia/Seoul",
  "Dubai": "Asia/Dubai",
  "Mumbai": "Asia/Kolkata",
  "Delhi": "Asia/Kolkata",
  "Bangkok": "Asia/Bangkok",

  // Other major cities
  "Mexico City": "America/Mexico_City",
  "Sao Paulo": "America/Sao_Paulo",
  "Buenos Aires": "America/Buenos_Aires",
  "Cairo": "Africa/Cairo",
  "Johannesburg": "Africa/Johannesburg",
  "Auckland": "Pacific/Auckland",
};

/**
 * Infer an IANA timezone from birthplace details
 *
 * This is a best-effort approach using common mappings.
 * Returns null if we can't confidently infer a timezone.
 */
export function inferTimezoneFromBirthplace(
  city: string | null,
  region: string | null,
  country: string | null
): string | null {
  if (!city || !country) return null;

  const normalizedCity = city.trim();
  const normalizedRegion = region?.trim() || "";
  const normalizedCountry = country.trim();

  // Check if country is United States (various forms)
  const isUS =
    normalizedCountry === "United States" ||
    normalizedCountry === "USA" ||
    normalizedCountry === "US" ||
    normalizedCountry === "United States of America";

  if (isUS && normalizedRegion) {
    // Try to map US state/region to timezone
    const stateTimezone = US_STATE_TIMEZONES[normalizedRegion];
    if (stateTimezone) {
      return stateTimezone;
    }
  }

  // Try to map major cities directly
  const cityTimezone = CITY_TIMEZONES[normalizedCity];
  if (cityTimezone) {
    return cityTimezone;
  }

  // Country-level fallbacks (for countries with single timezone)
  if (normalizedCountry === "United Kingdom" || normalizedCountry === "UK") {
    return "Europe/London";
  }
  if (normalizedCountry === "France") {
    return "Europe/Paris";
  }
  if (normalizedCountry === "Germany") {
    return "Europe/Berlin";
  }
  if (normalizedCountry === "Japan") {
    return "Asia/Tokyo";
  }
  if (normalizedCountry === "China") {
    return "Asia/Shanghai";
  }

  // Can't confidently infer
  return null;
}
