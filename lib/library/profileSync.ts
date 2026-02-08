/**
 * Profile Sync for Library Book Model
 *
 * Manages synchronization between user profile and official library keys.
 *
 * CRITICAL: Settings is source of truth for official charts/numerology.
 * When profile is updated, official_*_key must be updated or cleared.
 */

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { computeOfficialChartKey } from "./charts";
import { computeOfficialNumerologyKey } from "./numerology";

export type ProfileBirthData = {
  birth_date: string | null;
  birth_time: string | null;
  birth_lat: number | null;
  birth_lon: number | null;
  timezone: string | null;
};

export type ProfileNameData = {
  full_name: string | null;
  birth_date: string | null;
};

/**
 * Update user's official_chart_key after profile birth data changes
 *
 * Called from Profile Update API after birth fields are updated.
 *
 * Behavior:
 * - If all birth fields present: compute and set official_chart_key
 * - If any birth field missing: clear official_chart_key
 *
 * @param userId - User ID
 * @param birthData - Updated birth data from profile
 */
export async function syncOfficialChartKey(
  userId: string,
  birthData: ProfileBirthData
): Promise<void> {
  const chartKey = computeOfficialChartKey(birthData);

  const supabase = createAdminSupabaseClient();

  if (chartKey) {
    // Settings data complete - set official chart key
    console.log(`[ProfileSync] Setting official_chart_key for user ${userId}: ${chartKey}`);
    await supabase
      .from("profiles")
      .update({ official_chart_key: chartKey })
      .eq("id", userId);
  } else {
    // Settings data incomplete - clear official chart key
    console.log(`[ProfileSync] Clearing official_chart_key for user ${userId} (incomplete data)`);
    await supabase
      .from("profiles")
      .update({ official_chart_key: null })
      .eq("id", userId);
  }
}

/**
 * Update user's official_numerology_key after profile name/birth date changes
 *
 * Called from Profile Update API after name or birth_date is updated.
 *
 * Behavior:
 * - If full_name and birth_date present: compute and set official_numerology_key
 * - If either missing: clear official_numerology_key
 */
export async function syncOfficialNumerologyKey(
  userId: string,
  nameData: ProfileNameData
): Promise<void> {
  const numerologyKey = computeOfficialNumerologyKey(nameData);

  const supabase = createAdminSupabaseClient();

  if (numerologyKey) {
    // Settings data complete - set official numerology key
    console.log(`[ProfileSync] Setting official_numerology_key for user ${userId}: ${numerologyKey}`);
    await supabase
      .from("profiles")
      .update({ official_numerology_key: numerologyKey })
      .eq("id", userId);
  } else {
    // Settings data incomplete - clear official numerology key
    console.log(`[ProfileSync] Clearing official_numerology_key for user ${userId} (incomplete data)`);
    await supabase
      .from("profiles")
      .update({ official_numerology_key: null })
      .eq("id", userId);
  }
}

/**
 * Full profile sync (both chart and numerology)
 *
 * Call this from Profile Update API after any profile changes.
 */
export async function syncOfficialKeys(userId: string, profile: ProfileBirthData & ProfileNameData): Promise<void> {
  await Promise.all([
    syncOfficialChartKey(userId, profile),
    syncOfficialNumerologyKey(userId, profile),
  ]);
}
