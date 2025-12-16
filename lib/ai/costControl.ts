/**
 * OpenAI Cost Control Circuit Breaker
 *
 * Implements a global daily budget cap using Redis counters.
 * When budget is exceeded, all OpenAI routes return 503.
 *
 * Env vars:
 * - OPENAI_DAILY_BUDGET_USD: Daily budget limit (default: 100)
 * - OPENAI_BUDGET_FAIL_MODE: "closed" (default) or "open"
 *
 * Usage:
 * 1. Before OpenAI call: const { allowed } = await checkBudget()
 * 2. If !allowed: return 503
 * 3. After OpenAI call: await incrementBudget(model, inputTokens, outputTokens)
 */

import { getCache, setCache } from "@/lib/cache/redis";
import { estimateCostUsd } from "./pricing";

// Default budget: $100/day (can be overridden via env)
const DEFAULT_DAILY_BUDGET_USD = 100;

/**
 * Get the daily budget limit from env
 */
function getDailyBudgetLimit(): number {
  const envBudget = process.env.OPENAI_DAILY_BUDGET_USD;
  if (envBudget) {
    const parsed = parseFloat(envBudget);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_DAILY_BUDGET_USD;
}

/**
 * Get fail mode from env (default: closed)
 */
function getFailMode(): "closed" | "open" {
  const mode = process.env.OPENAI_BUDGET_FAIL_MODE;
  if (mode === "open") {
    return "open";
  }
  return "closed";
}

/**
 * Get today's date key in UTC (YYYY-MM-DD)
 */
function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Get the Redis key for today's budget counter
 */
function getBudgetKey(): string {
  return `openai:budget:${getTodayKey()}`;
}

export interface BudgetCheckResult {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
}

/**
 * Check if we have budget remaining for an OpenAI call.
 *
 * @returns { allowed, used, limit, remaining }
 *
 * If Redis is unavailable and fail mode is "closed", returns allowed: false
 * If Redis is unavailable and fail mode is "open", returns allowed: true (risky)
 */
export async function checkBudget(): Promise<BudgetCheckResult> {
  const limit = getDailyBudgetLimit();
  const failMode = getFailMode();

  try {
    const key = getBudgetKey();
    const used = (await getCache<number>(key)) || 0;
    const remaining = Math.max(0, limit - used);
    const allowed = used < limit;

    if (!allowed) {
      console.warn(`[CostControl] Daily budget exceeded: $${used.toFixed(4)} / $${limit}`);
    }

    return { allowed, used, limit, remaining };
  } catch (error: any) {
    console.error("[CostControl] Error checking budget:", error.message);

    // Fail mode determines behavior when Redis is down
    if (failMode === "closed") {
      console.warn("[CostControl] Redis unavailable, failing closed");
      return { allowed: false, used: 0, limit, remaining: 0 };
    }

    // Fail open (risky - only use in development)
    console.warn("[CostControl] Redis unavailable, failing open (risky!)");
    return { allowed: true, used: 0, limit, remaining: limit };
  }
}

/**
 * Increment the daily budget counter after an OpenAI call.
 *
 * @param model - OpenAI model name
 * @param inputTokens - Input tokens consumed
 * @param outputTokens - Output tokens generated
 * @returns The new total used today
 */
export async function incrementBudget(
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<number> {
  const cost = estimateCostUsd(model, inputTokens, outputTokens);

  if (cost <= 0) {
    return 0;
  }

  try {
    const key = getBudgetKey();

    // Get current usage
    const current = (await getCache<number>(key)) || 0;
    const newTotal = current + cost;

    // Set with 48h TTL (to ensure it persists through timezone edge cases)
    await setCache(key, newTotal, 172800);

    console.log(
      `[CostControl] Budget updated: +$${cost.toFixed(6)} → $${newTotal.toFixed(4)} total today`
    );

    return newTotal;
  } catch (error: any) {
    console.error("[CostControl] Error incrementing budget:", error.message);
    // Don't fail the request on tracking error - just log
    return 0;
  }
}

/**
 * Get the current budget status (for monitoring/debugging).
 */
export async function getBudgetStatus(): Promise<{
  today: string;
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
}> {
  const limit = getDailyBudgetLimit();
  const today = getTodayKey();

  try {
    const key = getBudgetKey();
    const used = (await getCache<number>(key)) || 0;
    const remaining = Math.max(0, limit - used);
    const percentUsed = (used / limit) * 100;

    return { today, used, limit, remaining, percentUsed };
  } catch {
    return { today, used: 0, limit, remaining: limit, percentUsed: 0 };
  }
}

/**
 * Standard 503 response for budget exceeded.
 */
export const BUDGET_EXCEEDED_RESPONSE = {
  error: "Budget exceeded",
  message: "Service temporarily unavailable. Please try again later.",
};
