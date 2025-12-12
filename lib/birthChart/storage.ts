/**
 * Birth chart storage and retrieval utilities for Solara.
 *
 * Core principles:
 * - Birth charts are computed ONCE when user completes onboarding
 * - Charts are RECOMPUTED only when user changes birth data in Settings
 * - Swiss Ephemeris placements are stored in Supabase (birth_chart_placements_json)
 * - Timestamp tracks when chart was last computed (birth_chart_computed_at)
 *
 * This ensures:
 * - No redundant ephemeris calculations on every request
 * - Consistent chart data across all features
 * - Can regenerate AI interpretations without recalculating placements
 */

import { computeSwissPlacements, type SwissPlacements } from "@/lib/ephemeris/swissEngine";
import type { Profile } from "@/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Birth chart schema version for cache invalidation
 * Increment this when placements structure changes (e.g., adding aspects, longitude, etc.)
 *
 * Version history:
 * - v1: Initial with basic placements
 * - v2: Added longitude, retrograde, aspects
 * - v3: Added derived summary (element balance, dominant signs/planets)
 * - v4: Added calculated features (South Node) + cusp/angle longitudes
 * - v5: Added chartType (day/night) + Part of Fortune to calculated
 * - v6: Added emphasis (houseEmphasis, signEmphasis, stelliums) to calculated
 * - v7: Added patterns (grand_trine, t_square) to calculated
 * - v8: Fixed patterns to exclude North Node, South Node, Chiron from vertices
 */
const BIRTH_CHART_SCHEMA_VERSION = 8;

export type BirthChartData = {
  placements: SwissPlacements;
  computedAt: string; // ISO timestamp
  schemaVersion: number; // Schema version for cache invalidation
};

/**
 * Compute Swiss Ephemeris placements for a user and store in database.
 *
 * @param userId - User's UUID
 * @param profile - User's profile with birth data
 * @returns Computed placements
 * @throws Error if birth data is incomplete or computation fails
 */
export async function computeAndStoreBirthChart(
  userId: string,
  profile: {
    birth_date: string;
    birth_time: string | null;
    birth_lat: number;
    birth_lon: number;
    timezone: string;
  }
): Promise<SwissPlacements> {
  console.log(`[BirthChart] Computing placements for user ${userId}`);

  // Validate required fields
  if (!profile.birth_date || !profile.birth_lat || !profile.birth_lon || !profile.timezone) {
    throw new Error("Incomplete birth data: missing date, location, or timezone");
  }

  // Use birth_time if available, otherwise default to noon
  const timeForSwiss = profile.birth_time || "12:00";

  // Compute Swiss Ephemeris placements
  const placements = await computeSwissPlacements({
    date: profile.birth_date,
    time: timeForSwiss,
    timezone: profile.timezone,
    lat: profile.birth_lat,
    lon: profile.birth_lon,
  });

  // Store in database with schema version for cache invalidation
  const computedAt = new Date().toISOString();

  try {
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase
      .from("profiles")
      .update({
        birth_chart_placements_json: {
          schemaVersion: BIRTH_CHART_SCHEMA_VERSION,
          ...placements,
        },
        birth_chart_computed_at: computedAt,
      })
      .eq("id", userId);

    if (error) {
      console.error(`[BirthChart] Failed to store placements for user ${userId}:`, error);
      throw new Error(`Failed to store birth chart: ${error.message}`);
    }

    console.log(`[BirthChart] ✓ Placements computed and stored for user ${userId}`);
  } catch (error: any) {
    console.error(`[BirthChart] Database error storing placements:`, error);
    throw error;
  }

  return placements;
}

/**
 * Load stored birth chart placements from database.
 *
 * @param userId - User's UUID
 * @returns Stored placements and computation timestamp, or null if not computed yet
 */
export async function loadStoredBirthChart(
  userId: string
): Promise<BirthChartData | null> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("profiles")
      .select("birth_chart_placements_json, birth_chart_computed_at")
      .eq("id", userId)
      .single();

    if (error) {
      console.error(`[BirthChart] Failed to load stored placements for user ${userId}:`, error);
      return null;
    }

    if (!data.birth_chart_placements_json || !data.birth_chart_computed_at) {
      console.log(`[BirthChart] No stored placements found for user ${userId}`);
      return null;
    }

    // Extract schema version (default to 0 if missing for old caches)
    const storedData = data.birth_chart_placements_json as any;
    const { schemaVersion = 0, ...placementsData } = storedData;

    return {
      placements: placementsData as SwissPlacements,
      computedAt: data.birth_chart_computed_at,
      schemaVersion,
    };
  } catch (error: any) {
    console.error(`[BirthChart] Error loading stored placements:`, error);
    return null;
  }
}

/**
 * Check if stored birth chart is still valid based on user's current birth data.
 *
 * Birth chart becomes invalid if user changes:
 * - Birth date
 * - Birth time
 * - Birth location (lat/lon)
 * - Timezone
 *
 * @param storedChart - Stored chart data from database
 * @param currentProfile - User's current profile
 * @returns Whether stored chart matches current birth data
 */
export function isStoredChartValid(
  storedChart: BirthChartData | null,
  currentProfile: Profile
): boolean {
  if (!storedChart) return false;

  // Check 1: Schema version must match current version
  // Old caches (before schema versioning) will have schemaVersion = 0
  if (storedChart.schemaVersion < BIRTH_CHART_SCHEMA_VERSION) {
    console.log(
      `[BirthChart] Schema version outdated (stored: ${storedChart.schemaVersion}, current: ${BIRTH_CHART_SCHEMA_VERSION}), regenerating chart`
    );
    return false;
  }

  // Check 2: Profile must not have been updated after chart was computed
  // This catches changes to birth data (date, time, location, timezone)
  const chartDate = new Date(storedChart.computedAt);
  const profileDate = new Date(currentProfile.updated_at);

  if (profileDate > chartDate) {
    console.log(
      `[BirthChart] Profile updated after chart computation (profile: ${currentProfile.updated_at}, chart: ${storedChart.computedAt}), may need regeneration`
    );
    return false;
  }

  return true;
}

/**
 * Get or compute birth chart placements for a user.
 *
 * Workflow:
 * 1. Try to load stored chart from database
 * 2. If found and valid, return it
 * 3. If not found or invalid, compute fresh and store
 *
 * @param userId - User's UUID
 * @param profile - User's profile
 * @returns Birth chart placements
 */
export async function getOrComputeBirthChart(
  userId: string,
  profile: Profile
): Promise<SwissPlacements> {
  // Try to load stored chart
  const storedChart = await loadStoredBirthChart(userId);

  if (storedChart && isStoredChartValid(storedChart, profile)) {
    console.log(`[BirthChart] Using stored placements for user ${userId}`);
    return storedChart.placements;
  }

  // No stored chart or invalid - compute fresh
  console.log(`[BirthChart] Computing fresh placements for user ${userId}`);

  return await computeAndStoreBirthChart(userId, {
    birth_date: profile.birth_date!,
    birth_time: profile.birth_time,
    birth_lat: profile.birth_lat!,
    birth_lon: profile.birth_lon!,
    timezone: profile.timezone!,
  });
}
