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
 * - Book = Math (numerology_json) + Narrative (narrative_json)
 */

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  computeNumerologyKey,
  normalizeNumerologyInput,
  isNumerologyInputComplete,
  NUMEROLOGY_CONFIG_VERSION,
  type NumerologyInput,
} from "./keyNormalization";
import {
  computeNumerologyProfile as computeMath,
  type NumerologyComputeResult,
} from "@/lib/numerology/index";
import type { NumerologyNarrative } from "./numerologyNarrative";

// ============================================================================
// TYPES
// ============================================================================

/** Full select columns for library queries */
const LIBRARY_SELECT_COLUMNS =
  "numerology_key, input_json, numerology_json, config_version, system, narrative_json, narrative_prompt_version, narrative_language, narrative_generated_at, created_at, last_accessed_at, access_count";

export type NumerologyLibraryEntry = {
  numerology_key: string;
  input_json: NumerologyInput;
  numerology_json: NumerologyComputeResult;
  config_version: number;
  system: string;
  narrative_json: NumerologyNarrative | null;
  narrative_prompt_version: number | null;
  narrative_language: string | null;
  narrative_generated_at: string | null;
  created_at: string;
  last_accessed_at: string;
  access_count: number;
};

// ============================================================================
// LIBRARY CRUD
// ============================================================================

/**
 * Get numerology profile from global library by key
 */
export async function getNumerologyFromLibrary(
  numerologyKey: string
): Promise<NumerologyLibraryEntry | null> {
  const supabase = createAdminSupabaseClient();

  const { data, error } = await supabase
    .from("numerology_library")
    .select(LIBRARY_SELECT_COLUMNS)
    .eq("numerology_key", numerologyKey)
    .maybeSingle();

  if (error) {
    console.error("[NumerologyLibrary] Error fetching profile:", error);
    if ((error as any).code === "PGRST204" || (error as any).code === "42703") {
      return null;
    }
    return null;
  }

  if (data) {
    void trackNumerologyAccess(numerologyKey);
  }

  return (data as NumerologyLibraryEntry) ?? null;
}

/**
 * Get or compute numerology profile in the global library.
 *
 * Workflow:
 * 1. Validate inputs are complete
 * 2. Normalize inputs
 * 3. Compute deterministic key
 * 4. Try to fetch from library
 * 5. If not found, compute via real math engine and store
 */
export async function getOrComputeNumerology(
  input: Partial<NumerologyInput>,
  system: string = "pythagorean"
): Promise<NumerologyLibraryEntry> {
  if (!isNumerologyInputComplete(input)) {
    throw new Error(
      "Incomplete numerology data: first_name, last_name, and birth_date required"
    );
  }

  const normalized = normalizeNumerologyInput(input);
  const numerologyKey = computeNumerologyKey(normalized);

  // Try library cache first
  const existing = await getNumerologyFromLibrary(numerologyKey);
  if (existing) {
    console.log(`[NumerologyLibrary] Found existing profile: ${numerologyKey}`);
    return existing;
  }

  // Compute fresh using the real math engine
  console.log(`[NumerologyLibrary] Computing new profile: ${numerologyKey}`);
  const mathResult = computeMath({
    birthDate: normalized.birth_date,
    birthFirstName: normalized.first_name,
    birthMiddleName: normalized.middle_name,
    birthLastName: normalized.last_name,
    system: system as "pythagorean" | "chaldean",
  });

  // Store in library (admin client, idempotent)
  const supabase = createAdminSupabaseClient();

  const { error: upsertError } = await supabase
    .from("numerology_library")
    .upsert(
      {
        numerology_key: numerologyKey,
        input_json: normalized,
        numerology_json: mathResult,
        config_version: NUMEROLOGY_CONFIG_VERSION,
        system,
      },
      {
        onConflict: "numerology_key",
        ignoreDuplicates: true,
      }
    );

  if (upsertError) {
    console.error("[NumerologyLibrary] Error storing profile:", upsertError);

    if (
      (upsertError as any).code === "23505" ||
      (upsertError as any).code === "PGRST204"
    ) {
      const { data: existingRow, error: existingError } = await supabase
        .from("numerology_library")
        .select(LIBRARY_SELECT_COLUMNS)
        .eq("numerology_key", numerologyKey)
        .single();

      if (!existingError && existingRow) {
        return existingRow as NumerologyLibraryEntry;
      }
    }

    throw new Error(`Failed to store numerology profile: ${upsertError.message}`);
  }

  console.log(`[NumerologyLibrary] Profile computed and stored: ${numerologyKey}`);

  const { data: stored, error: fetchError } = await supabase
    .from("numerology_library")
    .select(LIBRARY_SELECT_COLUMNS)
    .eq("numerology_key", numerologyKey)
    .single();

  if (fetchError || !stored) {
    throw new Error("Numerology profile stored but failed to re-fetch from library");
  }

  return stored as NumerologyLibraryEntry;
}

// ============================================================================
// ACCESS TRACKING
// ============================================================================

async function trackNumerologyAccess(numerologyKey: string): Promise<void> {
  try {
    const supabase = createAdminSupabaseClient();
    await supabase
      .from("numerology_library")
      .update({ last_accessed_at: new Date().toISOString() })
      .eq("numerology_key", numerologyKey);
  } catch (error) {
    console.warn("[NumerologyLibrary] Failed to track access:", error);
  }
}

// ============================================================================
// OFFICIAL KEY HELPERS
// ============================================================================

/**
 * Compute official numerology key from user profile.
 * Returns null if profile data is incomplete.
 */
export function computeOfficialNumerologyKey(profile: {
  full_name: string | null;
  birth_date: string | null;
}): string | null {
  if (!profile.full_name || !profile.birth_date) {
    return null;
  }

  const nameParts = profile.full_name.trim().split(/\s+/);
  if (nameParts.length < 2) {
    return null;
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
 * Parse full_name into name components
 */
export function parseFullName(fullName: string): {
  firstName: string;
  middleName: string | undefined;
  lastName: string;
} {
  const nameParts = fullName.trim().split(/\s+/);
  return {
    firstName: nameParts[0],
    lastName: nameParts[nameParts.length - 1],
    middleName: nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : undefined,
  };
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
  },
  system: string = "pythagorean"
): Promise<NumerologyLibraryEntry | null> {
  if (profile.official_numerology_key) {
    const numerology = await getNumerologyFromLibrary(profile.official_numerology_key);
    if (numerology) {
      return numerology;
    }
  }

  const numerologyKey = computeOfficialNumerologyKey(profile);
  if (!numerologyKey) {
    return null;
  }

  const { firstName, middleName, lastName } = parseFullName(profile.full_name!);

  const numerology = await getOrComputeNumerology(
    {
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
      birth_date: profile.birth_date!,
    },
    system
  );

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
