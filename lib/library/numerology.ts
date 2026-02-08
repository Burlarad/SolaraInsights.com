/**
 * Global Numerology Library
 *
 * Manages the global deduplicated library of numerology profiles.
 *
 * Core Principles:
 * - Numerology profiles are stored once, referenced by deterministic numerology_key
 * - Multiple users with same name+birthdate share the same profile record
 * - Preview profiles are stored globally (not per-user)
 * - Official profiles come from Settings only
 */

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  computeNumerologyKey,
  normalizeNumerologyInput,
  isNumerologyInputComplete,
  NUMEROLOGY_CONFIG_VERSION,
  type NumerologyInput,
} from "./keyNormalization";

// Placeholder types - replace with actual numerology computation types
export type NumerologyProfile = {
  lifePathNumber: number;
  expressionNumber: number;
  soulUrgeNumber: number;
  personalityNumber: number;
  birthdayNumber: number;
  // Add other numerology calculations as needed
};

export type NumerologyLibraryEntry = {
  numerology_key: string;
  input_json: NumerologyInput;
  numerology_json: NumerologyProfile;
  config_version: number;
  created_at: string;
  last_accessed_at: string;
  access_count: number;
};

/**
 * Get numerology profile from global library by key
 */
export async function getNumerologyFromLibrary(
  numerologyKey: string
): Promise<NumerologyLibraryEntry | null> {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("numerology_library")
    .select(
      "numerology_key, input_json, numerology_json, config_version, created_at, last_accessed_at, access_count"
    )
    .eq("numerology_key", numerologyKey)
    .maybeSingle();

  if (error) {
    console.error("[NumerologyLibrary] Error fetching profile:", error);

    // PostgREST schema cache lag or column mismatch → treat as cache miss
    if ((error as any).code === "PGRST204" || (error as any).code === "42703") {
      return null;
    }

    return null;
  }

  if (data) {
    // Update access tracking (fire and forget)
    void trackNumerologyAccess(numerologyKey);
  }

  return data ?? null;
}

/**
 * Compute numerology profile from inputs
 *
 * TODO: Implement actual Pythagorean numerology calculations
 * This is a placeholder - replace with real numerology engine
 */
async function computeNumerologyProfile(
  input: NumerologyInput
): Promise<NumerologyProfile> {
  // Placeholder implementation
  // Real implementation should calculate:
  // - Life Path Number (from birth date)
  // - Expression Number (from full name)
  // - Soul Urge Number (from vowels in name)
  // - Personality Number (from consonants in name)
  // - Birthday Number (from day of month)

  const birthDate = new Date(input.birth_date);
  const day = birthDate.getDate();

  // Simple placeholder calculations (NOT accurate numerology)
  return {
    lifePathNumber: (day % 9) + 1,
    expressionNumber: (input.first_name.length % 9) + 1,
    soulUrgeNumber: (input.last_name.length % 9) + 1,
    personalityNumber: ((input.middle_name?.length || 0) % 9) + 1,
    birthdayNumber: day,
  };
}

/**
 * Get or compute numerology profile
 *
 * Workflow:
 * 1. Validate inputs are complete
 * 2. Normalize inputs
 * 3. Compute deterministic key
 * 4. Try to fetch from library
 * 5. If not found, compute and store
 */
export async function getOrComputeNumerology(
  input: Partial<NumerologyInput>
): Promise<NumerologyLibraryEntry> {
  // Validate inputs
  if (!isNumerologyInputComplete(input)) {
    throw new Error(
      "Incomplete numerology data: first_name, last_name, and birth_date required"
    );
  }

  // Normalize inputs
  const normalized = normalizeNumerologyInput(input);

  // Compute deterministic key
  const numerologyKey = computeNumerologyKey(normalized);

  // Try to fetch from library (global dedupe)
  const existing = await getNumerologyFromLibrary(numerologyKey);
  if (existing) {
    console.log(`[NumerologyLibrary] Found existing profile: ${numerologyKey}`);
    return existing;
  }

  // Not found - compute fresh
  console.log(`[NumerologyLibrary] Computing new profile: ${numerologyKey}`);
  const profile = await computeNumerologyProfile(normalized);

  // Store in library (idempotent)
  const supabase = createAdminSupabaseClient();

  const { error: upsertError } = await supabase
    .from("numerology_library")
    .upsert(
      {
        numerology_key: numerologyKey,
        input_json: normalized,
        numerology_json: profile,
        config_version: NUMEROLOGY_CONFIG_VERSION,
      },
      {
        onConflict: "numerology_key",
        ignoreDuplicates: true,
      }
    );

  if (upsertError) {
    console.error("[NumerologyLibrary] Error storing profile:", upsertError);

    // Duplicate key or schema cache lag → treat as cache hit
    if (
      (upsertError as any).code === "23505" ||
      (upsertError as any).code === "PGRST204"
    ) {
      const { data: existingRow, error: existingError } = await supabase
        .from("numerology_library")
        .select(
          "numerology_key, input_json, numerology_json, config_version, created_at, last_accessed_at, access_count"
        )
        .eq("numerology_key", numerologyKey)
        .single();

      if (!existingError && existingRow) {
        return existingRow as NumerologyLibraryEntry;
      }

      if (existingError) {
        console.error(
          "[NumerologyLibrary] Error fetching existing profile after upsert error:",
          existingError
        );
      }
    }

    throw new Error(`Failed to store numerology profile: ${upsertError.message}`);
  }

  console.log(`[NumerologyLibrary] ✓ Profile computed and stored: ${numerologyKey}`);

  const { data: stored, error: fetchError } = await supabase
    .from("numerology_library")
    .select(
      "numerology_key, input_json, numerology_json, config_version, created_at, last_accessed_at, access_count"
    )
    .eq("numerology_key", numerologyKey)
    .single();

  if (fetchError || !stored) {
    throw new Error("Numerology profile stored but failed to re-fetch from library");
  }

  return stored as NumerologyLibraryEntry;
}

/**
 * Update access tracking for a numerology profile (fire and forget)
 */
async function trackNumerologyAccess(numerologyKey: string): Promise<void> {
  try {
    const supabase = createAdminSupabaseClient();
    await supabase
      .from("numerology_library")
      .update({
        last_accessed_at: new Date().toISOString(),
        // NOTE: keep this simple and safe; do not attempt RPC math here
      })
      .eq("numerology_key", numerologyKey);
  } catch (error) {
    console.warn("[NumerologyLibrary] Failed to track access:", error);
  }
}

/**
 * Compute official numerology key from user profile
 *
 * Returns null if profile data is incomplete.
 */
export function computeOfficialNumerologyKey(profile: {
  full_name: string | null;
  birth_date: string | null;
}): string | null {
  if (!profile.full_name || !profile.birth_date) {
    return null;
  }

  // Parse full name into components
  // Assuming format: "First Middle Last" or "First Last"
  const nameParts = profile.full_name.trim().split(/\s+/);
  if (nameParts.length < 2) {
    return null; // Need at least first and last name
  }

  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  const middleName =
    nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : undefined;

  try {
    return computeNumerologyKey({
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      birth_date: profile.birth_date,
    });
  } catch (error) {
    console.error("[NumerologyLibrary] Error computing official numerology key:", error);
    return null;
  }
}

/**
 * Get user's official numerology profile
 */
export async function getOfficialNumerology(
  userId: string,
  profile: {
    full_name: string | null;
    birth_date: string | null;
    official_numerology_key: string | null;
  }
): Promise<NumerologyLibraryEntry | null> {
  // If user already has official_numerology_key, use it
  if (profile.official_numerology_key) {
    const numerology = await getNumerologyFromLibrary(profile.official_numerology_key);
    if (numerology) {
      return numerology;
    }
    // Key exists but profile not found - recompute below
  }

  // Check if Settings data is complete
  const numerologyKey = computeOfficialNumerologyKey(profile);
  if (!numerologyKey) {
    // Incomplete data - no official numerology
    return null;
  }

  // Parse name components
  const nameParts = profile.full_name!.trim().split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts[nameParts.length - 1];
  const middleName =
    nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : undefined;

  // Fetch or compute numerology
  const numerology = await getOrComputeNumerology({
    first_name: firstName,
    middle_name: middleName,
    last_name: lastName,
    birth_date: profile.birth_date!,
  });

  // Update profile's official_numerology_key if needed
  if (profile.official_numerology_key !== numerologyKey) {
    const supabase = createAdminSupabaseClient();
    await supabase
      .from("profiles")
      .update({ official_numerology_key: numerologyKey })
      .eq("id", userId);
  }

  return numerology;
}
