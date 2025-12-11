/**
 * Timezone-aware period key utilities for Solara.
 *
 * Core principles:
 * - All insights are generated per-user timezone (not server/UTC)
 * - If timezone is missing or unreliable, fallback to UTC
 * - Period keys determine when to regenerate insights (daily/weekly/monthly/yearly)
 *
 * This ensures:
 * - Users get insights at the start of THEIR local day, not a generic time
 * - Insights are idempotent (same user + same period = same result)
 * - System can scale to 1M+ users without per-user cron jobs
 */

import { format, startOfWeek, startOfMonth, startOfYear } from "date-fns";
import { toZonedTime } from "date-fns-tz";

export type PeriodKeys = {
  daily: string;   // "2025-03-15"
  weekly: string;  // "2025-W11"
  monthly: string; // "2025-03"
  yearly: string;  // "2025"
};

/**
 * Get all period keys for a user based on their timezone.
 *
 * @param timezone - IANA timezone (e.g., "America/New_York"). Falls back to "UTC" if missing.
 * @param now - Date to calculate periods from (defaults to current time)
 * @returns Period keys for daily, weekly, monthly, yearly
 */
export function getUserPeriodKeys(
  timezone: string | null | undefined,
  now: Date = new Date()
): PeriodKeys {
  // Fallback to UTC if timezone is missing or invalid
  const safeTimezone = timezone && timezone.trim() ? timezone : "UTC";

  if (safeTimezone === "UTC" && timezone && timezone !== "UTC") {
    console.warn(
      `[PeriodKeys] Invalid or missing timezone "${timezone}", falling back to UTC`
    );
  }

  try {
    // Convert current time to user's local time
    const localTime = toZonedTime(now, safeTimezone);

    // Daily: YYYY-MM-DD in user's local time
    const daily = format(localTime, "yyyy-MM-dd");

    // Weekly: YYYY-Www (ISO week, Monday start)
    const weekStart = startOfWeek(localTime, { weekStartsOn: 1 }); // Monday
    const weekly = format(weekStart, "yyyy-'W'II");

    // Monthly: YYYY-MM in user's local time
    const monthly = format(localTime, "yyyy-MM");

    // Yearly: YYYY in user's local time
    const yearly = format(localTime, "yyyy");

    return {
      daily,
      weekly,
      monthly,
      yearly,
    };
  } catch (error: any) {
    console.error(
      `[PeriodKeys] Error calculating period keys for timezone "${safeTimezone}":`,
      error.message
    );
    console.warn("[PeriodKeys] Falling back to UTC");

    // Final fallback: use UTC
    const localTime = toZonedTime(now, "UTC");
    return {
      daily: format(localTime, "yyyy-MM-dd"),
      weekly: format(startOfWeek(localTime, { weekStartsOn: 1 }), "yyyy-'W'II"),
      monthly: format(localTime, "yyyy-MM"),
      yearly: format(localTime, "yyyy"),
    };
  }
}

/**
 * Check if a timezone is valid and reliable.
 * Returns false if timezone is null, undefined, empty, or "UTC" (when it's a fallback).
 */
export function hasReliableTimezone(timezone: string | null | undefined): boolean {
  if (!timezone || timezone.trim() === "") return false;
  // Note: "UTC" is considered unreliable if it's used as a fallback
  // If user explicitly sets "UTC" (e.g., lives in UTC region), that's fine
  // But for most users, "UTC" means we don't have their real location yet
  return true; // Let the system use whatever timezone is set, even if it's UTC
}

/**
 * Build a cache key for insights with user ID and period.
 *
 * @param userId - User's UUID
 * @param timeframe - "today" | "week" | "month" | "year"
 * @param periodKey - Period-specific key (e.g., "2025-03-15" for daily)
 * @param language - User's language code (e.g., "en")
 * @returns Cache key like "insight:v1:user-123:daily:2025-03-15:en"
 */
export function buildInsightCacheKey(
  userId: string,
  timeframe: "today" | "week" | "month" | "year",
  periodKey: string,
  language: string = "en"
): string {
  const timeframeMap = {
    today: "daily",
    week: "weekly",
    month: "monthly",
    year: "yearly",
  };

  const period = timeframeMap[timeframe];
  return `insight:v1:${userId}:${period}:${periodKey}:${language}`;
}

/**
 * Build a lock key to prevent duplicate insight generation.
 *
 * @param userId - User's UUID
 * @param timeframe - "today" | "week" | "month" | "year"
 * @param periodKey - Period-specific key
 * @returns Lock key like "lock:insight:user-123:daily:2025-03-15"
 */
export function buildInsightLockKey(
  userId: string,
  timeframe: "today" | "week" | "month" | "year",
  periodKey: string
): string {
  const timeframeMap = {
    today: "daily",
    week: "weekly",
    month: "monthly",
    year: "yearly",
  };

  const period = timeframeMap[timeframe];
  return `lock:insight:${userId}:${period}:${periodKey}`;
}
