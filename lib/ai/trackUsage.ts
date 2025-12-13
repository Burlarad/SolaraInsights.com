import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { estimateCostUsd } from "./pricing";

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
};

/**
 * Track AI usage event to Supabase for cost monitoring and analytics.
 *
 * This function:
 * - Calculates estimated cost based on token usage and model
 * - Inserts a record into public.ai_usage_events table
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

    // Calculate estimated cost
    const estimatedCostUsd = estimateCostUsd(
      event.model,
      event.inputTokens,
      event.outputTokens
    );

    // Insert into ai_usage_events table
    const { error } = await admin.from("ai_usage_events").insert({
      feature_label: event.featureLabel,
      route: event.route,
      model: event.model,
      prompt_version: event.promptVersion,
      cache_status: event.cacheStatus,
      input_tokens: event.inputTokens,
      output_tokens: event.outputTokens,
      total_tokens: event.totalTokens,
      estimated_cost_usd: estimatedCostUsd,
      user_id: event.userId || null,
      timeframe: event.timeframe || null,
      period_key: event.periodKey || null,
      language: event.language || null,
      timezone: event.timezone || null,
    });

    if (error) {
      console.warn(
        `[AI Tracking] Failed to log usage event for ${event.featureLabel}:`,
        error.message
      );
    }
  } catch (error: any) {
    // Swallow all errors - telemetry must never break the main flow
    console.warn(
      `[AI Tracking] Unexpected error logging usage event:`,
      error.message
    );
  }
}
