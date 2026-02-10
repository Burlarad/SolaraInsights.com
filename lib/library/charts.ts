/**
 * Global Charts Library
 *
 * Manages the global deduplicated library of birth charts.
 *
 * Core Principles:
 * - Charts are stored once, referenced by deterministic chart_key
 * - Multiple users with same birth inputs share the same chart record
 * - Preview charts are stored globally (not per-user)
 * - Official charts come from Settings only
 * - Book = Math (geometry_json) + Narrative (narrative_json) stored together
 */

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { computeSwissPlacements, type SwissPlacements } from "@/lib/ephemeris/swissEngine";
import {
  computeChartKey,
  normalizeChartInput,
  isChartInputComplete,
  CHART_ENGINE_VERSION,
  type ChartInput,
} from "./keyNormalization";
import {
  generateCompleteNarrative,
  NARRATIVE_PROMPT_VERSION,
} from "./narrativeGenerator";
import type { FullBirthChartInsight } from "@/types/natalAI";

export type ChartLibraryEntry = {
  chart_key: string;
  input_json: ChartInput;
  geometry_json: SwissPlacements;
  engine_config: typeof CHART_ENGINE_VERSION;
  // Narrative columns (Book = Math + Narrative)
  narrative_json: FullBirthChartInsight | null;
  narrative_prompt_version: number | null;
  narrative_language: string | null;
  narrative_generated_at: string | null;
  // Metadata
  created_at: string;
  last_accessed_at: string;
  access_count: number;
};

/**
 * Get chart from global library by key
 *
 * @param chartKey - Deterministic chart key
 * @returns Chart entry if exists, null otherwise
 */
export async function getChartFromLibrary(chartKey: string): Promise<ChartLibraryEntry | null> {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("astrology_library")
    .select("*")
    .eq("chart_key", chartKey)
    .maybeSingle();

  if (error) {
    console.error("[ChartsLibrary] Error fetching chart:", error);
    return null;
  }

  if (data) {
    // Update access tracking (fire and forget)
    void trackChartAccess(chartKey);
  }

  return data;
}

/**
 * Get or compute chart
 *
 * Workflow:
 * 1. Validate inputs are complete
 * 2. Normalize inputs
 * 3. Compute deterministic key
 * 4. Try to fetch from library
 * 5. If not found, compute and store
 *
 * @param input - Birth input data
 * @returns Chart entry
 * @throws Error if inputs incomplete or computation fails
 */
export async function getOrComputeChart(input: Partial<ChartInput>): Promise<ChartLibraryEntry> {
  // Validate inputs (CRITICAL: no noon defaulting)
  if (!isChartInputComplete(input)) {
    throw new Error("Incomplete birth data: all fields required for chart computation (birth_date, birth_time, birth_lat, birth_lon, timezone)");
  }

  // Normalize inputs
  const normalized = normalizeChartInput(input);

  // Compute deterministic key
  const chartKey = computeChartKey(normalized);

  // Try to fetch from library (global dedupe)
  const existing = await getChartFromLibrary(chartKey);
  if (existing) {
    console.log(`[ChartsLibrary] Found existing chart: ${chartKey}`);
    return existing;
  }

  // Not found - compute fresh
  console.log(`[ChartsLibrary] Computing new chart: ${chartKey}`);
  const placements = await computeSwissPlacements({
    date: normalized.birth_date,
    time: normalized.birth_time, // NO defaulting - already validated
    timezone: normalized.timezone,
    lat: normalized.birth_lat,
    lon: normalized.birth_lon,
  });

  // Store in library
  const supabase = createAdminSupabaseClient();

  const { error: upsertError } = await supabase
    .from("astrology_library")
    .upsert(
      {
        chart_key: chartKey,
        input_json: normalized,
        geometry_json: placements,
        engine_config: CHART_ENGINE_VERSION,
      },
      {
        onConflict: "chart_key",
        ignoreDuplicates: true,
      }
    );

  if (upsertError) {
    console.error("[ChartsLibrary] Error storing chart:", upsertError);

    // Duplicate key = chart already exists → treat as cache hit
    if ((upsertError as any).code === "23505") {
      const { data: existing, error: existingError } = await supabase
        .from("astrology_library")
        .select("*")
        .eq("chart_key", chartKey)
        .single();

      if (!existingError && existing) {
        return existing;
      }

      if (existingError) {
        console.error("[ChartsLibrary] Error fetching existing chart:", existingError);
      }
    }

    throw new Error(`Failed to store chart: ${upsertError.message}`);
  }

  console.log(`[ChartsLibrary] ✓ Chart computed and stored: ${chartKey}`);

  const { data: stored, error: fetchError } = await supabase
    .from("astrology_library")
    .select("*")
    .eq("chart_key", chartKey)
    .single();

  if (fetchError || !stored) {
    throw new Error("Chart stored but failed to re-fetch from library");
  }

  return stored;
}

/**
 * Update access tracking for a chart (fire and forget)
 */
async function trackChartAccess(chartKey: string): Promise<void> {
  try {
    const supabase = createAdminSupabaseClient();
    await supabase
      .from("astrology_library")
      .update({
        last_accessed_at: new Date().toISOString(),
      })
      .eq("chart_key", chartKey);
  } catch (error) {
    // Silent failure - access tracking is not critical
    console.warn("[ChartsLibrary] Failed to track access:", error);
  }
}

/**
 * Compute official chart key from user profile
 *
 * Returns null if profile data is incomplete.
 * This is used to determine if user has an official chart.
 *
 * @param profile - User profile data
 * @returns chart_key if inputs complete, null otherwise
 */
export function computeOfficialChartKey(profile: {
  birth_date: string | null;
  birth_time: string | null;
  birth_lat: number | null;
  birth_lon: number | null;
  timezone: string | null;
}): string | null {
  // Check if all required fields present
  if (!isChartInputComplete({
    birth_date: profile.birth_date || undefined,
    birth_time: profile.birth_time || undefined,
    birth_lat: profile.birth_lat ?? undefined,
    birth_lon: profile.birth_lon ?? undefined,
    timezone: profile.timezone || undefined,
  })) {
    return null;
  }

  // Compute key
  try {
    return computeChartKey({
      birth_date: profile.birth_date!,
      birth_time: profile.birth_time!,
      birth_lat: profile.birth_lat!,
      birth_lon: profile.birth_lon!,
      timezone: profile.timezone!,
    });
  } catch (error) {
    console.error("[ChartsLibrary] Error computing official chart key:", error);
    return null;
  }
}

/**
 * Get user's official chart
 *
 * Workflow:
 * 1. Check if profile has official_astrology_key set
 * 2. If yes, fetch from library
 * 3. If no, check if Settings data is complete
 * 4. If complete, compute key and fetch/compute chart
 *
 * @param userId - User ID
 * @param profile - User profile
 * @returns Chart entry if user has complete Settings data, null otherwise
 */
export async function getOfficialChart(
  userId: string,
  profile: {
    birth_date: string | null;
    birth_time: string | null;
    birth_lat: number | null;
    birth_lon: number | null;
    timezone: string | null;
    official_astrology_key: string | null;
  }
): Promise<ChartLibraryEntry | null> {
  // If user already has official_astrology_key, use it
  if (profile.official_astrology_key) {
    const chart = await getChartFromLibrary(profile.official_astrology_key);
    if (chart) {
      return chart;
    }
    // Key exists but chart not found - recompute below
  }

  // Check if Settings data is complete
  const chartKey = computeOfficialChartKey(profile);
  if (!chartKey) {
    // Incomplete data - no official chart
    return null;
  }

  // Fetch or compute chart
  const chart = await getOrComputeChart({
    birth_date: profile.birth_date!,
    birth_time: profile.birth_time!,
    birth_lat: profile.birth_lat!,
    birth_lon: profile.birth_lon!,
    timezone: profile.timezone!,
  });

  // Update profile's official_astrology_key if needed
  if (profile.official_astrology_key !== chartKey) {
    const supabase = createAdminSupabaseClient();
    await supabase
      .from("profiles")
      .update({ official_astrology_key: chartKey })
      .eq("id", userId);
  }

  return chart;
}

// ============================================================================
// NARRATIVE HELPERS (Book = Math + Narrative)
// ============================================================================

/**
 * Check if chart has a valid narrative
 *
 * @param chart - Chart entry to check
 * @param language - Required language
 * @param promptVersion - Required prompt version (defaults to current)
 * @returns true if narrative exists and matches requirements
 */
export function hasValidNarrative(
  chart: ChartLibraryEntry,
  language: string,
  promptVersion: number = NARRATIVE_PROMPT_VERSION
): boolean {
  return (
    chart.narrative_json !== null &&
    chart.narrative_language === language &&
    chart.narrative_prompt_version === promptVersion
  );
}

/**
 * Store narrative for a chart in the library
 *
 * @param chartKey - Chart key to update
 * @param narrative - Generated narrative to store
 * @param language - Language of narrative
 * @param promptVersion - Prompt version used
 */
export async function storeChartNarrative(
  chartKey: string,
  narrative: FullBirthChartInsight,
  language: string,
  promptVersion: number = NARRATIVE_PROMPT_VERSION
): Promise<void> {
  const supabase = createAdminSupabaseClient();

  const { error } = await supabase
    .from("astrology_library")
    .update({
      narrative_json: narrative,
      narrative_prompt_version: promptVersion,
      narrative_language: language,
      narrative_generated_at: new Date().toISOString(),
    })
    .eq("chart_key", chartKey);

  if (error) {
    console.error("[ChartsLibrary] Error storing narrative:", error);
    throw new Error(`Failed to store narrative: ${error.message}`);
  }

  console.log(`[ChartsLibrary] Narrative stored for chart: ${chartKey} (lang: ${language}, v${promptVersion})`);
}

/**
 * Ensure chart has a narrative, generating if needed
 *
 * Lazy generation pattern:
 * 1. If narrative exists and matches language/version, return chart as-is
 * 2. If narrative missing or stale, generate and store
 * 3. Return updated chart
 *
 * @param chart - Chart entry
 * @param language - Required language
 * @param displayName - User's display name for personalization
 * @param profile - Optional profile data for generation context
 * @returns Chart with narrative (may be freshly generated)
 */
export async function ensureNarrative(
  chart: ChartLibraryEntry,
  language: string,
  displayName: string | null,
  profile?: {
    birth_date?: string;
    birth_time?: string | null;
    birth_city?: string | null;
    birth_region?: string | null;
    birth_country?: string | null;
    timezone?: string;
    zodiac_sign?: string | null;
  }
): Promise<ChartLibraryEntry> {
  // Check if narrative already valid
  if (hasValidNarrative(chart, language)) {
    console.log(`[ChartsLibrary] Narrative cache hit for ${chart.chart_key} (lang: ${language})`);
    return chart;
  }

  // Log reason for regeneration
  if (chart.narrative_json) {
    const reasons = [];
    if (chart.narrative_language !== language) {
      reasons.push(`language mismatch (stored: ${chart.narrative_language}, requested: ${language})`);
    }
    if (chart.narrative_prompt_version !== NARRATIVE_PROMPT_VERSION) {
      reasons.push(`prompt version mismatch (stored: ${chart.narrative_prompt_version}, current: ${NARRATIVE_PROMPT_VERSION})`);
    }
    console.log(`[ChartsLibrary] Narrative stale for ${chart.chart_key}: ${reasons.join(", ")}`);
  } else {
    console.log(`[ChartsLibrary] No narrative for ${chart.chart_key}, generating...`);
  }

  // Generate narrative
  const result = await generateCompleteNarrative(
    chart.geometry_json,
    language,
    displayName,
    profile
  );

  if (!result) {
    console.warn(`[ChartsLibrary] Failed to generate narrative for ${chart.chart_key}`);
    return chart; // Return chart without narrative
  }

  // Store narrative
  await storeChartNarrative(chart.chart_key, result.narrative, language);

  // Return updated chart
  return {
    ...chart,
    narrative_json: result.narrative,
    narrative_prompt_version: NARRATIVE_PROMPT_VERSION,
    narrative_language: language,
    narrative_generated_at: new Date().toISOString(),
  };
}

/**
 * Get chart with narrative
 *
 * Combines getOrComputeChart with ensureNarrative for complete Book retrieval.
 *
 * @param input - Birth input data
 * @param language - Required language
 * @param displayName - User's display name for personalization
 * @param profile - Optional profile data
 * @returns Chart with narrative (Book = Math + Narrative)
 */
export async function getChartWithNarrative(
  input: Partial<ChartInput>,
  language: string,
  displayName: string | null,
  profile?: {
    birth_date?: string;
    birth_time?: string | null;
    birth_city?: string | null;
    birth_region?: string | null;
    birth_country?: string | null;
    timezone?: string;
    zodiac_sign?: string | null;
  }
): Promise<ChartLibraryEntry> {
  // Get or compute chart (math)
  const chart = await getOrComputeChart(input);

  // Ensure narrative exists
  return ensureNarrative(chart, language, displayName, profile);
}

/**
 * Get official chart with narrative
 *
 * @param userId - User ID
 * @param profile - User profile with birth data
 * @param language - Required language
 * @returns Chart with narrative if user has complete Settings data, null otherwise
 */
export async function getOfficialChartWithNarrative(
  userId: string,
  profile: {
    birth_date: string | null;
    birth_time: string | null;
    birth_lat: number | null;
    birth_lon: number | null;
    timezone: string | null;
    birth_city?: string | null;
    birth_region?: string | null;
    birth_country?: string | null;
    zodiac_sign?: string | null;
    official_astrology_key: string | null;
    preferred_name?: string | null;
    full_name?: string | null;
  },
  language: string
): Promise<ChartLibraryEntry | null> {
  // Get official chart (math)
  const chart = await getOfficialChart(userId, profile);
  if (!chart) {
    return null;
  }

  const displayName = profile.preferred_name || profile.full_name || null;

  // Ensure narrative exists
  return ensureNarrative(chart, language, displayName, {
    birth_date: profile.birth_date || undefined,
    birth_time: profile.birth_time,
    birth_city: profile.birth_city,
    birth_region: profile.birth_region,
    birth_country: profile.birth_country,
    timezone: profile.timezone || undefined,
    zodiac_sign: profile.zodiac_sign,
  });
}
