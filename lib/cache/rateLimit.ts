/**
 * Rate limiting with Redis + in-memory fallback.
 *
 * Uses Redis INCR + EXPIRE for distributed rate limiting.
 * Falls back to in-memory Map when Redis is unavailable.
 */

import Redis from "ioredis";

// Singleton Redis client
let redis: Redis | null = null;
let redisInitialized = false;
let redisConnectionTested = false;
let redisWorking = false;

// In-memory fallback store
const memoryStore = new Map<string, { count: number; resetAt: number }>();

// Clean up expired entries every 60 seconds
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of memoryStore.entries()) {
      if (value.resetAt < now) {
        memoryStore.delete(key);
      }
    }
  }, 60_000);
}

function initRedis(): void {
  if (redisInitialized) return;
  redisInitialized = true;

  const redisUrl = process.env.REDIS_URL || process.env.VALKEY_URL;

  if (!redisUrl) {
    console.warn("[RateLimit] No REDIS_URL found. Using in-memory fallback.");
    return;
  }

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false, // Don't wait for ready check
      lazyConnect: false,
      connectTimeout: 5000,
    });

    redis.on("error", (err) => {
      console.error("[RateLimit] Redis error:", err.message);
      redisWorking = false;
    });

    redis.on("close", () => {
      redisWorking = false;
    });
  } catch (error: any) {
    console.error("[RateLimit] Failed to init Redis:", error.message);
    redis = null;
  }
}

/**
 * Test Redis connection with a ping. Called once on first rate limit check.
 */
async function testRedisConnection(): Promise<boolean> {
  if (redisConnectionTested) return redisWorking;
  redisConnectionTested = true;

  if (!redis) return false;

  try {
    const pong = await redis.ping();
    redisWorking = pong === "PONG";
    console.log(`[RateLimit] Redis ping: ${redisWorking ? "OK" : "FAILED"}`);
    return redisWorking;
  } catch (error: any) {
    console.error("[RateLimit] Redis ping failed:", error.message);
    redisWorking = false;
    return false;
  }
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
  backend: "redis" | "memory";
  count: number;
}

/**
 * Check and increment rate limit for a key.
 *
 * @param key - Unique identifier (e.g., IP address)
 * @param limit - Max requests per window
 * @param windowSeconds - Time window in seconds
 * @returns Rate limit result with remaining count
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  initRedis();

  const rateLimitKey = `ratelimit:${key}`;

  // Test Redis connection on first call
  if (redis && !redisConnectionTested) {
    await testRedisConnection();
  }

  if (redis && redisWorking) {
    return checkRateLimitRedis(rateLimitKey, limit, windowSeconds);
  }

  return checkRateLimitMemory(rateLimitKey, limit, windowSeconds);
}

async function checkRateLimitRedis(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  try {
    const multi = redis!.multi();
    multi.incr(key);
    multi.ttl(key);

    const results = await multi.exec();
    if (!results) {
      throw new Error("Redis multi exec returned null");
    }

    const count = results[0][1] as number;
    let ttl = results[1][1] as number;

    // Set expiry on first request in window
    if (ttl === -1) {
      await redis!.expire(key, windowSeconds);
      ttl = windowSeconds;
    }

    const resetAt = Date.now() + ttl * 1000;
    const remaining = Math.max(0, limit - count);

    return {
      success: count <= limit,
      remaining,
      resetAt,
      limit,
      backend: "redis",
      count,
    };
  } catch (error: any) {
    console.error("[RateLimit] Redis error, using fallback:", error.message);
    redisWorking = false;
    return checkRateLimitMemory(key, limit, windowSeconds);
  }
}

function checkRateLimitMemory(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  let entry = memoryStore.get(key);

  // Create new entry or reset expired entry
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + windowMs,
    };
    memoryStore.set(key, entry);

    return {
      success: true,
      remaining: limit - 1,
      resetAt: entry.resetAt,
      limit,
      backend: "memory",
      count: 1,
    };
  }

  // Increment existing entry
  entry.count++;
  const remaining = Math.max(0, limit - entry.count);

  return {
    success: entry.count <= limit,
    remaining,
    resetAt: entry.resetAt,
    limit,
    backend: "memory",
    count: entry.count,
  };
}

/**
 * Get client IP from request headers.
 * Handles Cloudflare, proxies, and direct connections.
 */
export function getClientIP(request: Request): string {
  // Cloudflare
  const cfIP = request.headers.get("cf-connecting-ip");
  if (cfIP) return cfIP;

  // X-Forwarded-For (first IP in chain)
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const firstIP = xff.split(",")[0].trim();
    if (firstIP) return firstIP;
  }

  // X-Real-IP (nginx)
  const realIP = request.headers.get("x-real-ip");
  if (realIP) return realIP;

  // Fallback
  return "unknown";
}
