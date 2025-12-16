import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SocialProvider, SocialIngestRequest } from "@/types";
import {
  generateSocialSummary,
  isValidProvider,
  MAX_PAYLOAD_SIZE,
  SOCIAL_SUMMARY_PROMPT_VERSION,
} from "@/lib/social/summarize";
import { checkRateLimit } from "@/lib/cache/rateLimit";
import { trackAiUsage } from "@/lib/ai/trackUsage";
import { checkBudget, incrementBudget, BUDGET_EXCEEDED_RESPONSE } from "@/lib/ai/costControl";
import { isRedisAvailable, REDIS_UNAVAILABLE_RESPONSE } from "@/lib/cache/redis";
import { OPENAI_MODELS } from "@/lib/openai/client";

// Rate limits
const USER_RATE_LIMIT = 5; // 5 ingests per hour
const USER_RATE_WINDOW = 3600; // 1 hour
const COOLDOWN_SECONDS = 60; // 1 minute between requests

/**
 * POST /api/social/ingest
 *
 * Accepts user-provided social content, generates an AI summary,
 * and stores it in social_summaries.
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in to use Social Insights." },
        { status: 401 }
      );
    }

    console.log(`[SocialIngest:${requestId}] User ${user.id} starting ingest`);

    // Parse and validate request body
    const body: SocialIngestRequest = await req.json();
    const { provider, handle, payload } = body;

    if (!provider || !isValidProvider(provider)) {
      return NextResponse.json(
        { error: "Invalid provider", message: "Please provide a valid social provider." },
        { status: 400 }
      );
    }

    if (!payload || typeof payload !== "string") {
      return NextResponse.json(
        { error: "Missing payload", message: "Please provide social content to analyze." },
        { status: 400 }
      );
    }

    if (payload.length > MAX_PAYLOAD_SIZE) {
      return NextResponse.json(
        { error: "Payload too large", message: `Maximum ${MAX_PAYLOAD_SIZE} characters allowed.` },
        { status: 400 }
      );
    }

    if (payload.trim().length < 100) {
      return NextResponse.json(
        { error: "Payload too short", message: "Please provide at least 100 characters of content." },
        { status: 400 }
      );
    }

    // ========================================
    // RATE LIMITING
    // ========================================
    const rateLimitResult = await checkRateLimit(
      `social:ingest:${user.id}`,
      USER_RATE_LIMIT,
      USER_RATE_WINDOW
    );

    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `You've reached your hourly limit. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
          retryAfterSeconds: retryAfter,
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    // ========================================
    // REDIS + BUDGET CHECKS
    // ========================================
    if (!isRedisAvailable()) {
      console.warn(`[SocialIngest:${requestId}] Redis unavailable`);
      return NextResponse.json(REDIS_UNAVAILABLE_RESPONSE, { status: 503 });
    }

    const budgetCheck = await checkBudget();
    if (!budgetCheck.allowed) {
      console.warn(`[SocialIngest:${requestId}] Budget exceeded`);
      return NextResponse.json(BUDGET_EXCEEDED_RESPONSE, { status: 503 });
    }

    // ========================================
    // UPDATE CONNECTION STATUS TO PROCESSING
    // ========================================
    const { error: upsertConnectionError } = await supabase
      .from("social_connections")
      .upsert(
        {
          user_id: user.id,
          provider,
          handle: handle || null,
          status: "processing",
          last_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" }
      );

    if (upsertConnectionError) {
      console.error(`[SocialIngest:${requestId}] Failed to upsert connection:`, upsertConnectionError);
      return NextResponse.json(
        { error: "Database error", message: "Failed to update connection status." },
        { status: 500 }
      );
    }

    console.log(`[SocialIngest:${requestId}] Generating summary for ${provider}`);

    // ========================================
    // GENERATE AI SUMMARY
    // ========================================
    let summaryResult;
    try {
      summaryResult = await generateSocialSummary(provider, payload, handle);
    } catch (err: any) {
      console.error(`[SocialIngest:${requestId}] Summary generation failed:`, err.message);

      // Update connection to failed status
      await supabase
        .from("social_connections")
        .update({
          status: "failed",
          last_error: err.message,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("provider", provider);

      return NextResponse.json(
        { error: "Generation failed", message: "Unable to generate social insights. Please try again." },
        { status: 500 }
      );
    }

    // Track AI usage
    void trackAiUsage({
      featureLabel: "Social Insights • Ingest",
      route: "/api/social/ingest",
      model: OPENAI_MODELS.fast,
      promptVersion: SOCIAL_SUMMARY_PROMPT_VERSION,
      cacheStatus: "miss",
      inputTokens: summaryResult.inputTokens,
      outputTokens: summaryResult.outputTokens,
      totalTokens: summaryResult.inputTokens + summaryResult.outputTokens,
      userId: user.id,
      timeframe: "social_ingest",
      periodKey: `${provider}:${new Date().toISOString().slice(0, 10)}`,
      language: "en",
      timezone: null,
    });

    void incrementBudget(
      OPENAI_MODELS.fast,
      summaryResult.inputTokens,
      summaryResult.outputTokens
    );

    // ========================================
    // SAVE SUMMARY TO DATABASE
    // ========================================
    // Embed metadata as a parseable JSON block at the end of the summary
    const summaryWithMetadata = `${summaryResult.summary}

<!-- SOCIAL_INSIGHTS_METADATA
${JSON.stringify(summaryResult.metadata)}
-->`;

    const { error: upsertSummaryError } = await supabase
      .from("social_summaries")
      .upsert(
        {
          user_id: user.id,
          provider,
          summary: summaryWithMetadata,
          prompt_version: summaryResult.promptVersion,
          model_version: summaryResult.modelVersion,
          last_collected_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" }
      );

    if (upsertSummaryError) {
      console.error(`[SocialIngest:${requestId}] Failed to save summary:`, upsertSummaryError);

      // Update connection to failed
      await supabase
        .from("social_connections")
        .update({
          status: "failed",
          last_error: "Failed to save summary",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("provider", provider);

      return NextResponse.json(
        { error: "Database error", message: "Failed to save social insights." },
        { status: 500 }
      );
    }

    // ========================================
    // UPDATE CONNECTION STATUS TO READY
    // ========================================
    await supabase
      .from("social_connections")
      .update({
        status: "ready",
        last_ingested_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("provider", provider);

    console.log(`[SocialIngest:${requestId}] Successfully generated summary for ${provider}`);

    return NextResponse.json({
      success: true,
      provider,
      status: "ready",
      summary: summaryResult.summary,
    });
  } catch (error: any) {
    console.error(`[SocialIngest:${requestId}] Unexpected error:`, error.message);
    return NextResponse.json(
      { error: "Server error", message: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
