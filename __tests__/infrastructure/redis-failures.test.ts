import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// process.env.NODE_ENV is read-only in @types/node; cast to mutable record for test env manipulation
const env = process.env as Record<string, string | undefined>;

describe("Lock Operations - acquireLock (prod fail-closed, non-prod fail-open) (lib/cache/redis.ts)", () => {
  const originalNodeEnv = env.NODE_ENV;
  const originalRedisUrl = env.REDIS_URL;
  const originalValkeyUrl = env.VALKEY_URL;

  beforeEach(() => {
    // Ensure no Redis URL so initRedis() leaves redis = null → "unavailable"
    delete env.REDIS_URL;
    delete env.VALKEY_URL;
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original env to avoid cross-test pollution
    env.NODE_ENV = originalNodeEnv;
    if (originalRedisUrl !== undefined) {
      env.REDIS_URL = originalRedisUrl;
    } else {
      delete env.REDIS_URL;
    }
    if (originalValkeyUrl !== undefined) {
      env.VALKEY_URL = originalValkeyUrl;
    } else {
      delete env.VALKEY_URL;
    }
  });

  it("acquireLock returns true when Redis unavailable in non-production (fail-open)", async () => {
    env.NODE_ENV = "test";

    const { acquireLock } = await import("@/lib/cache/redis");
    const result = await acquireLock("test-lock", 30);

    expect(result).toBe(true);
  });

  it("acquireLock returns false when Redis unavailable in production (fail-closed)", async () => {
    env.NODE_ENV = "production";

    const { acquireLock } = await import("@/lib/cache/redis");
    const result = await acquireLock("test-lock", 30);

    expect(result).toBe(false);
  });

  it("releaseLock is no-op when Redis unavailable", async () => {
    env.NODE_ENV = "test";

    const { releaseLock } = await import("@/lib/cache/redis");

    await expect(releaseLock("test-lock")).resolves.toBeUndefined();
  });
});
