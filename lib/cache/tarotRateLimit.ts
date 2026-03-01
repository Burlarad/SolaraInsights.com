/**
 * Rate limiting for Tarot Arena (authenticated users only).
 *
 * Logged-in users (userId):
 * - 20 draws per hour
 * - 100 draws per day
 * - 10 second cooldown between draws
 */

import { checkRateLimit } from "./rateLimit";
import { getCache, setCache } from "@/lib/cache/redis";

// Cooldown: 10 seconds between draws
export const TAROT_COOLDOWN_SECONDS = 10;

// Authenticated user limits
const AUTH_HOURLY_LIMIT = 20;
const AUTH_DAILY_LIMIT = 100;

export interface TarotRateLimitResult {
  allowed: boolean;
  reason?: "cooldown" | "hourly_limit" | "daily_limit";
  retryAfterSeconds?: number;
  limits: {
    hourly: { used: number; limit: number };
    daily: { used: number; limit: number };
  };
}

/**
 * Check all tarot rate limits (cooldown, hourly, daily).
 * Requires an authenticated userId — unauthenticated requests must be
 * rejected with 401 before this is called.
 */
export async function checkTarotRateLimits(
  userId: string
): Promise<TarotRateLimitResult> {
  // ========================================
  // COOLDOWN CHECK (10 seconds)
  // ========================================
  const cooldownKey = `tarot:cooldown:${userId}`;
  const lastDrawTime = await getCache<number>(cooldownKey);

  if (lastDrawTime) {
    const elapsed = Math.floor((Date.now() - lastDrawTime) / 1000);
    const remaining = TAROT_COOLDOWN_SECONDS - elapsed;

    if (remaining > 0) {
      return {
        allowed: false,
        reason: "cooldown",
        retryAfterSeconds: remaining,
        limits: {
          hourly: { used: 0, limit: AUTH_HOURLY_LIMIT },
          daily: { used: 0, limit: AUTH_DAILY_LIMIT },
        },
      };
    }
  }

  // ========================================
  // HOURLY LIMIT
  // ========================================
  const hourlyResult = await checkRateLimit(
    `tarot:hourly:${userId}`,
    AUTH_HOURLY_LIMIT,
    3600
  );

  if (!hourlyResult.success) {
    const retryAfter = Math.ceil((hourlyResult.resetAt - Date.now()) / 1000);
    return {
      allowed: false,
      reason: "hourly_limit",
      retryAfterSeconds: retryAfter,
      limits: {
        hourly: { used: hourlyResult.count, limit: AUTH_HOURLY_LIMIT },
        daily: { used: 0, limit: AUTH_DAILY_LIMIT },
      },
    };
  }

  // ========================================
  // DAILY LIMIT
  // ========================================
  const dailyResult = await checkRateLimit(
    `tarot:daily:${userId}`,
    AUTH_DAILY_LIMIT,
    86400
  );

  if (!dailyResult.success) {
    const retryAfter = Math.ceil((dailyResult.resetAt - Date.now()) / 1000);
    return {
      allowed: false,
      reason: "daily_limit",
      retryAfterSeconds: retryAfter,
      limits: {
        hourly: { used: hourlyResult.count, limit: AUTH_HOURLY_LIMIT },
        daily: { used: dailyResult.count, limit: AUTH_DAILY_LIMIT },
      },
    };
  }

  // All checks passed — set cooldown for next request
  await setCache(cooldownKey, Date.now(), TAROT_COOLDOWN_SECONDS);

  return {
    allowed: true,
    limits: {
      hourly: { used: hourlyResult.count, limit: AUTH_HOURLY_LIMIT },
      daily: { used: dailyResult.count, limit: AUTH_DAILY_LIMIT },
    },
  };
}

/**
 * Generate rate limit headers for response.
 */
export function getTarotRateLimitHeaders(
  result: TarotRateLimitResult
): Record<string, string> {
  return {
    "X-RateLimit-Hourly-Limit": String(result.limits.hourly.limit),
    "X-RateLimit-Hourly-Used": String(result.limits.hourly.used),
    "X-RateLimit-Daily-Limit": String(result.limits.daily.limit),
    "X-RateLimit-Daily-Used": String(result.limits.daily.used),
  };
}
