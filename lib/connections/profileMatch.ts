/**
 * Profile matching utilities for connection linking
 *
 * Deterministic, silent matching:
 * - 0 matches → leave unlinked
 * - 1 match → set linked_profile_id
 * - 2+ matches → leave unlinked (do not reveal ambiguity)
 */

import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Normalize a string for matching:
 * - lowercase
 * - trim
 * - collapse whitespace
 * - strip punctuation
 */
export function normalizeForMatch(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "");
}

/**
 * Check if two normalized strings match
 */
export function normalizedMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeForMatch(a) === normalizeForMatch(b);
}

/**
 * Profile candidate from database
 */
interface ProfileCandidate {
  id: string;
  preferred_name: string | null;
  full_name: string | null;
  birth_date: string | null;
  birth_time: string | null;
  birth_city: string | null;
  birth_region: string | null;
  birth_country: string | null;
}

/**
 * Connection data for matching
 */
interface ConnectionMatchData {
  name: string;
  birth_date: string | null;
  birth_time: string | null;
  birth_city: string | null;
  birth_region: string | null;
  birth_country: string | null;
}

/**
 * Attempt to resolve a profile from connection data.
 *
 * Match criteria (ALL must match):
 * 1. Name matches preferred_name OR full_name (normalized)
 * 2. Birth date matches exactly
 * 3. Birth city matches (normalized)
 * 4. Birth country matches (normalized)
 * 5. Birth region matches if both provided (normalized), otherwise ignored
 * 6. Birth time used as tie-breaker only if multiple matches
 *
 * @param adminClient - Supabase admin client (bypasses RLS)
 * @param ownerId - The user creating the connection (excluded from matches)
 * @param connectionData - The connection data to match against
 * @returns The matched profile ID, or null if no unique match
 */
export async function resolveProfileFromConnection(
  adminClient: SupabaseClient,
  ownerId: string,
  connectionData: ConnectionMatchData
): Promise<string | null> {
  // Require minimum data for matching
  if (!connectionData.birth_date || !connectionData.birth_city || !connectionData.birth_country) {
    return null;
  }

  // Query profiles with matching birth date (exact match required)
  const { data: candidates, error } = await adminClient
    .from("profiles")
    .select("id, preferred_name, full_name, birth_date, birth_time, birth_city, birth_region, birth_country")
    .eq("birth_date", connectionData.birth_date)
    .neq("id", ownerId); // Exclude self

  if (error || !candidates || candidates.length === 0) {
    return null;
  }

  // Normalize connection data for comparison
  const normalizedName = normalizeForMatch(connectionData.name);
  const normalizedCity = normalizeForMatch(connectionData.birth_city);
  const normalizedRegion = normalizeForMatch(connectionData.birth_region);
  const normalizedCountry = normalizeForMatch(connectionData.birth_country);

  // Filter candidates by all criteria
  const matches = candidates.filter((profile: ProfileCandidate) => {
    // Name must match preferred_name OR full_name
    const nameMatches =
      normalizeForMatch(profile.preferred_name) === normalizedName ||
      normalizeForMatch(profile.full_name) === normalizedName;

    if (!nameMatches) return false;

    // City must match
    if (normalizeForMatch(profile.birth_city) !== normalizedCity) return false;

    // Country must match
    if (normalizeForMatch(profile.birth_country) !== normalizedCountry) return false;

    // Region: if both provided, must match; otherwise ignore
    if (normalizedRegion && profile.birth_region) {
      if (normalizeForMatch(profile.birth_region) !== normalizedRegion) return false;
    }

    return true;
  });

  // Outcomes based on match count
  if (matches.length === 0) {
    return null; // No match
  }

  if (matches.length === 1) {
    return matches[0].id; // Unique match
  }

  // Multiple matches - use birth_time as tie-breaker if available
  if (connectionData.birth_time) {
    const timeMatches = matches.filter(
      (p: ProfileCandidate) => p.birth_time === connectionData.birth_time
    );

    if (timeMatches.length === 1) {
      return timeMatches[0].id; // Birth time resolved ambiguity
    }
  }

  // Still ambiguous - do not link (don't reveal multiple accounts exist)
  return null;
}
