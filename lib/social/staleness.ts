/**
 * Social Sync Staleness Detection
 *
 * Determines if a user's social data needs refreshing based on their timezone.
 * Used by the Sanctuary insights route to trigger fire-and-forget sync.
 */

import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { acquireLock, releaseLock } from "@/lib/cache/redis";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Get today's local date string for a user's timezone.
 *
 * @param timezone - IANA timezone (e.g., "America/New_York")
 * @returns Local date as "YYYY-MM-DD"
 */
export function getTodayLocalDate(timezone: string): string {
  const safeTimezone = timezone && timezone.trim() ? timezone : "UTC";

  try {
    const localTime = toZonedTime(new Date(), safeTimezone);
    return format(localTime, "yyyy-MM-dd");
  } catch (error) {
    console.warn(`[SocialStaleness] Invalid timezone "${timezone}", using UTC`);
    return format(new Date(), "yyyy-MM-dd");
  }
}

/**
 * Check if a user's social data is stale and needs syncing.
 *
 * A user is considered stale if:
 * 1. They have at least one connected social account (in social_accounts)
 * 2. Their last_social_sync_local_date is not today's local date
 *
 * @param userId - User's UUID
 * @param timezone - User's IANA timezone
 * @param lastSocialSyncLocalDate - From profile.last_social_sync_local_date
 * @param supabase - Supabase client (service role) for checking social accounts
 * @returns true if user needs sync, false otherwise
 */
export async function isUserSocialStale(
  userId: string,
  timezone: string,
  lastSocialSyncLocalDate: string | null,
  supabase: SupabaseClient
): Promise<boolean> {
  const todayLocal = getTodayLocalDate(timezone);

  // If already synced today, not stale
  if (lastSocialSyncLocalDate === todayLocal) {
    return false;
  }

  // Check if user has any connected social accounts
  const { count, error } = await supabase
    .from("social_accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("access_token", "is", null);

  if (error) {
    console.warn(`[SocialStaleness] Error checking accounts for ${userId}:`, error.message);
    return false; // Don't trigger sync on error
  }

  // No connected accounts = not stale (nothing to sync)
  if (!count || count === 0) {
    return false;
  }

  console.log(
    `[SocialStaleness] User ${userId} is stale: last_sync=${lastSocialSyncLocalDate}, today=${todayLocal}, accounts=${count}`
  );
  return true;
}

/**
 * Build a Redis lock key for social sync deduplication.
 *
 * @param userId - User's UUID
 * @returns Lock key for Redis
 */
export function buildSocialSyncLockKey(userId: string): string {
  return `lock:social-sync:${userId}`;
}

/**
 * Trigger a fire-and-forget social sync for a user.
 *
 * Uses Redis lock to prevent duplicate triggers within a window.
 * Does NOT wait for sync completion - just fires the request.
 * Fully wrapped in try/catch to prevent any unhandled promise rejections.
 *
 * @param userId - User's UUID
 * @param baseUrl - Base URL for the sync endpoint
 * @param cronSecret - CRON_SECRET for authorization (optional for self-sync)
 * @param cookieHeader - Cookie header to forward for session auth (optional)
 * @returns true if sync was triggered, false if skipped (locked or error)
 */
export async function triggerSocialSyncFireAndForget(
  userId: string,
  baseUrl: string,
  cronSecret?: string,
  cookieHeader?: string
): Promise<boolean> {
  const lockKey = buildSocialSyncLockKey(userId);

  try {
    // Try to acquire lock (10 minute TTL - gives sync time to complete)
    const lockAcquired = await acquireLock(lockKey, 600);

    if (!lockAcquired) {
      console.log(`[SocialStaleness] Sync already in progress for ${userId}, skipping`);
      return false;
    }

    console.log(`[SocialStaleness] Triggering fire-and-forget sync for ${userId}`);

    // Fire and forget - don't await the full response
    const syncUrl = `${baseUrl}/api/social/sync-user`;

    // Build headers based on auth mode
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (cronSecret) {
      // Server-to-server call with CRON_SECRET
      headers["Authorization"] = `Bearer ${cronSecret}`;
    }

    if (cookieHeader) {
      // Forward cookies for session auth
      headers["Cookie"] = cookieHeader;
    }

    // Fire the request - use .then/.catch to ensure no unhandled rejections
    fetch(syncUrl, {
      method: "POST",
      headers,
      body: cronSecret ? JSON.stringify({ userId }) : "{}",
    })
      .then(async (response) => {
        if (!response.ok) {
          const error = await response.text().catch(() => "unknown");
          console.error(`[SocialStaleness] Sync failed for ${userId}:`, error);
        } else {
          console.log(`[SocialStaleness] Sync completed for ${userId}`);
        }
      })
      .catch((error) => {
        console.error(`[SocialStaleness] Sync request failed for ${userId}:`, error?.message || error);
      })
      .finally(() => {
        // Release lock after sync completes (or fails) - wrapped in its own catch
        releaseLock(lockKey).catch((releaseErr) => {
          console.warn(`[SocialStaleness] Failed to release lock for ${userId}:`, releaseErr?.message || releaseErr);
        });
      });

    return true;
  } catch (error: any) {
    // Catch any synchronous errors (e.g., acquireLock throwing)
    console.error(`[SocialStaleness] Error triggering sync for ${userId}:`, error?.message || error);
    return false;
  }
}
