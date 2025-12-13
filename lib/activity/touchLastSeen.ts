import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Update user's last_seen_at timestamp if it's stale.
 *
 * This function updates profiles.last_seen_at only if:
 * - last_seen_at is null (first time seeing user), OR
 * - last_seen_at is older than (now - minMinutes)
 *
 * This prevents unnecessary database writes on every request while still
 * maintaining a reasonably fresh "last seen" timestamp for activity tracking.
 *
 * Errors are swallowed silently - this is a non-critical side effect that
 * should never break the main request flow.
 *
 * @param supabase - Supabase client (any type: server, admin, etc.)
 * @param userId - User's UUID
 * @param minMinutes - Minimum minutes between updates (default: 30)
 *
 * @example
 * // Update last_seen_at if it's been more than 30 minutes
 * await touchLastSeen(supabase, user.id);
 *
 * @example
 * // Update last_seen_at if it's been more than 5 minutes (more frequent tracking)
 * await touchLastSeen(supabase, user.id, 5);
 */
export async function touchLastSeen(
  supabase: SupabaseClient,
  userId: string,
  minMinutes: number = 30
): Promise<void> {
  try {
    // Calculate cutoff timestamp (now - minMinutes)
    const cutoffDate = new Date();
    cutoffDate.setMinutes(cutoffDate.getMinutes() - minMinutes);
    const cutoff = cutoffDate.toISOString();

    // Update only if last_seen_at is null or older than cutoff
    // Using .or() to combine conditions at database level (efficient)
    const { error } = await supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", userId)
      .or(`last_seen_at.is.null,last_seen_at.lt.${cutoff}`);

    if (error) {
      // Log but don't throw - this is a non-critical side effect
      console.warn(`[touchLastSeen] Failed to update last_seen_at for user ${userId}:`, error.message);
    }
  } catch (error: any) {
    // Swallow all errors - last_seen_at tracking should never break the main flow
    console.warn(`[touchLastSeen] Unexpected error for user ${userId}:`, error.message);
  }
}
