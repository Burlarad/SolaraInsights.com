/**
 * Rate limiting for social account connections.
 *
 * Prevents abuse of social sync which triggers OpenAI costs.
 * Limits: 5 social account connections per user per day.
 *
 * This protects against the reconnect exploit scenario where
 * an attacker connects/disconnects accounts to trigger unlimited
 * OpenAI summarization calls.
 */

import { checkRateLimit, RateLimitResult } from "@/lib/cache/rateLimit";

// Maximum social account connections per user per day
const DAILY_CONNECT_LIMIT = 5;

// Window: 24 hours in seconds
const DAILY_WINDOW_SECONDS = 86400;

export interface SocialRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  reason?: "daily_limit";
  retryAfterSeconds?: number;
}

/**
 * Check if a user can connect a social account.
 * Called before processing OAuth callback.
 *
 * @param userId - The authenticated user's ID
 * @returns Rate limit result
 */
export async function checkSocialConnectLimit(
  userId: string
): Promise<SocialRateLimitResult> {
  const key = `social:connect:${userId}`;

  const result = await checkRateLimit(key, DAILY_CONNECT_LIMIT, DAILY_WINDOW_SECONDS);

  if (!result.success) {
    const retryAfterSeconds = Math.ceil((result.resetAt - Date.now()) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: result.resetAt,
      reason: "daily_limit",
      retryAfterSeconds,
    };
  }

  return {
    allowed: true,
    remaining: result.remaining,
    resetAt: result.resetAt,
  };
}

/**
 * Get rate limit headers for social connect responses.
 */
export function getSocialConnectHeaders(
  result: SocialRateLimitResult
): Record<string, string> {
  return {
    "X-RateLimit-Social-Connect-Limit": String(DAILY_CONNECT_LIMIT),
    "X-RateLimit-Social-Connect-Remaining": String(result.remaining),
    "X-RateLimit-Social-Connect-Reset": String(result.resetAt),
  };
}

/**
 * Rate limit error message for users.
 */
export const SOCIAL_RATE_LIMIT_MESSAGE =
  "You've connected too many social accounts today. Please try again tomorrow.";
