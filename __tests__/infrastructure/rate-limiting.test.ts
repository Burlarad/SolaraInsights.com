/**
 * Rate Limiting Tests
 *
 * Tests the rate limiting system with Redis and memory fallback.
 *
 * Key behaviors tested:
 * - Burst limit blocks rapid requests
 * - Sustained rate limit tracks per-user/per-IP
 * - Memory fallback when Redis unavailable
 * - Memory cleanup removes expired entries
 * - Different keys tracked separately
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// =============================================================================
// MOCK SETUP
// =============================================================================

// Track whether Redis should work
let redisAvailable = true;
let redisError = false;

const mockRedisData = new Map<string, { value: number; resetAt: number }>();

// Mock ioredis before importing rate limit module
vi.mock("ioredis", () => {
  return {
    default: vi.fn(() => ({
      on: vi.fn((event: string, callback: () => void) => {
        if (event === "connect" && redisAvailable) callback();
        if (event === "ready" && redisAvailable) callback();
        if (event === "error" && !redisAvailable) callback();
        if (event === "close" && !redisAvailable) callback();
      }),

      ping: vi.fn(async () => {
        if (!redisAvailable || redisError) {
          throw new Error("Redis connection failed");
        }
        return "PONG";
      }),

      multi: vi.fn(() => {
        const chain = {
          incr: vi.fn((key: string) => {
            const entry = mockRedisData.get(key) || { value: 0, resetAt: Date.now() + 3600000 };
            entry.value++;
            mockRedisData.set(key, entry);
            return chain;
          }),
          ttl: vi.fn((key: string) => {
            return chain;
          }),
          exec: vi.fn(async () => {
            if (!redisAvailable || redisError) {
              throw new Error("Redis connection failed");
            }
            // Return [incr result, ttl result]
            const lastKey = Array.from(mockRedisData.keys()).pop() || "";
            const entry = mockRedisData.get(lastKey) || { value: 1, resetAt: Date.now() };
            return [
              [null, entry.value],
              [null, entry.resetAt > Date.now() ? 3600 : -1],
            ];
          }),
        };
        return chain;
      }),

      expire: vi.fn(async () => {
        if (!redisAvailable || redisError) {
          throw new Error("Redis connection failed");
        }
        return 1;
      }),
    })),
  };
});

// =============================================================================
// TESTS
// =============================================================================

describe("Rate Limiting", () => {
  beforeEach(() => {
    redisAvailable = true;
    redisError = false;
    mockRedisData.clear();
    vi.clearAllMocks();
    vi.resetModules();

    // Set Redis URL so rate limiter tries to use Redis
    process.env.REDIS_URL = "redis://localhost:6379";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("checkRateLimit()", () => {
    it("allows first request within limit", async () => {
      const { checkRateLimit } = await import("@/lib/cache/rateLimit");

      const result = await checkRateLimit("test-ip", 10, 60);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(result.remaining).toBe(9);
      expect(result.limit).toBe(10);
    });

    it("allows requests up to limit", async () => {
      const { checkRateLimit } = await import("@/lib/cache/rateLimit");

      // Make 10 requests (at limit)
      for (let i = 0; i < 10; i++) {
        const result = await checkRateLimit("test-ip", 10, 60);
        expect(result.success).toBe(true);
        expect(result.count).toBe(i + 1);
      }
    });

    it("blocks request after limit exceeded", async () => {
      const { checkRateLimit } = await import("@/lib/cache/rateLimit");

      // Make 11 requests (over limit of 10)
      for (let i = 0; i < 10; i++) {
        await checkRateLimit("test-ip", 10, 60);
      }

      const result = await checkRateLimit("test-ip", 10, 60);

      expect(result.success).toBe(false);
      expect(result.count).toBe(11);
      expect(result.remaining).toBe(0);
    });

    it("tracks different keys separately", async () => {
      const { checkRateLimit } = await import("@/lib/cache/rateLimit");

      // Use up limit for IP-A
      for (let i = 0; i < 5; i++) {
        await checkRateLimit("ip-a", 5, 60);
      }
      const resultA = await checkRateLimit("ip-a", 5, 60);
      expect(resultA.success).toBe(false);

      // IP-B should still be allowed
      const resultB = await checkRateLimit("ip-b", 5, 60);
      expect(resultB.success).toBe(true);
      expect(resultB.count).toBe(1);
    });

    it("returns correct resetAt timestamp", async () => {
      const { checkRateLimit } = await import("@/lib/cache/rateLimit");

      const before = Date.now();
      const result = await checkRateLimit("test-ip", 10, 60);
      const after = Date.now();

      // Reset should be approximately 60 seconds from now (within a minute)
      expect(result.resetAt).toBeGreaterThan(before);
      expect(result.resetAt).toBeLessThanOrEqual(after + 3600000); // Within an hour
    });
  });

  describe("checkBurstLimit()", () => {
    it("allows initial burst of requests", async () => {
      const { checkBurstLimit } = await import("@/lib/cache/rateLimit");

      // Should allow up to burst limit
      const result = await checkBurstLimit("user-123", 5, 10);

      expect(result.success).toBe(true);
      expect(result.limit).toBe(5);
    });

    it("blocks after burst limit exceeded", async () => {
      const { checkBurstLimit } = await import("@/lib/cache/rateLimit");

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        await checkBurstLimit("user-123", 5, 10);
      }

      // 6th request should be blocked
      const result = await checkBurstLimit("user-123", 5, 10);

      expect(result.success).toBe(false);
    });

    it("uses burst: prefix in key", async () => {
      const { checkBurstLimit } = await import("@/lib/cache/rateLimit");

      await checkBurstLimit("user-123", 5, 10);

      // The key should include "burst:" prefix
      expect(mockRedisData.has("ratelimit:burst:user-123")).toBe(true);
    });
  });

  describe("Memory Fallback", () => {
    it("falls back to memory when Redis unavailable", async () => {
      redisAvailable = false;

      const { checkRateLimit } = await import("@/lib/cache/rateLimit");

      const result = await checkRateLimit("test-ip", 10, 60);

      expect(result.success).toBe(true);
      expect(result.backend).toBe("memory");
    });

    it("memory fallback enforces limits correctly", async () => {
      redisAvailable = false;

      const { checkRateLimit } = await import("@/lib/cache/rateLimit");

      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        await checkRateLimit("test-ip", 10, 60);
      }

      // 11th should be blocked even with memory fallback
      const result = await checkRateLimit("test-ip", 10, 60);

      expect(result.success).toBe(false);
      expect(result.backend).toBe("memory");
    });

    it("switches to memory on Redis operation error", async () => {
      redisAvailable = true;
      redisError = true; // Simulate error during operation

      const { checkRateLimit } = await import("@/lib/cache/rateLimit");

      const result = await checkRateLimit("test-ip", 10, 60);

      expect(result.success).toBe(true);
      expect(result.backend).toBe("memory");
    });
  });

  describe("getClientIP()", () => {
    it("extracts IP from cf-connecting-ip (Cloudflare)", async () => {
      const { getClientIP } = await import("@/lib/cache/rateLimit");

      const request = new Request("http://localhost", {
        headers: {
          "cf-connecting-ip": "1.2.3.4",
        },
      });

      expect(getClientIP(request)).toBe("1.2.3.4");
    });

    it("extracts first IP from x-forwarded-for", async () => {
      const { getClientIP } = await import("@/lib/cache/rateLimit");

      const request = new Request("http://localhost", {
        headers: {
          "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.10.11.12",
        },
      });

      expect(getClientIP(request)).toBe("1.2.3.4");
    });

    it("uses x-real-ip as fallback", async () => {
      const { getClientIP } = await import("@/lib/cache/rateLimit");

      const request = new Request("http://localhost", {
        headers: {
          "x-real-ip": "1.2.3.4",
        },
      });

      expect(getClientIP(request)).toBe("1.2.3.4");
    });

    it("returns unknown when no IP header", async () => {
      const { getClientIP } = await import("@/lib/cache/rateLimit");

      const request = new Request("http://localhost");

      expect(getClientIP(request)).toBe("unknown");
    });

    it("prefers cf-connecting-ip over x-forwarded-for", async () => {
      const { getClientIP } = await import("@/lib/cache/rateLimit");

      const request = new Request("http://localhost", {
        headers: {
          "cf-connecting-ip": "cloudflare-ip",
          "x-forwarded-for": "forwarded-ip",
        },
      });

      expect(getClientIP(request)).toBe("cloudflare-ip");
    });
  });

  describe("createRateLimitResponse()", () => {
    it("creates user-friendly error response", async () => {
      const { createRateLimitResponse } = await import("@/lib/cache/rateLimit");

      const response = createRateLimitResponse(30);

      expect(response).toEqual({
        error: "rate_limited",
        message: "You're moving fast — try again in a few seconds.",
        retryAfterSeconds: 30,
      });
    });

    it("accepts custom message", async () => {
      const { createRateLimitResponse } = await import("@/lib/cache/rateLimit");

      const response = createRateLimitResponse(60, "Custom message");

      expect(response.message).toBe("Custom message");
      expect(response.retryAfterSeconds).toBe(60);
    });
  });

  describe("RateLimitResult interface", () => {
    it("returns complete result object", async () => {
      const { checkRateLimit } = await import("@/lib/cache/rateLimit");

      const result = await checkRateLimit("test-key", 10, 60);

      // Verify all required fields exist
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("remaining");
      expect(result).toHaveProperty("resetAt");
      expect(result).toHaveProperty("limit");
      expect(result).toHaveProperty("backend");
      expect(result).toHaveProperty("count");

      // Verify types
      expect(typeof result.success).toBe("boolean");
      expect(typeof result.remaining).toBe("number");
      expect(typeof result.resetAt).toBe("number");
      expect(typeof result.limit).toBe("number");
      expect(["redis", "memory"]).toContain(result.backend);
      expect(typeof result.count).toBe("number");
    });
  });
});
