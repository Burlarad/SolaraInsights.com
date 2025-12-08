/**
 * Server-side helper to resolve birth location to lat/lon/timezone using OpenStreetMap.
 *
 * Uses:
 * - OpenStreetMap Nominatim API: city/region/country → lat/lon
 * - tz-lookup library: lat/lon → IANA timezone
 *
 * No API keys required - fully open source solution.
 */

import tzLookup from "tz-lookup";

export type BirthPlaceInput = {
  city: string;
  region: string;
  country: string;
  birthDate: string; // "YYYY-MM-DD"
  birthTime: string; // "HH:MM"
};

export type ResolvedBirthLocation = {
  lat: number;
  lon: number;
  timezone: string; // IANA tz like "America/New_York"
};

/**
 * Resolves birth location (city/region/country) to precise lat/lon and IANA timezone.
 *
 * @param input - Birth place details including date/time for timezone accuracy
 * @returns Resolved latitude, longitude, and IANA timezone
 * @throws Error if geocoding fails or timezone cannot be determined
 */
export async function resolveBirthLocation(
  input: BirthPlaceInput
): Promise<ResolvedBirthLocation> {
  console.log("[Location] Resolving birth place:", {
    city: input.city,
    region: input.region,
    country: input.country,
  });

  // Step 1: Geocode the address to get lat/lon using OpenStreetMap Nominatim
  const query = `${input.city}, ${input.region}, ${input.country}`;
  const encodedQuery = encodeURIComponent(query);
  const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=1`;

  console.log(`[Location] Geocoding address: "${query}"`);

  try {
    const geocodeResponse = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": "Solara-Insights-App/1.0", // Nominatim requires a User-Agent
      },
    });

    if (!geocodeResponse.ok) {
      throw new Error(
        `Nominatim API request failed: ${geocodeResponse.status} ${geocodeResponse.statusText}`
      );
    }

    const geocodeData = await geocodeResponse.json();

    if (!Array.isArray(geocodeData) || geocodeData.length === 0) {
      console.error(`[Location] Geocoding failed for "${query}": No results found`);
      throw new Error(
        `Could not find location "${query}". Please check the city, region, and country spelling.`
      );
    }

    const result = geocodeData[0];
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    if (isNaN(lat) || isNaN(lon)) {
      throw new Error(
        `Invalid coordinates received from geocoding service for "${query}"`
      );
    }

    console.log(`[Location] Geocoded "${query}" to lat=${lat}, lon=${lon}`);

    // Step 2: Get IANA timezone for this lat/lon using tz-lookup
    console.log(`[Location] Looking up timezone for lat=${lat}, lon=${lon}`);

    const timezone = tzLookup(lat, lon);

    if (!timezone) {
      throw new Error(
        `Could not determine timezone for coordinates (${lat}, ${lon}). This location may be in international waters or an unmapped area.`
      );
    }

    console.log(`[Location] Geocoded to:`, { lat, lon, timezone });

    return {
      lat,
      lon,
      timezone,
    };
  } catch (error: any) {
    console.error("[Location] Error resolving birth location:", error);

    // Re-throw with more context if it's not already our custom error
    if (error.message.includes("Could not find location") ||
        error.message.includes("Could not determine timezone") ||
        error.message.includes("Invalid coordinates")) {
      throw error;
    }

    throw new Error(
      `Failed to resolve birth location: ${error.message || "Unknown error"}`
    );
  }
}
