import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("Lock Operations - acquireLock (prod fail-closed, non-prod fail-open) (lib/cache/redis.ts)", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalRedisUrl = process.env.REDIS_URL;
  const originalValkeyUrl = process.env.VALKEY_URL;

  beforeEach(() => {
    // Ensure no Redis URL so initRedis() leaves redis = null → "unavailable"
    delete process.env.REDIS_URL;
    delete process.env.VALKEY_URL;
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original env to avoid cross-test pollution
    process.env.NODE_ENV = originalNodeEnv;
    if (originalRedisUrl !== undefined) {
      process.env.REDIS_URL = originalRedisUrl;
    } else {
      delete process.env.REDIS_URL;
    }
    if (originalValkeyUrl !== undefined) {
      process.env.VALKEY_URL = originalValkeyUrl;
    } else {
      delete process.env.VALKEY_URL;
    }
  });

  it("acquireLock returns true when Redis unavailable in non-production (fail-open)", async () => {
    process.env.NODE_ENV = "test";

    const { acquireLock } = await import("@/lib/cache/redis");
    const result = await acquireLock("test-lock", 30);

    expect(result).toBe(true);
  });

  it("acquireLock returns false when Redis unavailable in production (fail-closed)", async () => {
    process.env.NODE_ENV = "production";

    const { acquireLock } = await import("@/lib/cache/redis");
    const result = await acquireLock("test-lock", 30);

    expect(result).toBe(false);
  });

  it("releaseLock is no-op when Redis unavailable", async () => {
    process.env.NODE_ENV = "test";

    const { releaseLock } = await import("@/lib/cache/redis");

    await expect(releaseLock("test-lock")).resolves.toBeUndefined();
  });
});
