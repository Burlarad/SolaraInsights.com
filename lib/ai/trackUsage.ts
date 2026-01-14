import { createAdminSupabaseClient } from "@/lib/supabase/server";
import {
  estimateCostCents,
  getPricingSnapshot,
  PRICING_PROVIDER,
} from "./pricing";

export type AiUsageEvent = {
  featureLabel: string; // e.g., "Sanctuary • Daily Light"
  route: string; // e.g., "/api/insights"
  model: string; // e.g., "gpt-4o-mini"
  promptVersion: number; // e.g., 1, 2, 3...
  cacheStatus: "hit" | "miss"; // "hit" = cached, "miss" = fresh generation
  inputTokens: number; // 0 for cache hits
  outputTokens: number; // 0 for cache hits
  totalTokens: number; // 0 for cache hits
  userId?: string | null; // nullable for public features
  timeframe?: string | null; // e.g., "today", "week", "month"
  periodKey?: string | null; // e.g., "2025-12-12", "2025-W50"
  language?: string | null; // e.g., "en", "es"
  timezone?: string | null; // e.g., "America/New_York"
  requestId?: string | null; // Optional correlation ID
  provider?: string; // Default: "openai"
  extraMeta?: Record<string, unknown>; // Additional metadata
};

/**
 * Track AI usage event to Supabase for cost monitoring and analytics.
 *
 * This function:
 * - Calculates estimated cost based on token usage and model
 * - Stores pricing snapshot in metadata for audit trail
 * - Inserts a record into public.ai_usage_events table
 * - Upserts daily rollup for fast aggregation queries
 * - Uses admin client to bypass RLS
 * - Swallows all errors (telemetry must never break the main flow)
 *
 * IMPORTANT: Never log prompts, responses, or any PII. Only metadata.
 *
 * @param event - AI usage event metadata
 *
 * @example
 * // Track a cache miss (fresh generation)
 * await trackAiUsage({
 *   featureLabel: "Sanctuary • Daily Light",
 *   route: "/api/insights",
 *   model: "gpt-4o-mini",
 *   promptVersion: 2,
 *   cacheStatus: "miss",
 *   inputTokens: 1500,
 *   outputTokens: 800,
 *   totalTokens: 2300,
 *   userId: "user-123",
 *   timeframe: "today",
 *   periodKey: "2025-12-12",
 *   language: "en",
 *   timezone: "America/New_York",
 *   requestId: "req-abc123",
 * });
 *
 * @example
 * // Track a cache hit (no OpenAI call)
 * await trackAiUsage({
 *   featureLabel: "Sanctuary • Daily Light",
 *   route: "/api/insights",
 *   model: "gpt-4o-mini",
 *   promptVersion: 2,
 *   cacheStatus: "hit",
 *   inputTokens: 0,
 *   outputTokens: 0,
 *   totalTokens: 0,
 *   userId: "user-123",
 *   timeframe: "today",
 *   periodKey: "2025-12-12",
 *   language: "en",
 *   timezone: "America/New_York",
 * });
 */
export async function trackAiUsage(event: AiUsageEvent): Promise<void> {
  try {
    const admin = createAdminSupabaseClient();

    // Defensive total token fallback
    const totalTokens =
      typeof event.totalTokens === "number"
        ? event.totalTokens
        : (event.inputTokens || 0) + (event.outputTokens || 0);

    // Calculate cost in cents for integer storage
    const costCents = estimateCostCents(
      event.model,
      event.inputTokens,
      event.outputTokens
    );

    // Get pricing snapshot for audit trail
    const pricingSnapshot = getPricingSnapshot(event.model);

    // Resolve provider (default to openai)
    const provider = event.provider || PRICING_PROVIDER;

    // Build metadata object with pricing snapshot
    const meta: Record<string, unknown> = {
      cacheStatus: event.cacheStatus,
      promptVersion: event.promptVersion,
      ...(pricingSnapshot && { pricing: pricingSnapshot }),
      ...(event.extraMeta || {}),
    };

    // Insert into ai_usage_events table
    const { error } = await admin.from("ai_usage_events").insert({
      feature_label: event.featureLabel,
      route: event.route,
      model: event.model,
      prompt_version: event.promptVersion,
      cache_status: event.cacheStatus,
      input_tokens: event.inputTokens,
      output_tokens: event.outputTokens,
      total_tokens: totalTokens,
      cost_cents: costCents,
      currency: "usd",
      provider,
      user_id: event.userId || null,
      timeframe: event.timeframe || null,
      period_key: event.periodKey || null,
      language: event.language || null,
      timezone: event.timezone || null,
      request_id: event.requestId || null,
      meta,
    });

    if (error) {
      console.warn(
        `[AI Tracking] Failed to log usage event for ${event.featureLabel}:`,
        error.message
      );
      // Don't return - still try to update rollup
    }

    // Update daily rollup (fire-and-forget, don't await to avoid latency)
    void updateDailyRollup(admin, event, costCents, provider);
  } catch (error: unknown) {
    // Swallow all errors - telemetry must never break the main flow
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[AI Tracking] Unexpected error logging usage event:`, message);
  }
}

/**
 * Update the daily rollup table for fast aggregation queries.
 * Uses upsert to increment counters atomically.
 */
async function updateDailyRollup(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  event: AiUsageEvent,
  costCents: number,
  provider: string
): Promise<void> {
  try {
    // Get today's date in UTC
    const today = new Date().toISOString().split("T")[0];

    // Call the upsert function
    const { error } = await admin.rpc("upsert_ai_usage_rollup", {
      p_day: today,
      p_feature: event.featureLabel,
      p_model: event.model,
      p_provider: provider,
      p_is_cache_hit: event.cacheStatus === "hit",
      p_tokens_in: event.inputTokens,
      p_tokens_out: event.outputTokens,
      p_cost_cents: costCents,
      p_currency: "usd",
    });

    if (error) {
      console.warn(`[AI Tracking] Failed to update daily rollup:`, error.message);
    }
  } catch (error: unknown) {
    // Swallow errors - rollup is optional enhancement
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[AI Tracking] Error updating daily rollup:`, message);
  }
}

/**
 * Get daily usage summary for a date range.
 * Admin/service_role only.
 */
export async function getDailyUsageSummary(
  startDate: string,
  endDate: string
): Promise<{
  totalCalls: number;
  totalCostCents: number;
  totalTokens: number;
  byFeature: Record<string, { calls: number; costCents: number; tokens: number }>;
  byModel: Record<string, { calls: number; costCents: number; tokens: number }>;
} | null> {
  try {
    const admin = createAdminSupabaseClient();

    const { data, error } = await admin
      .from("ai_usage_rollup_daily")
      .select("*")
      .gte("day", startDate)
      .lte("day", endDate);

    if (error || !data) {
      console.warn(`[AI Tracking] Failed to get daily summary:`, error?.message);
      return null;
    }

    let totalCalls = 0;
    let totalCostCents = 0;
    let totalTokens = 0;
    const byFeature: Record<string, { calls: number; costCents: number; tokens: number }> = {};
    const byModel: Record<string, { calls: number; costCents: number; tokens: number }> = {};

    for (const row of data) {
      totalCalls += row.calls;
      totalCostCents += row.cost_cents;
      totalTokens += row.tokens_total;

      // Aggregate by feature
      if (!byFeature[row.feature]) {
        byFeature[row.feature] = { calls: 0, costCents: 0, tokens: 0 };
      }
      byFeature[row.feature].calls += row.calls;
      byFeature[row.feature].costCents += row.cost_cents;
      byFeature[row.feature].tokens += row.tokens_total;

      // Aggregate by model
      if (!byModel[row.model]) {
        byModel[row.model] = { calls: 0, costCents: 0, tokens: 0 };
      }
      byModel[row.model].calls += row.calls;
      byModel[row.model].costCents += row.cost_cents;
      byModel[row.model].tokens += row.tokens_total;
    }

    return { totalCalls, totalCostCents, totalTokens, byFeature, byModel };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[AI Tracking] Error getting daily summary:`, message);
    return null;
  }
}