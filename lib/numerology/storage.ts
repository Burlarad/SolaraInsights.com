/**
 * Numerology Profile Storage
 *
 * Handles loading and storing numerology profiles in Supabase.
 * Implements "stone tablet" caching - profiles are computed once
 * and stored forever unless birth data changes.
 */

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type {
  NumerologySystem,
  NumerologyProfile,
  NumerologyProfileRow,
  CoreNumbers,
  Pinnacles,
  Challenges,
  LuckyNumbers,
  KarmicDebt,
  NumerologyNumber,
} from "@/types/numerology";
import type { Profile } from "@/types";
import { computeNumerologyProfile, NUMEROLOGY_PROMPT_VERSION } from "./index";

// ============================================================================
// DATABASE ROW <-> PROFILE CONVERSION
// ============================================================================

/**
 * Convert a database row to a NumerologyProfile object
 */
function rowToProfile(row: NumerologyProfileRow): NumerologyProfile {
  const coreNumbers: CoreNumbers = {
    lifePath: {
      value: row.life_path_number,
      master: row.life_path_master as 11 | 22 | 33 | undefined,
    },
    birthday: { value: row.birthday_number },
    expression: {
      value: row.expression_number,
      master: row.expression_master as 11 | 22 | 33 | undefined,
    },
    soulUrge: {
      value: row.soul_urge_number,
      master: row.soul_urge_master as 11 | 22 | 33 | undefined,
    },
    personality: {
      value: row.personality_number,
      master: row.personality_master as 11 | 22 | 33 | undefined,
    },
    maturity: {
      value: row.maturity_number,
      master: row.maturity_master as 11 | 22 | 33 | undefined,
    },
  };

  // Calculate pinnacle ages from Life Path
  const lp =
    row.life_path_number > 9
      ? row.life_path_number === 11
        ? 2
        : row.life_path_number === 22
          ? 4
          : 6
      : row.life_path_number;
  const firstEnd = row.pinnacle_1_end_age;
  const secondEnd = row.pinnacle_2_end_age;
  const thirdEnd = row.pinnacle_3_end_age;

  const pinnacles: Pinnacles = {
    first: { number: row.pinnacle_1, startAge: 0, endAge: firstEnd },
    second: { number: row.pinnacle_2, startAge: firstEnd, endAge: secondEnd },
    third: { number: row.pinnacle_3, startAge: secondEnd, endAge: thirdEnd },
    fourth: { number: row.pinnacle_4, startAge: thirdEnd, endAge: null },
  };

  const challenges: Challenges = {
    first: row.challenge_1,
    second: row.challenge_2,
    third: row.challenge_3,
    fourth: row.challenge_4,
  };

  // Reconstruct lucky numbers structure
  const luckyNumbers: LuckyNumbers = {
    primary: row.lucky_numbers[0] || row.life_path_number,
    secondary: row.lucky_numbers.slice(1),
    all: row.lucky_numbers,
  };

  const karmicDebt: KarmicDebt = {
    hasKarmicDebt: row.has_karmic_debt,
    numbers: (row.karmic_debt_numbers || []) as (13 | 14 | 16 | 19)[],
    sources: [], // Sources are not stored in DB, would need separate query
  };

  return {
    id: row.id,
    userId: row.user_id,
    system: row.system,
    input: {
      birthDate: row.birth_date,
      birthFirstName: row.birth_first_name,
      birthMiddleName: row.birth_middle_name || undefined,
      birthLastName: row.birth_last_name,
    },
    coreNumbers,
    pinnacles,
    challenges,
    luckyNumbers,
    karmicDebt,
    promptVersion: row.prompt_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Convert a NumerologyProfile to a database row for insertion/update
 */
function profileToRow(
  userId: string,
  profile: {
    system: NumerologySystem;
    input: {
      birthDate: string;
      birthFirstName: string;
      birthMiddleName?: string;
      birthLastName: string;
    };
    coreNumbers: CoreNumbers;
    pinnacles: Pinnacles;
    challenges: Challenges;
    luckyNumbers: LuckyNumbers;
    karmicDebt: KarmicDebt;
  }
): Omit<NumerologyProfileRow, "id" | "created_at" | "updated_at"> {
  return {
    user_id: userId,
    birth_date: profile.input.birthDate,
    birth_first_name: profile.input.birthFirstName,
    birth_middle_name: profile.input.birthMiddleName || null,
    birth_last_name: profile.input.birthLastName,
    system: profile.system,

    // Core numbers
    life_path_number: profile.coreNumbers.lifePath.value,
    life_path_master: profile.coreNumbers.lifePath.master || null,
    birthday_number: profile.coreNumbers.birthday.value,
    expression_number: profile.coreNumbers.expression.value,
    expression_master: profile.coreNumbers.expression.master || null,
    soul_urge_number: profile.coreNumbers.soulUrge.value,
    soul_urge_master: profile.coreNumbers.soulUrge.master || null,
    personality_number: profile.coreNumbers.personality.value,
    personality_master: profile.coreNumbers.personality.master || null,
    maturity_number: profile.coreNumbers.maturity.value,
    maturity_master: profile.coreNumbers.maturity.master || null,

    // Pinnacles
    pinnacle_1: profile.pinnacles.first.number,
    pinnacle_2: profile.pinnacles.second.number,
    pinnacle_3: profile.pinnacles.third.number,
    pinnacle_4: profile.pinnacles.fourth.number,
    pinnacle_1_end_age: profile.pinnacles.first.endAge,
    pinnacle_2_end_age: profile.pinnacles.second.endAge,
    pinnacle_3_end_age: profile.pinnacles.third.endAge,

    // Challenges
    challenge_1: profile.challenges.first,
    challenge_2: profile.challenges.second,
    challenge_3: profile.challenges.third,
    challenge_4: profile.challenges.fourth,

    // Lucky numbers
    lucky_numbers: profile.luckyNumbers.all,

    // Karmic debt
    has_karmic_debt: profile.karmicDebt.hasKarmicDebt,
    karmic_debt_numbers: profile.karmicDebt.numbers.length > 0 ? profile.karmicDebt.numbers : null,

    // Metadata
    prompt_version: NUMEROLOGY_PROMPT_VERSION,
  };
}

// ============================================================================
// CACHE VALIDATION
// ============================================================================

/**
 * Check if a cached numerology profile is still valid
 *
 * A profile is valid if:
 * - birth_date matches
 * - first_name matches (used for numerology calculations)
 * - middle_name matches
 * - last_name matches
 * - system matches
 * - prompt_version matches current version
 */
function isCacheValid(
  cached: NumerologyProfileRow,
  profile: Profile,
  system: NumerologySystem
): boolean {
  return (
    cached.birth_date === profile.birth_date &&
    cached.birth_first_name === profile.first_name &&
    cached.birth_middle_name === (profile.middle_name || null) &&
    cached.birth_last_name === profile.last_name &&
    cached.system === system &&
    cached.prompt_version === NUMEROLOGY_PROMPT_VERSION
  );
}

// ============================================================================
// MAIN STORAGE FUNCTIONS
// ============================================================================

/**
 * Get or compute a numerology profile for a user
 *
 * Stone tablet caching:
 * - If valid cache exists, return it immediately
 * - If cache is stale or missing, compute fresh and store
 *
 * @param userId - User's UUID
 * @param profile - User's profile with birth data
 * @param system - Numerology system to use (default: pythagorean)
 * @returns NumerologyProfile
 */
export async function getOrComputeNumerologyProfile(
  userId: string,
  profile: Profile,
  system: NumerologySystem = "pythagorean"
): Promise<NumerologyProfile> {
  const supabase = createAdminSupabaseClient();

  // Try to load cached profile
  const { data: cached, error: loadError } = await supabase
    .from("numerology_profiles")
    .select("*")
    .eq("user_id", userId)
    .eq("system", system)
    .maybeSingle();

  if (loadError) {
    console.error(`[Numerology] Error loading cached profile for user ${userId}:`, loadError);
  }

  // Check if cache is valid
  if (cached && isCacheValid(cached as NumerologyProfileRow, profile, system)) {
    console.log(`[Numerology] Cache hit for user ${userId} (system: ${system})`);
    return rowToProfile(cached as NumerologyProfileRow);
  }

  // Cache miss or stale - compute fresh
  console.log(
    `[Numerology] Cache ${cached ? "stale" : "miss"} for user ${userId} - computing fresh (system: ${system})`
  );

  // Compute numerology profile (using first_name/middle_name/last_name as birth name)
  const result = computeNumerologyProfile({
    birthDate: profile.birth_date!,
    birthFirstName: profile.first_name!,
    birthMiddleName: profile.middle_name || undefined,
    birthLastName: profile.last_name!,
    system,
  });

  // Build the profile object (using first_name/middle_name/last_name as birth name)
  const numerologyProfile = {
    system,
    input: {
      birthDate: profile.birth_date!,
      birthFirstName: profile.first_name!,
      birthMiddleName: profile.middle_name || undefined,
      birthLastName: profile.last_name!,
    },
    coreNumbers: result.coreNumbers,
    pinnacles: result.pinnacles,
    challenges: result.challenges,
    luckyNumbers: result.luckyNumbers,
    karmicDebt: result.karmicDebt,
  };

  // Convert to row format
  const row = profileToRow(userId, numerologyProfile);

  // Upsert the profile (insert or update if exists)
  const { data: upserted, error: upsertError } = await supabase
    .from("numerology_profiles")
    .upsert(row, {
      onConflict: "user_id,system",
    })
    .select()
    .single();

  if (upsertError) {
    console.error(`[Numerology] Error storing profile for user ${userId}:`, upsertError);
    // Return computed profile even if storage failed
    return {
      id: "temp-" + Date.now(),
      userId,
      ...numerologyProfile,
      promptVersion: NUMEROLOGY_PROMPT_VERSION,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  console.log(`[Numerology] Profile stored for user ${userId} (system: ${system})`);
  return rowToProfile(upserted as NumerologyProfileRow);
}

/**
 * Get just the lucky numbers for a user (for Insights tab integration)
 *
 * Optimized version that only returns lucky numbers, using cache if available.
 *
 * @param userId - User's UUID
 * @param profile - User's profile with birth data
 * @param system - Numerology system to use (default: pythagorean)
 * @returns Lucky numbers array
 */
export async function getLuckyNumbers(
  userId: string,
  profile: Profile,
  system: NumerologySystem = "pythagorean"
): Promise<LuckyNumbers> {
  // Use the full profile fetch (it's cached anyway)
  const numerologyProfile = await getOrComputeNumerologyProfile(userId, profile, system);
  return numerologyProfile.luckyNumbers;
}

/**
 * Delete numerology profiles for a user (for account deletion)
 */
export async function deleteNumerologyProfiles(userId: string): Promise<void> {
  const supabase = createAdminSupabaseClient();

  const { error } = await supabase.from("numerology_profiles").delete().eq("user_id", userId);

  if (error) {
    console.error(`[Numerology] Error deleting profiles for user ${userId}:`, error);
    throw error;
  }

  console.log(`[Numerology] Deleted all profiles for user ${userId}`);
}
