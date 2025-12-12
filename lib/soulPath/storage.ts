/**
 * Soul Path storage and retrieval utilities for Solara.
 *
 * This module manages Soul Path data in the dedicated soul_paths table,
 * decoupled from profiles for scalability at 1M DAU.
 *
 * Core principles:
 * - Soul Paths are computed ONCE when user completes onboarding
 * - Soul Paths are RECOMPUTED only when:
 *   1. User changes birth data (detected via birth_input_hash)
 *   2. Schema version bumps (automatic invalidation)
 * - All access is server-side only (soul_paths has RLS with NO user policies)
 * - Full Soul Path data stored in JSONB (~15-25KB per user)
 *
 * This ensures:
 * - No redundant ephemeris calculations on every request
 * - Consistent Soul Path data across all features
 * - Can regenerate AI interpretations without recalculating placements
 */

import { createHash } from "crypto";
import { computeSwissPlacements, type SwissPlacements } from "@/lib/ephemeris/swissEngine";
import type { Profile } from "@/types";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * Soul Path schema version for cache invalidation
 * Increment this when placements structure changes (e.g., adding aspects, longitude, etc.)
 *
 * Version history matches BIRTH_CHART_SCHEMA_VERSION:
 * - v1: Initial with basic placements
 * - v2: Added longitude, retrograde, aspects
 * - v3: Added derived summary (element balance, dominant signs/planets)
 * - v4: Added calculated features (South Node) + cusp/angle longitudes
 * - v5: Added chartType (day/night) + Part of Fortune to calculated
 * - v6: Added emphasis (houseEmphasis, signEmphasis, stelliums) to calculated
 * - v7: Added patterns (grand_trine, t_square) to calculated
 * - v8: Fixed patterns to exclude North Node, South Node, Chiron from vertices
 */
const SOUL_PATH_SCHEMA_VERSION = 8;

export type SoulPathData = {
  placements: SwissPlacements;
  computedAt: string; // ISO timestamp
  schemaVersion: number; // Schema version for cache invalidation
  birthInputHash: string; // SHA-256 hash of birth input data
};

/**
 * Compute SHA-256 hash of birth input data
 * Used to detect when birth data changes, triggering Soul Path recomputation
 *
 * Hash inputs:
 * - birth_date
 * - birth_time
 * - birth_lat
 * - birth_lon
 * - timezone
 *
 * More precise than comparing profile.updated_at (which changes on any profile update)
 *
 * @param profile - User profile with birth data
 * @returns SHA-256 hash as hex string
 */
export function computeBirthInputHash(profile: {
  birth_date: string | null;
  birth_time: string | null;
  birth_lat: number | null;
  birth_lon: number | null;
  timezone: string | null;
}): string {
  // Concatenate birth input fields, converting nulls to empty strings
  const input = [
    profile.birth_date || "",
    profile.birth_time || "",
    profile.birth_lat?.toString() || "",
    profile.birth_lon?.toString() || "",
    profile.timezone || "",
  ].join("");

  // Compute SHA-256 hash
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Load stored Soul Path from database (soul_paths table)
 *
 * @param userId - User's UUID
 * @returns Stored Soul Path data, or null if not found
 */
async function loadStoredSoulPath(userId: string): Promise<SoulPathData | null> {
  try {
    const supabase = createAdminSupabaseClient();

    const { data, error } = await supabase
      .from("soul_paths")
      .select("schema_version, computed_at, birth_input_hash, soul_path_json")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.log(`[SoulPath] No stored Soul Path found for user ${userId}:`, error.message);
      return null;
    }

    if (!data) {
      console.log(`[SoulPath] No stored Soul Path found for user ${userId}`);
      return null;
    }

    if (!data.soul_path_json) {
      console.log(`[SoulPath] Soul Path data missing for user ${userId}`);
      return null;
    }

    return {
      placements: data.soul_path_json as SwissPlacements,
      computedAt: data.computed_at,
      schemaVersion: data.schema_version,
      birthInputHash: data.birth_input_hash,
    };
  } catch (error: any) {
    console.error(`[SoulPath] Error loading stored Soul Path:`, error);
    return null;
  }
}

/**
 * Check if stored Soul Path is still valid
 *
 * Soul Path becomes invalid if:
 * 1. Schema version is outdated (automatic invalidation)
 * 2. Birth input hash doesn't match (birth data changed)
 *
 * @param storedSoulPath - Stored Soul Path data from database
 * @param currentHash - Current birth input hash
 * @returns Whether stored Soul Path is valid
 */
function isStoredSoulPathValid(
  storedSoulPath: SoulPathData | null,
  currentHash: string
): boolean {
  if (!storedSoulPath) return false;

  // Check 1: Schema version must match current version
  if (storedSoulPath.schemaVersion < SOUL_PATH_SCHEMA_VERSION) {
    console.log(
      `[SoulPath] Schema version outdated (stored: ${storedSoulPath.schemaVersion}, current: ${SOUL_PATH_SCHEMA_VERSION}), regenerating Soul Path`
    );
    return false;
  }

  // Check 2: Birth input hash must match
  if (storedSoulPath.birthInputHash !== currentHash) {
    console.log(
      `[SoulPath] Birth input hash mismatch (birth data changed), regenerating Soul Path`
    );
    return false;
  }

  return true;
}

/**
 * Compute and store a new Soul Path
 *
 * @param userId - User's UUID
 * @param profile - User profile with birth data
 * @returns Computed Soul Path placements
 */
async function computeAndStoreSoulPath(
  userId: string,
  profile: {
    birth_date: string;
    birth_time: string | null;
    birth_lat: number;
    birth_lon: number;
    timezone: string;
  }
): Promise<SwissPlacements> {
  console.log(`[SoulPath] Computing Soul Path for user ${userId}`);

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

  // Compute birth input hash
  const birthInputHash = computeBirthInputHash(profile);

  // Store in soul_paths table (UPSERT on user_id)
  const computedAt = new Date().toISOString();

  try {
    const supabase = createAdminSupabaseClient();

    const { error } = await supabase
      .from("soul_paths")
      .upsert(
        {
          user_id: userId,
          schema_version: SOUL_PATH_SCHEMA_VERSION,
          computed_at: computedAt,
          birth_input_hash: birthInputHash,
          soul_path_json: placements,
        },
        {
          onConflict: "user_id",
        }
      );

    if (error) {
      console.error(`[SoulPath] Failed to store Soul Path for user ${userId}:`, error);
      throw new Error(`Failed to store Soul Path: ${error.message}`);
    }

    console.log(`[SoulPath] ✓ Soul Path computed and stored for user ${userId}`);
  } catch (error: any) {
    console.error(`[SoulPath] Database error storing Soul Path:`, error);
    throw error;
  }

  return placements;
}

/**
 * Get current Soul Path for a user
 *
 * This is the main entry point for accessing Soul Path data.
 * Uses cached Soul Path from soul_paths table if valid,
 * otherwise computes fresh and stores.
 *
 * Workflow:
 * 1. Validate required birth data fields
 * 2. Compute current birth input hash
 * 3. Try to load stored Soul Path from database
 * 4. If found and valid (schema version + birth hash match), return it
 * 5. If not found or invalid, compute fresh and store
 *
 * @param userId - User's UUID
 * @param profile - User's profile with birth data
 * @returns Soul Path placements
 * @throws Error if birth data is incomplete or computation fails
 */
export async function getCurrentSoulPath(
  userId: string,
  profile: Profile
): Promise<SwissPlacements> {
  // Validate required birth data fields
  if (!profile.birth_date || !profile.birth_lat || !profile.birth_lon || !profile.timezone) {
    throw new Error("Incomplete birth data: missing date, location, or timezone");
  }

  // Compute current birth input hash
  const currentHash = computeBirthInputHash(profile);

  // Try to load stored Soul Path
  const storedSoulPath = await loadStoredSoulPath(userId);

  if (storedSoulPath && isStoredSoulPathValid(storedSoulPath, currentHash)) {
    console.log(`[SoulPath] Using stored Soul Path for user ${userId}`);
    return storedSoulPath.placements;
  }

  // No stored Soul Path or invalid - compute fresh
  console.log(`[SoulPath] Computing fresh Soul Path for user ${userId}`);

  return await computeAndStoreSoulPath(userId, {
    birth_date: profile.birth_date,
    birth_time: profile.birth_time,
    birth_lat: profile.birth_lat,
    birth_lon: profile.birth_lon,
    timezone: profile.timezone,
  });
}
