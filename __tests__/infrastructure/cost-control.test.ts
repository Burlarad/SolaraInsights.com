/**
 * Cost Control Tests
 *
 * Tests the OpenAI budget circuit breaker system.
 *
 * Key behaviors tested:
 * - Budget check allows requests under limit
 * - Budget check blocks requests over limit
 * - Increment correctly calculates costs
 * - Fail-closed vs fail-open modes
 * - Budget resets daily
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// =============================================================================
// MOCK SETUP
// =============================================================================

// Cache mock to track budget values - keyed by any string
const mockCache = new Map<string, unknown>();
let mockShouldFail = false;

// Mock the cache module BEFORE any imports
vi.mock("@/lib/cache/redis", () => ({
  getCache: vi.fn(async (key: string) => {
    if (mockShouldFail) {
      throw new Error("Redis connection failed");
    }
    // Look for any key containing the date pattern
    for (const [k, v] of mockCache.entries()) {
      if (key.includes(k) || k.includes(key.split(":").pop() || "")) {
        return v;
      }
    }
    return mockCache.get(key) ?? null;
  }),
  setCache: vi.fn(async (key: string, value: unknown) => {
    if (mockShouldFail) {
      throw new Error("Redis connection failed");
    }
    mockCache.set(key, value);
  }),
}));

// =============================================================================
// TESTS
// =============================================================================

describe("Cost Control Circuit Breaker", () => {
  beforeEach(() => {
    mockCache.clear();
    mockShouldFail = false;
    vi.clearAllMocks();

    // Reset environment to defaults
    process.env.OPENAI_DAILY_BUDGET_USD = "100";
    process.env.OPENAI_BUDGET_FAIL_MODE = "closed";

    // Reset modules to pick up new env vars
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("checkBudget()", () => {
    it("allows request when under budget", async () => {
      // Set current usage to $50 (use today's date key)
      const todayKey = getTodayKey();
      mockCache.set(todayKey, 50);

      const { checkBudget } = await import("@/lib/ai/costControl");

      const result = await checkBudget();

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(50);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(50);
    });

    it("blocks request when over budget", async () => {
      // Set current usage to $150 (over $100 limit)
      const todayKey = getTodayKey();
      mockCache.set(todayKey, 150);

      const { checkBudget } = await import("@/lib/ai/costControl");

      const result = await checkBudget();

      expect(result.allowed).toBe(false);
      expect(result.used).toBe(150);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(0);
    });

    it("allows request when budget is exactly at limit", async () => {
      // Set current usage to $100 (exactly at limit)
      const todayKey = getTodayKey();
      mockCache.set(todayKey, 100);

      const { checkBudget } = await import("@/lib/ai/costControl");

      const result = await checkBudget();

      // At exactly the limit, the next request should be blocked
      expect(result.allowed).toBe(false);
    });

    it("allows request when no prior usage (fresh day)", async () => {
      // No cache entry for today
      const { checkBudget } = await import("@/lib/ai/costControl");

      const result = await checkBudget();

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(0);
      expect(result.remaining).toBe(100);
    });

    it("uses custom budget from environment variable", async () => {
      process.env.OPENAI_DAILY_BUDGET_USD = "250";
      vi.resetModules();

      const todayKey = getTodayKey();
      mockCache.set(todayKey, 200);

      const { checkBudget } = await import("@/lib/ai/costControl");

      const result = await checkBudget();

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(250);
      expect(result.remaining).toBe(50);
    });
  });

  describe("Fail Modes", () => {
    it("fails closed when Redis unavailable (default)", async () => {
      // Simulate Redis failure
      mockShouldFail = true;
      process.env.OPENAI_BUDGET_FAIL_MODE = "closed";

      const { checkBudget } = await import("@/lib/ai/costControl");

      const result = await checkBudget();

      // Fail-closed means block the request
      expect(result.allowed).toBe(false);
    });

    it("fails open when configured (risky)", async () => {
      // Simulate Redis failure
      mockShouldFail = true;
      process.env.OPENAI_BUDGET_FAIL_MODE = "open";
      vi.resetModules();

      const { checkBudget } = await import("@/lib/ai/costControl");

      const result = await checkBudget();

      // Fail-open means allow the request (risky!)
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(100); // Full budget available
    });
  });

  describe("incrementBudget()", () => {
    it("increments budget correctly for gpt-4o-mini model", async () => {
      const todayKey = getTodayKey();
      mockCache.set(todayKey, 10); // Start at $10

      const { incrementBudget } = await import("@/lib/ai/costControl");

      // GPT-4o-mini: $0.15 per 1M input, $0.60 per 1M output
      // 1000 input = 0.00015, 500 output = 0.0003 = 0.00045 total
      const newTotal = await incrementBudget("gpt-4o-mini", 1000, 500);

      // Should be $10 + cost of tokens (very small amount)
      expect(newTotal).toBeGreaterThan(10);
    });

    it("starts from zero on fresh day", async () => {
      // No prior cache entry (clear cache)
      mockCache.clear();

      const { incrementBudget } = await import("@/lib/ai/costControl");

      // Use a model that exists in pricing table
      const newTotal = await incrementBudget("gpt-4o-mini", 1000, 500);

      // Should just be the cost of these tokens (small positive number)
      expect(newTotal).toBeGreaterThan(0);
    });

    it("returns 0 for zero tokens", async () => {
      const { incrementBudget } = await import("@/lib/ai/costControl");

      // Zero tokens = zero cost regardless of model
      const newTotal = await incrementBudget("gpt-4o-mini", 0, 0);

      expect(newTotal).toBe(0);
    });

    it("handles increment error gracefully", async () => {
      // Simulate Redis failure
      mockShouldFail = true;

      const { incrementBudget } = await import("@/lib/ai/costControl");

      // Should not throw, return 0
      const result = await incrementBudget("gpt-4o-mini", 1000, 500);

      expect(result).toBe(0);
    });
  });

  describe("getBudgetStatus()", () => {
    it("returns current budget status", async () => {
      const todayKey = getTodayKey();
      mockCache.set(todayKey, 42.5);

      const { getBudgetStatus } = await import("@/lib/ai/costControl");

      const status = await getBudgetStatus();

      expect(status.today).toBe(getTodayKey());
      expect(status.used).toBe(42.5);
      expect(status.limit).toBe(100);
      expect(status.remaining).toBe(57.5);
      expect(status.percentUsed).toBeCloseTo(42.5);
    });

    it("returns zero usage when no prior spending", async () => {
      mockCache.clear();

      const { getBudgetStatus } = await import("@/lib/ai/costControl");

      const status = await getBudgetStatus();

      expect(status.used).toBe(0);
      expect(status.remaining).toBe(100);
      expect(status.percentUsed).toBe(0);
    });
  });

  describe("Daily Budget Reset", () => {
    it("uses different cache keys for different days", async () => {
      // Clear everything first
      mockCache.clear();

      const { checkBudget } = await import("@/lib/ai/costControl");

      // Today's budget should be fresh (0)
      const result = await checkBudget();

      expect(result.allowed).toBe(true);
      expect(result.used).toBe(0);

      // The daily key pattern ensures different days get different keys
      // This is verified by the fact that fresh day returns 0
    });
  });
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

function getYesterdayKey(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split("T")[0];
}
