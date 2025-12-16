/**
 * Tiered rate limiting for Tarot Arena.
 *
 * Anonymous users (session cookie):
 * - 5 draws per hour
 * - 20 draws per day
 * - 10 second cooldown between draws
 *
 * Logged-in users (userId):
 * - 20 draws per hour
 * - 100 draws per day
 * - 10 second cooldown between draws
 */

import { NextRequest } from "next/server";
import { checkRateLimit, getClientIP } from "./rateLimit";
import { getCache, setCache } from "@/lib/cache";
import { cookies } from "next/headers";

// Cooldown: 10 seconds between draws
export const TAROT_COOLDOWN_SECONDS = 10;

// Anonymous limits
const ANON_HOURLY_LIMIT = 5;
const ANON_DAILY_LIMIT = 20;

// Logged-in limits
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
  isAuthenticated: boolean;
  sessionId: string;
  isNewSession: boolean;
}

/**
 * Get or create a session ID from cookies.
 * Returns the session ID and whether it's newly created (needs to be set in response).
 */
export async function getSessionId(): Promise<{
  sessionId: string;
  isNewSession: boolean;
}> {
  const cookieStore = await cookies();
  const existingSession = cookieStore.get("tarot_session")?.value;

  if (existingSession) {
    return { sessionId: existingSession, isNewSession: false };
  }

  // Generate a new session ID
  return { sessionId: crypto.randomUUID(), isNewSession: true };
}

/**
 * Check all tarot rate limits (cooldown, hourly, daily).
 *
 * @param req - The incoming request
 * @param userId - Optional user ID if authenticated
 * @returns Rate limit result
 */
export async function checkTarotRateLimits(
  req: NextRequest,
  userId?: string | null
): Promise<TarotRateLimitResult> {
  const clientIP = getClientIP(req);
  const { sessionId, isNewSession } = await getSessionId();
  const isAuthenticated = !!userId;

  // Use userId if available, otherwise session + IP combo
  const identifier = userId || `${sessionId}:${clientIP}`;

  // Choose limits based on auth status
  const hourlyLimit = isAuthenticated ? AUTH_HOURLY_LIMIT : ANON_HOURLY_LIMIT;
  const dailyLimit = isAuthenticated ? AUTH_DAILY_LIMIT : ANON_DAILY_LIMIT;

  // ========================================
  // COOLDOWN CHECK (10 seconds)
  // ========================================
  const cooldownKey = `tarot:cooldown:${identifier}`;
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
          hourly: { used: 0, limit: hourlyLimit },
          daily: { used: 0, limit: dailyLimit },
        },
        isAuthenticated,
        sessionId,
        isNewSession,
      };
    }
  }

  // ========================================
  // HOURLY LIMIT
  // ========================================
  const hourlyResult = await checkRateLimit(
    `tarot:hourly:${identifier}`,
    hourlyLimit,
    3600 // 1 hour
  );

  if (!hourlyResult.success) {
    const retryAfter = Math.ceil((hourlyResult.resetAt - Date.now()) / 1000);
    return {
      allowed: false,
      reason: "hourly_limit",
      retryAfterSeconds: retryAfter,
      limits: {
        hourly: { used: hourlyResult.count, limit: hourlyLimit },
        daily: { used: 0, limit: dailyLimit },
      },
      isAuthenticated,
      sessionId,
      isNewSession,
    };
  }

  // ========================================
  // DAILY LIMIT
  // ========================================
  const dailyResult = await checkRateLimit(
    `tarot:daily:${identifier}`,
    dailyLimit,
    86400 // 24 hours
  );

  if (!dailyResult.success) {
    const retryAfter = Math.ceil((dailyResult.resetAt - Date.now()) / 1000);
    return {
      allowed: false,
      reason: "daily_limit",
      retryAfterSeconds: retryAfter,
      limits: {
        hourly: { used: hourlyResult.count, limit: hourlyLimit },
        daily: { used: dailyResult.count, limit: dailyLimit },
      },
      isAuthenticated,
      sessionId,
      isNewSession,
    };
  }

  // All checks passed - set cooldown for next request
  await setCache(cooldownKey, Date.now(), TAROT_COOLDOWN_SECONDS);

  return {
    allowed: true,
    limits: {
      hourly: { used: hourlyResult.count, limit: hourlyLimit },
      daily: { used: dailyResult.count, limit: dailyLimit },
    },
    isAuthenticated,
    sessionId,
    isNewSession,
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
    "X-RateLimit-Authenticated": String(result.isAuthenticated),
  };
}
