/**
 * Server-side helper to resolve birth location to lat/lon/timezone using Google Maps Platform.
 *
 * Uses:
 * - Google Geocoding API: city/region/country → lat/lon
 * - Google Time Zone API: lat/lon + timestamp → IANA timezone
 *
 * Requires: GOOGLE_MAPS_API_KEY environment variable
 */

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
 * @throws Error if Google API key is missing or API calls fail
 */
export async function resolveBirthLocation(
  input: BirthPlaceInput
): Promise<ResolvedBirthLocation> {
  // Validate Google API key
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing GOOGLE_MAPS_API_KEY environment variable. Please add it to your .env file."
    );
  }

  // Step 1: Geocode the address to get lat/lon
  const address = `${input.city}, ${input.region}, ${input.country}`;
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&key=${apiKey}`;

  console.log(`[Location] Geocoding address: "${address}"`);

  const geocodeResponse = await fetch(geocodeUrl);
  if (!geocodeResponse.ok) {
    throw new Error(
      `Google Geocoding API request failed: ${geocodeResponse.status} ${geocodeResponse.statusText}`
    );
  }

  const geocodeData = await geocodeResponse.json();

  if (geocodeData.status !== "OK" || !geocodeData.results?.[0]) {
    console.error(`[Location] Geocoding failed for "${address}":`, geocodeData.status);
    throw new Error(
      `Could not geocode location "${address}". Status: ${geocodeData.status}. Please check the city/region/country spelling.`
    );
  }

  const location = geocodeData.results[0].geometry.location;
  const lat = location.lat;
  const lng = location.lng;

  console.log(`[Location] Geocoded "${address}" to lat=${lat}, lon=${lng}`);

  // Step 2: Get IANA timezone for this lat/lon at the birth date/time
  // Convert birth date + time to Unix timestamp for timezone lookup
  // Note: We use a naive local time assumption here since we don't yet know the timezone
  // Google's API will give us the timezone that was active at this lat/lon at this timestamp
  const localDateTime = new Date(`${input.birthDate}T${input.birthTime}:00`);
  const timestamp = Math.floor(localDateTime.getTime() / 1000);

  const timezoneUrl = `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${timestamp}&key=${apiKey}`;

  console.log(`[Location] Getting timezone for lat=${lat}, lon=${lng}, timestamp=${timestamp}`);

  const timezoneResponse = await fetch(timezoneUrl);
  if (!timezoneResponse.ok) {
    throw new Error(
      `Google Time Zone API request failed: ${timezoneResponse.status} ${timezoneResponse.statusText}`
    );
  }

  const timezoneData = await timezoneResponse.json();

  if (timezoneData.status !== "OK" || !timezoneData.timeZoneId) {
    console.error(
      `[Location] Timezone lookup failed for lat=${lat}, lon=${lng}:`,
      timezoneData.status
    );
    throw new Error(
      `Could not determine timezone for coordinates (${lat}, ${lng}). Status: ${timezoneData.status}`
    );
  }

  const timezone = timezoneData.timeZoneId;

  console.log(`[Location] Resolved "${address}" → lat=${lat}, lon=${lng}, timezone=${timezone}`);

  return {
    lat,
    lon: lng,
    timezone,
  };
}
