/**
 * Enhanced Redis/Valkey caching layer with locking support for Solara.
 *
 * Features:
 * - Graceful degradation: app works without Redis
 * - Optional locking to prevent duplicate AI generation
 * - Timezone-aware period keys
 * - Safe error handling throughout
 *
 * Caching is completely optional:
 * - If REDIS_URL is not set, all operations are no-ops
 * - If Redis connection fails, logs warning and continues
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
export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
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

/**
 * Acquire a distributed lock for a given key.
 *
 * Uses Redis SETNX (SET if Not eXists) for atomic locking.
 * Lock is automatically released after TTL expires.
 *
 * @param lockKey - Unique key for the lock
 * @param ttlSeconds - How long to hold the lock (default: 30 seconds)
 * @returns true if lock acquired, false if already locked or Redis unavailable
 */
export async function acquireLock(
  lockKey: string,
  ttlSeconds: number = 30
): Promise<boolean> {
  initRedis();

  if (!redis || !redisAvailable) {
    // If Redis is unavailable, allow the operation to proceed (no locking)
    console.warn(`[Cache] Redis unavailable, skipping lock for "${lockKey}"`);
    return true;
  }

  try {
    // SETNX: SET if Not eXists
    // Returns 1 if key was set (lock acquired), 0 if key already exists (locked)
    const result = await redis.set(lockKey, "locked", "EX", ttlSeconds, "NX");
    return result === "OK";
  } catch (error: any) {
    console.error(`[Cache] Error acquiring lock "${lockKey}":`, error.message);
    // On error, allow operation to proceed (fail-open)
    return true;
  }
}

/**
 * Release a distributed lock for a given key.
 *
 * @param lockKey - Unique key for the lock
 */
export async function releaseLock(lockKey: string): Promise<void> {
  initRedis();

  if (!redis || !redisAvailable) {
    return;
  }

  try {
    await redis.del(lockKey);
  } catch (error: any) {
    console.error(`[Cache] Error releasing lock "${lockKey}":`, error.message);
  }
}

/**
 * Execute a function with a distributed lock.
 * Acquires lock, runs function, releases lock.
 * If lock cannot be acquired, returns null.
 *
 * @param lockKey - Unique key for the lock
 * @param fn - Async function to execute while holding lock
 * @param ttlSeconds - How long to hold the lock (default: 30 seconds)
 * @returns Result of fn, or null if lock couldn't be acquired
 */
export async function withLock<T>(
  lockKey: string,
  fn: () => Promise<T>,
  ttlSeconds: number = 30
): Promise<T | null> {
  const acquired = await acquireLock(lockKey, ttlSeconds);

  if (!acquired) {
    console.log(`[Cache] Lock "${lockKey}" already held, skipping operation`);
    return null;
  }

  try {
    const result = await fn();
    return result;
  } finally {
    await releaseLock(lockKey);
  }
}

// ========================================
// P0 Security: Fail-Closed Support
// ========================================

/**
 * Check if Redis is currently available.
 *
 * @returns true if Redis is connected and ready, false otherwise
 */
export function isRedisAvailable(): boolean {
  initRedis();
  return redis !== null && redisAvailable;
}

/**
 * Acquire a lock with fail-closed behavior.
 *
 * Unlike acquireLock(), this function returns false when Redis is unavailable,
 * preventing operations from proceeding without distributed coordination.
 *
 * Use this for expensive operations (like OpenAI calls) where duplicate
 * execution is costly.
 *
 * @param lockKey - Unique key for the lock
 * @param ttlSeconds - How long to hold the lock (default: 30 seconds)
 * @returns { acquired: boolean, redisAvailable: boolean }
 */
export async function acquireLockFailClosed(
  lockKey: string,
  ttlSeconds: number = 30
): Promise<{ acquired: boolean; redisDown: boolean }> {
  initRedis();

  if (!redis || !redisAvailable) {
    console.warn(`[Cache] Redis unavailable, failing closed for lock "${lockKey}"`);
    return { acquired: false, redisDown: true };
  }

  try {
    const result = await redis.set(lockKey, "locked", "EX", ttlSeconds, "NX");
    return { acquired: result === "OK", redisDown: false };
  } catch (error: any) {
    console.error(`[Cache] Error acquiring lock "${lockKey}":`, error.message);
    // On error, fail closed (don't allow the operation)
    return { acquired: false, redisDown: true };
  }
}

/**
 * Standard 503 response for Redis unavailable on expensive operations.
 */
export const REDIS_UNAVAILABLE_RESPONSE = {
  error: "Service unavailable",
  message: "Please try again in a moment.",
};
