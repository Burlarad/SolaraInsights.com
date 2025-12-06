/**
 * Redis/Valkey caching layer for Solara.
 *
 * Caching is completely optional:
 * - If REDIS_URL is not set, all cache operations are no-ops
 * - If Redis connection fails, logs a warning and continues without caching
 * - The app will never crash due to cache unavailability
 */

import Redis from "ioredis";

// Singleton Redis client
let redis: Redis | null = null;
let redisInitialized = false;
let redisAvailable = false;

/**
 * Initialize Redis connection (lazy, on first cache call).
 */
function initRedis(): void {
  if (redisInitialized) return;
  redisInitialized = true;

  const redisUrl = process.env.REDIS_URL || process.env.VALKEY_URL;

  if (!redisUrl) {
    console.warn("[Cache] No REDIS_URL or VALKEY_URL found. Caching is disabled.");
    return;
  }

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    });

    redis.on("error", (err) => {
      console.error("[Cache] Redis error:", err.message);
      redisAvailable = false;
    });

    redis.on("connect", () => {
      console.log("[Cache] Redis connected successfully.");
      redisAvailable = true;
    });

    redis.on("ready", () => {
      redisAvailable = true;
    });
  } catch (error: any) {
    console.error("[Cache] Failed to initialize Redis:", error.message);
    redis = null;
  }
}

/**
 * Get a cached value by key.
 * Returns null if:
 * - Redis is unavailable
 * - Key doesn't exist
 * - Parse error occurs
 */
export async function getCache<T>(key: string): Promise<T | null> {
  initRedis();

  if (!redis || !redisAvailable) {
    return null;
  }

  try {
    const cached = await redis.get(key);
    if (!cached) return null;

    return JSON.parse(cached) as T;
  } catch (error: any) {
    console.error(`[Cache] Error reading key "${key}":`, error.message);
    return null;
  }
}

/**
 * Set a cached value with TTL (in seconds).
 * No-op if Redis is unavailable.
 */
export async function setCache<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  initRedis();

  if (!redis || !redisAvailable) {
    return; // Silent no-op
  }

  try {
    const serialized = JSON.stringify(value);
    await redis.setex(key, ttlSeconds, serialized);
  } catch (error: any) {
    console.error(`[Cache] Error setting key "${key}":`, error.message);
  }
}

// ========================================
// Period Key Helpers
// ========================================

/**
 * Convert a Date to a local date string in a given timezone.
 * Returns YYYY-MM-DD format.
 */
function toLocalDateString(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date); // "YYYY-MM-DD"
}

/**
 * Get the ISO week number (Monday start) for a date in a given timezone.
 * Returns "YYYY-Www" (e.g., "2025-W12").
 */
function toLocalWeekString(date: Date, timezone: string): string {
  // Get local year, month, day
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parseInt(parts.find((p) => p.type === "year")?.value || "0");
  const month = parseInt(parts.find((p) => p.type === "month")?.value || "0");
  const day = parseInt(parts.find((p) => p.type === "day")?.value || "0");

  // Reconstruct local date
  const localDate = new Date(year, month - 1, day);

  // ISO week calculation (Monday start)
  const startOfYear = new Date(year, 0, 1);
  const dayOfYear = Math.floor((localDate.getTime() - startOfYear.getTime()) / 86400000) + 1;
  const dayOfWeek = localDate.getDay() || 7; // 1 = Mon, 7 = Sun
  const weekNumber = Math.ceil((dayOfYear - dayOfWeek + 10) / 7);

  return `${year}-W${String(weekNumber).padStart(2, "0")}`;
}

/**
 * Get the local month string for a date in a given timezone.
 * Returns "YYYY-MM" (e.g., "2025-03").
 */
function toLocalMonthString(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  });

  return formatter.format(date); // "YYYY-MM"
}

/**
 * Get the local year string for a date in a given timezone.
 * Returns "YYYY" (e.g., "2025").
 */
function toLocalYearString(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
  });

  return formatter.format(date); // "YYYY"
}

/**
 * Get a cache key for a specific day in a timezone.
 * Example: "day:2025-03-15"
 */
export function getDayKey(timezone: string, date: Date = new Date()): string {
  const localDate = toLocalDateString(date, timezone);
  return `day:${localDate}`;
}

/**
 * Get a cache key for a specific week in a timezone.
 * Example: "week:2025-W12"
 */
export function getWeekKey(timezone: string, date: Date = new Date()): string {
  const localWeek = toLocalWeekString(date, timezone);
  return `week:${localWeek}`;
}

/**
 * Get a cache key for a specific month in a timezone.
 * Example: "month:2025-03"
 */
export function getMonthKey(timezone: string, date: Date = new Date()): string {
  const localMonth = toLocalMonthString(date, timezone);
  return `month:${localMonth}`;
}

/**
 * Get a cache key for a specific year in a timezone.
 * Example: "year:2025"
 */
export function getYearKey(timezone: string, date: Date = new Date()): string {
  const localYear = toLocalYearString(date, timezone);
  return `year:${localYear}`;
}
