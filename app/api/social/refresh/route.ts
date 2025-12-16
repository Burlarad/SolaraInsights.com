import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SocialProvider } from "@/types";
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

// Rate limits (same as ingest)
const USER_RATE_LIMIT = 5;
const USER_RATE_WINDOW = 3600;

/**
 * POST /api/social/refresh
 *
 * Re-generates the social summary for a provider with new payload.
 * Essentially the same as ingest but explicitly for re-processing.
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
        { error: "Unauthorized", message: "Please sign in to refresh Social Insights." },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { provider, payload } = body;

    if (!provider || !isValidProvider(provider)) {
      return NextResponse.json(
        { error: "Invalid provider", message: "Please provide a valid social provider." },
        { status: 400 }
      );
    }

    if (!payload || typeof payload !== "string") {
      return NextResponse.json(
        { error: "Missing payload", message: "Please provide new social content to analyze." },
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

    // Check if connection exists
    const { data: existingConnection } = await supabase
      .from("social_connections")
      .select("id, handle")
      .eq("user_id", user.id)
      .eq("provider", provider)
      .single();

    if (!existingConnection) {
      return NextResponse.json(
        { error: "Not found", message: "No existing connection found for this provider." },
        { status: 404 }
      );
    }

    console.log(`[SocialRefresh:${requestId}] User ${user.id} refreshing ${provider}`);

    // ========================================
    // RATE LIMITING
    // ========================================
    const rateLimitResult = await checkRateLimit(
      `social:refresh:${user.id}`,
      USER_RATE_LIMIT,
      USER_RATE_WINDOW
    );

    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `You've reached your hourly limit. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    // Budget check
    if (!isRedisAvailable()) {
      return NextResponse.json(REDIS_UNAVAILABLE_RESPONSE, { status: 503 });
    }

    const budgetCheck = await checkBudget();
    if (!budgetCheck.allowed) {
      return NextResponse.json(BUDGET_EXCEEDED_RESPONSE, { status: 503 });
    }

    // Update status to processing
    await supabase
      .from("social_connections")
      .update({
        status: "processing",
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("provider", provider);

    // Generate new summary
    let summaryResult;
    try {
      summaryResult = await generateSocialSummary(provider, payload, existingConnection.handle);
    } catch (err: any) {
      console.error(`[SocialRefresh:${requestId}] Summary generation failed:`, err.message);

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
        { error: "Generation failed", message: "Unable to refresh social insights." },
        { status: 500 }
      );
    }

    // Track usage
    void trackAiUsage({
      featureLabel: "Social Insights • Refresh",
      route: "/api/social/refresh",
      model: OPENAI_MODELS.fast,
      promptVersion: SOCIAL_SUMMARY_PROMPT_VERSION,
      cacheStatus: "miss",
      inputTokens: summaryResult.inputTokens,
      outputTokens: summaryResult.outputTokens,
      totalTokens: summaryResult.inputTokens + summaryResult.outputTokens,
      userId: user.id,
      timeframe: "social_refresh",
      periodKey: `${provider}:${new Date().toISOString().slice(0, 10)}`,
      language: "en",
      timezone: null,
    });

    void incrementBudget(
      OPENAI_MODELS.fast,
      summaryResult.inputTokens,
      summaryResult.outputTokens
    );

    // Embed metadata as a parseable JSON block at the end of the summary
    const summaryWithMetadata = `${summaryResult.summary}

<!-- SOCIAL_INSIGHTS_METADATA
${JSON.stringify(summaryResult.metadata)}
-->`;

    // Update summary
    const { error: updateError } = await supabase
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

    if (updateError) {
      console.error(`[SocialRefresh:${requestId}] Failed to save summary:`, updateError);

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
        { error: "Database error", message: "Failed to save refreshed insights." },
        { status: 500 }
      );
    }

    // Update connection to ready
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

    console.log(`[SocialRefresh:${requestId}] Successfully refreshed ${provider}`);

    return NextResponse.json({
      success: true,
      provider,
      status: "ready",
      summary: summaryResult.summary,
    });
  } catch (error: any) {
    console.error(`[SocialRefresh:${requestId}] Unexpected error:`, error.message);
    return NextResponse.json(
      { error: "Server error", message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
