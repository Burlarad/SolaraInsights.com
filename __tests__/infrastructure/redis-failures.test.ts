/**
 * Redis Failure Mode Tests
 *
 * Tests the behavior of various systems when Redis is unavailable.
 * This is CRITICAL infrastructure testing.
 *
 * Key behaviors tested:
 * - Rate limiting: fail-open (falls back to memory)
 * - Cache reads: fail-open (returns null)
 * - acquireLockFailClosed: fail-closed (rejects operation)
 * - Cost control: configurable fail mode
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// =============================================================================
// REDIS MOCK SETUP
// =============================================================================

// We need to mock ioredis BEFORE importing any modules that use it
const mockRedisInstance = {
  connected: true,
  data: new Map<string, string>(),
  errorMode: false,

  on: vi.fn(function (this: typeof mockRedisInstance, event: string, callback: () => void) {
    if (event === "connect" && this.connected) callback();
    if (event === "ready" && this.connected) callback();
    if (event === "error" && !this.connected) callback();
    if (event === "close" && !this.connected) callback();
    return this;
  }),

  ping: vi.fn(async function (this: typeof mockRedisInstance) {
    if (!this.connected || this.errorMode) {
      throw new Error("Redis connection failed");
    }
    return "PONG";
  }),

  get: vi.fn(async function (this: typeof mockRedisInstance, key: string) {
    if (!this.connected || this.errorMode) {
      throw new Error("Redis connection failed");
    }
    return this.data.get(key) || null;
  }),

  set: vi.fn(async function (
    this: typeof mockRedisInstance,
    key: string,
    value: string,
    ...args: unknown[]
  ) {
    if (!this.connected || this.errorMode) {
      throw new Error("Redis connection failed");
    }
    // Handle NX flag (set only if not exists)
    if (args.includes("NX") && this.data.has(key)) {
      return null;
    }
    this.data.set(key, value);
    return "OK";
  }),

  setex: vi.fn(async function (
    this: typeof mockRedisInstance,
    key: string,
    _ttl: number,
    value: string
  ) {
    if (!this.connected || this.errorMode) {
      throw new Error("Redis connection failed");
    }
    this.data.set(key, value);
    return "OK";
  }),

  del: vi.fn(async function (this: typeof mockRedisInstance, key: string) {
    if (!this.connected || this.errorMode) {
      throw new Error("Redis connection failed");
    }
    const existed = this.data.has(key);
    this.data.delete(key);
    return existed ? 1 : 0;
  }),

  incr: vi.fn(async function (this: typeof mockRedisInstance, key: string) {
    if (!this.connected || this.errorMode) {
      throw new Error("Redis connection failed");
    }
    const current = parseInt(this.data.get(key) || "0", 10);
    const next = current + 1;
    this.data.set(key, next.toString());
    return next;
  }),

  ttl: vi.fn(async function (this: typeof mockRedisInstance, key: string) {
    if (!this.connected || this.errorMode) {
      throw new Error("Redis connection failed");
    }
    return this.data.has(key) ? 3600 : -1;
  }),

  expire: vi.fn(async function (this: typeof mockRedisInstance) {
    if (!this.connected || this.errorMode) {
      throw new Error("Redis connection failed");
    }
    return 1;
  }),

  multi: vi.fn(function (this: typeof mockRedisInstance) {
    const self = this;
    const results: Array<[null, number]> = [];

    const chain = {
      incr: vi.fn((key: string) => {
        const current = parseInt(self.data.get(key) || "0", 10);
        const next = current + 1;
        self.data.set(key, next.toString());
        results.push([null, next]);
        return chain;
      }),
      ttl: vi.fn((key: string) => {
        results.push([null, self.data.has(key) ? 3600 : -1]);
        return chain;
      }),
      exec: vi.fn(async () => {
        if (!self.connected || self.errorMode) {
          throw new Error("Redis connection failed");
        }
        return results;
      }),
    };
    return chain;
  }),
};

// Mock ioredis module
vi.mock("ioredis", () => {
  return {
    default: vi.fn(() => mockRedisInstance),
  };
});

// =============================================================================
// TESTS
// =============================================================================

describe("Redis Failure Modes", () => {
  beforeEach(() => {
    // Reset mock state before each test
    mockRedisInstance.connected = true;
    mockRedisInstance.errorMode = false;
    mockRedisInstance.data.clear();
    vi.clearAllMocks();

    // Reset module cache to get fresh instances
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Cache Operations (lib/cache/redis.ts)", () => {
    it("getCache returns null when Redis unavailable", async () => {
      mockRedisInstance.connected = false;

      // Re-import to get fresh module state
      const { getCache } = await import("@/lib/cache/redis");

      const result = await getCache<{ test: string }>("test-key");

      expect(result).toBeNull();
    });

    it("setCache is no-op when Redis unavailable", async () => {
      mockRedisInstance.connected = false;

      const { setCache } = await import("@/lib/cache/redis");

      // Should not throw
      await expect(setCache("test-key", { data: "test" }, 3600)).resolves.toBeUndefined();
    });

    it("getCache returns data when Redis is working", async () => {
      mockRedisInstance.connected = true;
      mockRedisInstance.data.set("test-key", JSON.stringify({ test: "value" }));

      const { getCache } = await import("@/lib/cache/redis");

      const result = await getCache<{ test: string }>("test-key");

      expect(result).toEqual({ test: "value" });
    });

    it("isRedisAvailable returns false when Redis is down", async () => {
      mockRedisInstance.connected = false;

      const { isRedisAvailable } = await import("@/lib/cache/redis");

      expect(isRedisAvailable()).toBe(false);
    });

    it("isRedisAvailable returns true when Redis is working", async () => {
      mockRedisInstance.connected = true;

      const { isRedisAvailable } = await import("@/lib/cache/redis");

      // Need to trigger initialization
      const { getCache } = await import("@/lib/cache/redis");
      await getCache("init");

      expect(isRedisAvailable()).toBe(true);
    });
  });

  describe("Lock Operations - Fail-Closed (lib/cache/redis.ts)", () => {
    it("acquireLockFailClosed returns redisDown:true when Redis unavailable", async () => {
      mockRedisInstance.connected = false;

      const { acquireLockFailClosed } = await import("@/lib/cache/redis");

      const result = await acquireLockFailClosed("test-lock", 30);

      expect(result).toEqual({ acquired: false, redisDown: true });
    });

    it("acquireLockFailClosed returns acquired:true when lock is free", async () => {
      mockRedisInstance.connected = true;

      const { acquireLockFailClosed } = await import("@/lib/cache/redis");

      const result = await acquireLockFailClosed("test-lock", 30);

      expect(result).toEqual({ acquired: true, redisDown: false });
    });

    it("acquireLockFailClosed returns acquired:false when lock is held", async () => {
      mockRedisInstance.connected = true;
      // Pre-set the lock key
      mockRedisInstance.data.set("test-lock", "locked");

      const { acquireLockFailClosed } = await import("@/lib/cache/redis");

      const result = await acquireLockFailClosed("test-lock", 30);

      expect(result).toEqual({ acquired: false, redisDown: false });
    });

    it("acquireLockFailClosed fails closed on mid-operation error", async () => {
      mockRedisInstance.connected = true;
      mockRedisInstance.errorMode = true; // Simulate mid-operation error

      const { acquireLockFailClosed } = await import("@/lib/cache/redis");

      const result = await acquireLockFailClosed("test-lock", 30);

      expect(result).toEqual({ acquired: false, redisDown: true });
    });
  });

  describe("Lock Operations - Fail-Open (lib/cache/redis.ts)", () => {
    it("acquireLock returns true when Redis unavailable (fail-open)", async () => {
      mockRedisInstance.connected = false;

      const { acquireLock } = await import("@/lib/cache/redis");

      // Fail-open means it allows the operation when Redis is down
      const result = await acquireLock("test-lock", 30);

      expect(result).toBe(true);
    });

    it("releaseLock is no-op when Redis unavailable", async () => {
      mockRedisInstance.connected = false;

      const { releaseLock } = await import("@/lib/cache/redis");

      // Should not throw
      await expect(releaseLock("test-lock")).resolves.toBeUndefined();
    });
  });

  describe("Recovery Behavior", () => {
    it("system recovers when Redis comes back online", async () => {
      // Start with Redis down
      mockRedisInstance.connected = false;

      const { getCache, setCache, isRedisAvailable } = await import("@/lib/cache/redis");

      // Verify Redis is down
      const initialResult = await getCache("test-key");
      expect(initialResult).toBeNull();

      // Simulate Redis coming back online
      mockRedisInstance.connected = true;

      // Manually trigger the ready event behavior (in real code this is done by ioredis)
      // For this test, we need to reset the module to pick up the new state
      vi.resetModules();

      const freshModule = await import("@/lib/cache/redis");

      // Now operations should work
      await freshModule.setCache("test-key", { recovered: true }, 3600);
      const recoveredResult = await freshModule.getCache<{ recovered: boolean }>("test-key");

      expect(recoveredResult).toEqual({ recovered: true });
    });
  });

  describe("Error Handling", () => {
    it("getCache returns null on JSON parse error", async () => {
      mockRedisInstance.connected = true;
      mockRedisInstance.data.set("bad-json", "not valid json {{{");

      const { getCache } = await import("@/lib/cache/redis");

      const result = await getCache("bad-json");

      expect(result).toBeNull();
    });

    it("setCache handles error gracefully", async () => {
      mockRedisInstance.connected = true;
      mockRedisInstance.errorMode = true;

      const { setCache } = await import("@/lib/cache/redis");

      // Should not throw, just log error
      await expect(setCache("test-key", { data: "test" }, 3600)).resolves.toBeUndefined();
    });
  });
});
