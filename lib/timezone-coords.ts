/**
 * Timezone to Coordinates Lookup
 *
 * Maps IANA timezones to approximate center coordinates.
 * Used for sunrise/sunset calculations when browser geolocation is denied.
 *
 * These are approximate city-center coordinates for major timezone regions.
 * Accuracy is sufficient for sunrise/sunset calculations (within ~30 minutes).
 */

export const TIMEZONE_COORDS: Record<string, { lat: number; lon: number }> = {
  // North America - USA
  "America/New_York": { lat: 40.7128, lon: -74.006 },
  "America/Chicago": { lat: 41.8781, lon: -87.6298 },
  "America/Denver": { lat: 39.7392, lon: -104.9903 },
  "America/Los_Angeles": { lat: 34.0522, lon: -118.2437 },
  "America/Phoenix": { lat: 33.4484, lon: -112.074 },
  "America/Anchorage": { lat: 61.2181, lon: -149.9003 },
  "America/Juneau": { lat: 58.3019, lon: -134.4197 },
  "America/Detroit": { lat: 42.3314, lon: -83.0458 },
  "America/Indiana/Indianapolis": { lat: 39.7684, lon: -86.1581 },
  "America/Kentucky/Louisville": { lat: 38.2527, lon: -85.7585 },
  "America/Boise": { lat: 43.615, lon: -116.2023 },
  "Pacific/Honolulu": { lat: 21.3069, lon: -157.8583 },

  // North America - Canada
  "America/Toronto": { lat: 43.6532, lon: -79.3832 },
  "America/Vancouver": { lat: 49.2827, lon: -123.1207 },
  "America/Edmonton": { lat: 53.5461, lon: -113.4938 },
  "America/Winnipeg": { lat: 49.8951, lon: -97.1384 },
  "America/Halifax": { lat: 44.6488, lon: -63.5752 },
  "America/St_Johns": { lat: 47.5615, lon: -52.7126 },
  "America/Regina": { lat: 50.4452, lon: -104.6189 },

  // North America - Mexico
  "America/Mexico_City": { lat: 19.4326, lon: -99.1332 },
  "America/Tijuana": { lat: 32.5149, lon: -117.0382 },
  "America/Cancun": { lat: 21.1619, lon: -86.8515 },

  // Europe - Western
  "Europe/London": { lat: 51.5074, lon: -0.1278 },
  "Europe/Dublin": { lat: 53.3498, lon: -6.2603 },
  "Europe/Lisbon": { lat: 38.7223, lon: -9.1393 },
  "Atlantic/Reykjavik": { lat: 64.1466, lon: -21.9426 },

  // Europe - Central
  "Europe/Paris": { lat: 48.8566, lon: 2.3522 },
  "Europe/Berlin": { lat: 52.52, lon: 13.405 },
  "Europe/Rome": { lat: 41.9028, lon: 12.4964 },
  "Europe/Madrid": { lat: 40.4168, lon: -3.7038 },
  "Europe/Amsterdam": { lat: 52.3676, lon: 4.9041 },
  "Europe/Brussels": { lat: 50.8503, lon: 4.3517 },
  "Europe/Vienna": { lat: 48.2082, lon: 16.3738 },
  "Europe/Zurich": { lat: 47.3769, lon: 8.5417 },
  "Europe/Stockholm": { lat: 59.3293, lon: 18.0686 },
  "Europe/Oslo": { lat: 59.9139, lon: 10.7522 },
  "Europe/Copenhagen": { lat: 55.6761, lon: 12.5683 },
  "Europe/Warsaw": { lat: 52.2297, lon: 21.0122 },
  "Europe/Prague": { lat: 50.0755, lon: 14.4378 },
  "Europe/Budapest": { lat: 47.4979, lon: 19.0402 },

  // Europe - Eastern
  "Europe/Moscow": { lat: 55.7558, lon: 37.6173 },
  "Europe/Kiev": { lat: 50.4501, lon: 30.5234 },
  "Europe/Kyiv": { lat: 50.4501, lon: 30.5234 },
  "Europe/Athens": { lat: 37.9838, lon: 23.7275 },
  "Europe/Istanbul": { lat: 41.0082, lon: 28.9784 },
  "Europe/Bucharest": { lat: 44.4268, lon: 26.1025 },
  "Europe/Helsinki": { lat: 60.1699, lon: 24.9384 },

  // Asia - East
  "Asia/Tokyo": { lat: 35.6762, lon: 139.6503 },
  "Asia/Shanghai": { lat: 31.2304, lon: 121.4737 },
  "Asia/Hong_Kong": { lat: 22.3193, lon: 114.1694 },
  "Asia/Seoul": { lat: 37.5665, lon: 126.978 },
  "Asia/Taipei": { lat: 25.033, lon: 121.5654 },

  // Asia - Southeast
  "Asia/Singapore": { lat: 1.3521, lon: 103.8198 },
  "Asia/Bangkok": { lat: 13.7563, lon: 100.5018 },
  "Asia/Jakarta": { lat: -6.2088, lon: 106.8456 },
  "Asia/Manila": { lat: 14.5995, lon: 120.9842 },
  "Asia/Ho_Chi_Minh": { lat: 10.8231, lon: 106.6297 },
  "Asia/Kuala_Lumpur": { lat: 3.139, lon: 101.6869 },

  // Asia - South
  "Asia/Kolkata": { lat: 22.5726, lon: 88.3639 },
  "Asia/Mumbai": { lat: 19.076, lon: 72.8777 },
  "Asia/Dhaka": { lat: 23.8103, lon: 90.4125 },
  "Asia/Karachi": { lat: 24.8607, lon: 67.0011 },
  "Asia/Colombo": { lat: 6.9271, lon: 79.8612 },

  // Asia - Middle East
  "Asia/Dubai": { lat: 25.2048, lon: 55.2708 },
  "Asia/Riyadh": { lat: 24.7136, lon: 46.6753 },
  "Asia/Tehran": { lat: 35.6892, lon: 51.389 },
  "Asia/Jerusalem": { lat: 31.7683, lon: 35.2137 },
  "Asia/Beirut": { lat: 33.8938, lon: 35.5018 },
  "Asia/Baghdad": { lat: 33.3152, lon: 44.3661 },
  "Asia/Kuwait": { lat: 29.3759, lon: 47.9774 },
  "Asia/Qatar": { lat: 25.2854, lon: 51.531 },

  // Asia - Central
  "Asia/Almaty": { lat: 43.2389, lon: 76.9458 },
  "Asia/Tashkent": { lat: 41.2995, lon: 69.2401 },

  // Oceania
  "Australia/Sydney": { lat: -33.8688, lon: 151.2093 },
  "Australia/Melbourne": { lat: -37.8136, lon: 144.9631 },
  "Australia/Perth": { lat: -31.9505, lon: 115.8605 },
  "Australia/Brisbane": { lat: -27.4698, lon: 153.0251 },
  "Australia/Adelaide": { lat: -34.9285, lon: 138.6007 },
  "Australia/Darwin": { lat: -12.4634, lon: 130.8456 },
  "Australia/Hobart": { lat: -42.8821, lon: 147.3272 },
  "Pacific/Auckland": { lat: -36.8509, lon: 174.7645 },
  "Pacific/Fiji": { lat: -18.1416, lon: 178.4419 },
  "Pacific/Guam": { lat: 13.4443, lon: 144.7937 },

  // South America
  "America/Sao_Paulo": { lat: -23.5505, lon: -46.6333 },
  "America/Buenos_Aires": { lat: -34.6037, lon: -58.3816 },
  "America/Santiago": { lat: -33.4489, lon: -70.6693 },
  "America/Lima": { lat: -12.0464, lon: -77.0428 },
  "America/Bogota": { lat: 4.711, lon: -74.0721 },
  "America/Caracas": { lat: 10.4806, lon: -66.9036 },
  "America/Montevideo": { lat: -34.9011, lon: -56.1645 },

  // Africa
  "Africa/Cairo": { lat: 30.0444, lon: 31.2357 },
  "Africa/Johannesburg": { lat: -26.2041, lon: 28.0473 },
  "Africa/Lagos": { lat: 6.5244, lon: 3.3792 },
  "Africa/Nairobi": { lat: -1.2921, lon: 36.8219 },
  "Africa/Casablanca": { lat: 33.5731, lon: -7.5898 },
  "Africa/Accra": { lat: 5.6037, lon: -0.187 },
  "Africa/Addis_Ababa": { lat: 9.0054, lon: 38.7636 },
  "Africa/Algiers": { lat: 36.7538, lon: 3.0588 },
  "Africa/Tunis": { lat: 36.8065, lon: 10.1815 },
  "Africa/Cape_Town": { lat: -33.9249, lon: 18.4241 },

  // Caribbean
  "America/Puerto_Rico": { lat: 18.4655, lon: -66.1057 },
  "America/Jamaica": { lat: 18.1096, lon: -77.2975 },
  "America/Havana": { lat: 23.1136, lon: -82.3666 },
  "America/Santo_Domingo": { lat: 18.4861, lon: -69.9312 },
  "America/Port_of_Spain": { lat: 10.6596, lon: -61.5086 },
};

/**
 * Get approximate coordinates for a given timezone.
 * Used for sunrise/sunset calculations when exact geolocation is unavailable.
 *
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @returns Coordinates object or null if timezone not found
 */
export function getCoordsFromTimezone(
  timezone: string
): { lat: number; lon: number } | null {
  // Direct match
  if (TIMEZONE_COORDS[timezone]) {
    return TIMEZONE_COORDS[timezone];
  }

  // Try to find partial match by region prefix
  // e.g., "America/Indiana/Indianapolis" → look for "America/*" matches
  const parts = timezone.split("/");

  if (parts.length >= 2) {
    const region = parts[0];

    // Find first matching timezone in same region
    const fallbackKey = Object.keys(TIMEZONE_COORDS).find(
      (tz) => tz.startsWith(region + "/")
    );

    if (fallbackKey) {
      console.log(
        `[Timezone] No exact match for "${timezone}", using fallback "${fallbackKey}"`
      );
      return TIMEZONE_COORDS[fallbackKey];
    }
  }

  console.warn(`[Timezone] No coordinates found for timezone "${timezone}"`);
  return null;
}

/**
 * Get default fallback coordinates (approximate center of USA)
 * Used as last resort when timezone lookup fails.
 */
export function getDefaultCoords(): { lat: number; lon: number } {
  return { lat: 39.8283, lon: -98.5795 }; // Geographic center of USA
}
