/**
 * Redis-backed helpers for free-tier usage tracking.
 *
 * These are best-effort: if Redis is unavailable the check returns false
 * (permit) so the user is not incorrectly blocked. The underlying insight
 * cache also acts as an implicit gate—if the insight is cached the route
 * returns it without touching this layer.
 */
import { getCache, setCache } from "@/lib/cache/redis";

// ── Daily Insight ─────────────────────────────────────────────────────────────

/**
 * Returns the UTC calendar date (YYYY-MM-DD) used as the free-limit key.
 * UTC is acceptable for v1; per-timezone enforcement is a Phase 3 concern.
 */
function todayUtc(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Returns true if a free user has already triggered a new insight generation
 * today. Cache hits (already-generated insights) bypass this check in the
 * route before this function is ever called.
 *
 * Redis key: insights:free:gen:{userId}:{YYYY-MM-DD}
 * TTL: 25 hours (generous buffer for UTC vs local time edge cases)
 */
export async function hasFreeInsightBeenUsedToday(userId: string): Promise<boolean> {
  try {
    const key = `insights:free:gen:${userId}:${todayUtc()}`;
    const used = await getCache<boolean>(key);
    return used === true;
  } catch {
    // Redis unavailable — permit (fail open for free limit, not security-critical)
    return false;
  }
}

/**
 * Marks that the free user has consumed their daily insight generation.
 * Call this AFTER the insight has been successfully generated and cached.
 *
 * Fire-and-forget: `void markFreeInsightUsed(userId)`.
 */
export async function markFreeInsightUsed(userId: string): Promise<void> {
  try {
    const key = `insights:free:gen:${userId}:${todayUtc()}`;
    await setCache(key, true, 25 * 3600); // 25-hour TTL
  } catch {
    // Redis unavailable — non-fatal
  }
}
