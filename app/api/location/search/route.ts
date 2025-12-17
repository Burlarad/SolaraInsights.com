/**
 * Location search endpoint for PlacePicker component.
 *
 * Features:
 * - OpenStreetMap Nominatim API with addressdetails=1
 * - Input normalization (diacritics/accents, whitespace)
 * - Retry with exponential backoff (handles 429, 5xx, timeouts)
 * - Redis caching (7-day TTL for results, 6-hour for empty)
 * - Pre-resolved timezone using tz-lookup
 */

import { NextRequest, NextResponse } from "next/server";
import tzLookup from "tz-lookup";
import { getCache, setCache } from "@/lib/cache/redis";

// ========================================
// Types
// ========================================

export type LocationCandidate = {
  displayName: string;
  birth_city: string;
  birth_region: string;
  birth_country: string;
  lat: number;
  lon: number;
  timezone: string;
  place_id: number;
};

type NominatimResult = {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    hamlet?: string;
    suburb?: string;
    state?: string;
    region?: string;
    county?: string;
    state_district?: string;
    province?: string;
    country?: string;
  };
};

type CachedSearchResult = {
  candidates: LocationCandidate[];
  cachedAt: string;
};

// ========================================
// Constants
// ========================================

const CACHE_VERSION = "v1";
const CACHE_TTL_SUCCESS = 7 * 24 * 60 * 60; // 7 days in seconds
const CACHE_TTL_EMPTY = 6 * 60 * 60; // 6 hours for empty results

const NOMINATIM_TIMEOUT_MS = 10000; // 10 seconds
const RETRY_DELAYS_MS = [500, 1000, 2000]; // Exponential backoff

// ========================================
// Input Normalization
// ========================================

/**
 * Strip diacritics/accents from a string.
 * "Perú" -> "Peru", "São Paulo" -> "Sao Paulo"
 */
function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normalize whitespace: trim and collapse multiple spaces.
 */
function normalizeWhitespace(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/**
 * Full normalization for cache key: lowercase, no diacritics, collapsed whitespace.
 */
function normalizeForCacheKey(s: string): string {
  return stripDiacritics(normalizeWhitespace(s)).toLowerCase();
}

/**
 * Build cache key for a search query.
 */
function getCacheKey(normalizedQuery: string): string {
  return `locsearch:${CACHE_VERSION}:${normalizedQuery}`;
}

// ========================================
// Address Extraction Helpers
// ========================================

function extractCity(address: NominatimResult["address"]): string {
  return (
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.hamlet ||
    address.suburb ||
    ""
  );
}

function extractRegion(address: NominatimResult["address"]): string {
  return (
    address.state ||
    address.region ||
    address.county ||
    address.state_district ||
    address.province ||
    ""
  );
}

function extractCountry(address: NominatimResult["address"]): string {
  return address.country || "";
}

function buildDisplayName(city: string, region: string, country: string): string {
  return [city, region, country].filter(Boolean).join(", ");
}

// ========================================
// Nominatim Fetch with Retry
// ========================================

/**
 * Fetch from Nominatim with retry and exponential backoff.
 * Retries on: 429 (rate limit), 5xx (server errors), timeouts.
 */
async function fetchNominatimWithRetry(
  url: string,
  maxRetries: number = 3
): Promise<{ ok: boolean; data?: NominatimResult[]; error?: string }> {
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Solara-Insights-App/1.0 (contact@solara.app)",
          "Accept-Language": "en", // Consistent English admin area names
        },
      });

      clearTimeout(timeoutId);

      // Success
      if (response.ok) {
        const data = await response.json();
        if (attempt > 0) {
          console.log(`[Location Search] Succeeded on attempt ${attempt + 1}`);
        }
        return { ok: true, data };
      }

      // Rate limited or server error - retry
      if (response.status === 429 || response.status >= 500) {
        lastError = `HTTP ${response.status}`;

        if (attempt < maxRetries) {
          const delay = RETRY_DELAYS_MS[attempt] || 2000;
          console.warn(
            `[Location Search] ${lastError}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`
          );
          await sleep(delay);
          continue;
        }
      }

      // Non-retryable error
      return { ok: false, error: `HTTP ${response.status}: ${response.statusText}` };
    } catch (err: any) {
      clearTimeout(timeoutId);

      // Timeout or network error
      if (err.name === "AbortError") {
        lastError = "Timeout";
      } else {
        lastError = err.message || "Network error";
      }

      if (attempt < maxRetries) {
        const delay = RETRY_DELAYS_MS[attempt] || 2000;
        console.warn(
          `[Location Search] ${lastError}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`
        );
        await sleep(delay);
        continue;
      }
    }
  }

  return { ok: false, error: lastError || "Max retries exceeded" };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ========================================
// Transform Results
// ========================================

function transformResults(results: NominatimResult[]): LocationCandidate[] {
  const candidates: LocationCandidate[] = [];
  const seenDisplayNames = new Set<string>();

  for (const result of results) {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    if (isNaN(lat) || isNaN(lon)) continue;

    const city = extractCity(result.address);
    const region = extractRegion(result.address);
    const country = extractCountry(result.address);

    // Skip results without a city
    if (!city) continue;

    const displayName = buildDisplayName(city, region, country);

    // Deduplicate by display name
    if (seenDisplayNames.has(displayName)) continue;
    seenDisplayNames.add(displayName);

    // Get timezone using tz-lookup
    let timezone: string;
    try {
      timezone = tzLookup(lat, lon);
    } catch {
      continue; // Skip if timezone can't be determined
    }

    candidates.push({
      displayName,
      birth_city: city,
      birth_region: region,
      birth_country: country,
      lat,
      lon,
      timezone,
      place_id: result.place_id,
    });
  }

  return candidates;
}

// ========================================
// Main Handler
// ========================================

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return NextResponse.json(
        { error: "Query must be at least 2 characters" },
        { status: 400 }
      );
    }

    // Normalize input
    const cleanQuery = normalizeWhitespace(query);
    const normalizedQuery = normalizeForCacheKey(query);
    const cacheKey = getCacheKey(normalizedQuery);

    // Check cache first
    const cached = await getCache<CachedSearchResult>(cacheKey);
    if (cached) {
      console.log(`[Location Search] Cache hit for: "${cleanQuery}"`);
      return NextResponse.json({ candidates: cached.candidates });
    }

    console.log(`[Location Search] Searching for: "${cleanQuery}"`);

    // Prepare search queries
    const queriesToTry: string[] = [cleanQuery];

    // Add diacritics-stripped variant if different
    const strippedQuery = stripDiacritics(cleanQuery);
    if (strippedQuery !== cleanQuery) {
      queriesToTry.push(strippedQuery);
    }

    // Collect all results
    const allResults: NominatimResult[] = [];
    const seenPlaceIds = new Set<number>();

    for (const searchQuery of queriesToTry) {
      const encodedQuery = encodeURIComponent(searchQuery);
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=5&addressdetails=1`;

      const result = await fetchNominatimWithRetry(nominatimUrl);

      if (!result.ok) {
        console.error(`[Location Search] Nominatim failed: ${result.error}`);
        // Continue to try other query variants
        continue;
      }

      // Deduplicate by place_id
      for (const item of result.data || []) {
        if (!seenPlaceIds.has(item.place_id)) {
          seenPlaceIds.add(item.place_id);
          allResults.push(item);
        }
      }

      // If we got results with the original query, no need to try stripped version
      if (allResults.length > 0 && searchQuery === cleanQuery) {
        break;
      }
    }

    // Transform to candidates
    const candidates = transformResults(allResults);

    console.log(
      `[Location Search] Found ${candidates.length} candidates for: "${cleanQuery}"`
    );

    // Cache the result
    const cacheData: CachedSearchResult = {
      candidates,
      cachedAt: new Date().toISOString(),
    };
    const ttl = candidates.length > 0 ? CACHE_TTL_SUCCESS : CACHE_TTL_EMPTY;
    await setCache(cacheKey, cacheData, ttl);

    return NextResponse.json({ candidates });
  } catch (error: any) {
    console.error("[Location Search] Error:", error);
    return NextResponse.json(
      { error: "Failed to search locations" },
      { status: 500 }
    );
  }
}
