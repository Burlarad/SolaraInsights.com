import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { DailyBrief } from "@/types";
import { getCache, setCache, getDayKey } from "@/lib/cache";
import { acquireLockFailClosed, releaseLock, isRedisAvailable, REDIS_UNAVAILABLE_RESPONSE } from "@/lib/cache/redis";
import { checkRateLimit, checkBurstLimit, createRateLimitResponse } from "@/lib/cache/rateLimit";
import { touchLastSeen } from "@/lib/activity/touchLastSeen";
import { trackAiUsage } from "@/lib/ai/trackUsage";
import { checkBudget, incrementBudget, BUDGET_EXCEEDED_RESPONSE } from "@/lib/ai/costControl";
import { AYREN_MODE_SHORT, PRO_SOCIAL_NUDGE_INSTRUCTION, HUMOR_INSTRUCTION, LOW_SIGNAL_GUARDRAIL } from "@/lib/ai/voice";
import { parseMetadataFromSummary, getSummaryTextOnly } from "@/lib/social/summarize";
import { logTokenAudit } from "@/lib/ai/tokenAudit";

// Human-friendly rate limits for connection briefs (only on cache miss)
// Connections page may load many cards at once, so limits are generous
const USER_RATE_LIMIT = 120; // 120 generations per hour (generous for many connections)
const USER_RATE_WINDOW = 3600; // 1 hour
const COOLDOWN_SECONDS = 2; // 2 second cooldown (very short - cards load in parallel)
const BURST_LIMIT = 30; // Max 30 requests in 10 seconds (bot defense, but allow parallel loads)
const BURST_WINDOW = 10; // 10 second burst window

const PROMPT_VERSION = 1;

/**
 * Daily Connection Brief API (Layer A)
 *
 * Returns a light "weather report" for the connection today.
 * - Generated on-demand when user opens a connection
 * - Saved to DB and immutable for that day
 * - Uses local date based on user's timezone
 */
export async function POST(req: NextRequest) {
  let lockKey: string | undefined;
  let lockAcquired = false;

  try {
    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in to view connection briefs." },
        { status: 401 }
      );
    }

    // Track user activity (non-blocking)
    const admin = createAdminSupabaseClient();
    void touchLastSeen(admin, user.id, 30);

    // ========================================
    // VALIDATION (before cache check)
    // ========================================

    // Parse request body
    const body = await req.json();
    const { connectionId } = body;

    if (!connectionId) {
      return NextResponse.json(
        { error: "Bad request", message: "Connection ID is required." },
        { status: 400 }
      );
    }

    // Load user's profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found", message: "Unable to load your profile." },
        { status: 404 }
      );
    }

    // Load connection
    const { data: connection, error: connectionError } = await supabase
      .from("connections")
      .select("*")
      .eq("id", connectionId)
      .eq("owner_user_id", user.id)
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: "Connection not found", message: "This connection doesn't exist or you don't have access to it." },
        { status: 404 }
      );
    }

    // ========================================
    // CALCULATE LOCAL DATE
    // ========================================
    const timezone = profile.timezone || "America/New_York";
    const localDateKey = getDayKey(timezone);
    const localDate = localDateKey.replace("day:", ""); // "YYYY-MM-DD"
    const language = profile.language || "en";

    // ========================================
    // LOAD SOCIAL SUMMARIES (if any)
    // ========================================
    const { data: ownerSocialSummaries } = await supabase
      .from("social_summaries")
      .select("summary")
      .eq("user_id", user.id);

    const ownerSocialMetadata = ownerSocialSummaries && ownerSocialSummaries.length > 0
      ? parseMetadataFromSummary(ownerSocialSummaries[0].summary)
      : null;

    // ========================================
    // CHECK DB FOR EXISTING BRIEF
    // ========================================
    const { data: existingBrief } = await supabase
      .from("daily_briefs")
      .select("*")
      .eq("connection_id", connectionId)
      .eq("local_date", localDate)
      .eq("language", language)
      .eq("prompt_version", PROMPT_VERSION)
      .single();

    if (existingBrief) {
      console.log(`[DailyBrief] Found existing brief for ${connectionId} on ${localDate}`);
      return NextResponse.json(existingBrief);
    }

    console.log(`[DailyBrief] No existing brief for ${connectionId} on ${localDate}, generating...`);

    // ========================================
    // CACHE MISS - Apply rate limiting now
    // Only generation attempts count toward limits
    // ========================================

    // Burst check first (bot defense - 30 requests in 10 seconds, generous for parallel card loads)
    const burstResult = await checkBurstLimit(`connbrief:${user.id}`, BURST_LIMIT, BURST_WINDOW);
    if (!burstResult.success) {
      const retryAfter = Math.ceil((burstResult.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        createRateLimitResponse(retryAfter, "Slow down — your connection briefs are loading."),
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    // Cooldown check (only for generation attempts)
    const cooldownKey = `connbrief:cooldown:${user.id}`;
    const lastRequestTime = await getCache<number>(cooldownKey);
    if (lastRequestTime) {
      const elapsed = Math.floor((Date.now() - lastRequestTime) / 1000);
      const remaining = COOLDOWN_SECONDS - elapsed;
      if (remaining > 0) {
        return NextResponse.json(
          createRateLimitResponse(remaining, "Just a moment — briefs are still loading."),
          { status: 429, headers: { "Retry-After": String(remaining) } }
        );
      }
    }

    // Sustained rate limit check (120 generations per hour)
    const rateLimitResult = await checkRateLimit(
      `connbrief:rate:${user.id}`,
      USER_RATE_LIMIT,
      USER_RATE_WINDOW
    );
    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        createRateLimitResponse(retryAfter, `You've reached your hourly limit. Try again in ${Math.ceil(retryAfter / 60)} minutes.`),
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    // Set cooldown NOW (we're about to generate)
    await setCache(cooldownKey, Date.now(), COOLDOWN_SECONDS);

    // ========================================
    // REDIS AVAILABILITY CHECK
    // ========================================
    if (!isRedisAvailable()) {
      console.warn("[DailyBrief] Redis unavailable, failing closed");
      return NextResponse.json(REDIS_UNAVAILABLE_RESPONSE, { status: 503 });
    }

    // ========================================
    // BUDGET CHECK
    // ========================================
    const budgetCheck = await checkBudget();
    if (!budgetCheck.allowed) {
      console.warn("[DailyBrief] Budget exceeded, rejecting request");
      return NextResponse.json(BUDGET_EXCEEDED_RESPONSE, { status: 503 });
    }

    // ========================================
    // ACQUIRE LOCK
    // ========================================
    lockKey = `lock:dailybrief:v${PROMPT_VERSION}:${connectionId}:${localDate}:${language}`;
    const lockResult = await acquireLockFailClosed(lockKey, 60);

    if (lockResult.redisDown) {
      return NextResponse.json(REDIS_UNAVAILABLE_RESPONSE, { status: 503 });
    }

    lockAcquired = lockResult.acquired;

    if (!lockAcquired) {
      // Another request is generating - PR-2: retry loop instead of failing fast
      console.log(`[DailyBrief] Lock already held for ${lockKey}, entering retry loop...`);

      const MAX_RETRIES = 3;
      const RETRY_DELAY_MS = 2000;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        console.log(`[DailyBrief] Retry ${attempt}/${MAX_RETRIES}: waiting ${RETRY_DELAY_MS}ms for cached result...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));

        const { data: nowExistingBrief } = await supabase
          .from("daily_briefs")
          .select("*")
          .eq("connection_id", connectionId)
          .eq("local_date", localDate)
          .eq("language", language)
          .eq("prompt_version", PROMPT_VERSION)
          .single();

        if (nowExistingBrief) {
          console.log(`[DailyBrief] ✓ Found cached result on retry ${attempt}`);
          return NextResponse.json(nowExistingBrief);
        }
      }

      // Still not cached after all retries - return user-friendly response
      console.log(`[DailyBrief] No cached result after ${MAX_RETRIES} retries, returning 503`);
      return NextResponse.json(
        { error: "Still generating", message: "Your connection brief is being created. Please try again in a moment." },
        { status: 503 }
      );
    }

    // ========================================
    // GENERATE DAILY BRIEF
    // ========================================
    const getToneGuidance = (type: string): string => {
      const t = type.toLowerCase();
      if (t === "partner") {
        return "Warm, affectionate tone is appropriate. May reference closeness and partnership.";
      } else if (t === "friend" || t === "colleague") {
        return "Warm, platonic tone. Never romance-coded. Focus on mutual support and camaraderie.";
      } else if (t === "parent" || t === "child" || t === "sibling") {
        return "Family-appropriate tone. Focus on unconditional bonds and care.";
      }
      return "Warm, neutral tone. Default to friend-safe content.";
    };

    const toneGuidance = getToneGuidance(connection.relationship_type);
    const connectionName = connection.name;

    // Build social metadata context for prompt
    const socialMetadataContext = ownerSocialMetadata
      ? `
SOCIAL SIGNAL METADATA (internal use only, never mention to user):
- signalStrength: ${ownerSocialMetadata.signalStrength}
- accountType: ${ownerSocialMetadata.accountType}
- humorEligible: ${ownerSocialMetadata.humorEligible}
- humorDial: ${ownerSocialMetadata.humorDial}
- humorStyle: ${ownerSocialMetadata.humorStyle}`
      : "";

    const systemPrompt = `${AYREN_MODE_SHORT}
${PRO_SOCIAL_NUDGE_INSTRUCTION}
${HUMOR_INSTRUCTION}
${LOW_SIGNAL_GUARDRAIL}

You are generating a DAILY CONNECTION BRIEF - a light, general "weather report" for the connection today.

CONTEXT:
This is a ${connection.relationship_type} connection with ${connectionName}.
${socialMetadataContext}

TONE GUIDANCE:
${toneGuidance}

NAMING RULES (STRICT):
- Always use "you" when referring to the person reading this
- Always use "${connectionName}" when referring to the other person
- NEVER use "Person 1", "Person 2", or any impersonal labels
- Use "you and ${connectionName}" phrasing throughout

SAFETY RULES (STRICT):
- This is a GENERAL "weather report" - NOT a detailed analysis
- Never claim to know ${connectionName}'s private thoughts or feelings
- Never be creepy, coercive, or manipulative
- Never give advice to manipulate or trigger ${connectionName}
- Keep it uplifting and general
- Use "may," "might," "could" — not "will" or "is"

OUTPUT FORMAT:
Return ONLY valid JSON:
{
  "title": "Today with ${connectionName}",
  "shared_vibe": "2-4 sentences describing the shared energy today. General, warm, non-invasive. Like a weather report for the connection.",
  "ways_to_show_up": [
    "Action-verb bullet 1 (e.g., 'Listen for what isn't being said')",
    "Action-verb bullet 2 (e.g., 'Share a small appreciation')",
    "Action-verb bullet 3 (e.g., 'Give space when needed')"
  ],
  "nudge": "Optional single line micro-nudge, or null if not needed. Must be gentle, never pushy."
}`;

    const userPrompt = `Generate a daily connection brief for ${connectionName} (${connection.relationship_type}).

The brief should feel like a gentle morning weather report for the connection - light, warm, and supportive.

Ways to show up bullets must:
- Start with an action verb
- Be completable in 10 minutes or less
- Be appropriate for a ${connection.relationship_type} relationship

Return the JSON object now.`;

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODELS.connectionBrief,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.75,
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error("No response from OpenAI");
    }

    // Track usage
    void trackAiUsage({
      featureLabel: "Connections • Daily Brief",
      route: "/api/connection-brief",
      model: OPENAI_MODELS.connectionBrief,
      promptVersion: PROMPT_VERSION,
      cacheStatus: "miss",
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      totalTokens: completion.usage?.total_tokens || 0,
      userId: user.id,
      timeframe: "today",
      periodKey: localDateKey,
      language,
      timezone,
    });

    void incrementBudget(
      OPENAI_MODELS.connectionBrief,
      completion.usage?.prompt_tokens || 0,
      completion.usage?.completion_tokens || 0
    );

    // Token audit logging
    logTokenAudit({
      route: "/api/connection-brief",
      featureLabel: "Connections • Daily Brief",
      model: OPENAI_MODELS.connectionBrief,
      cacheStatus: "miss",
      promptVersion: PROMPT_VERSION,
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      language,
      timeframe: "today",
    });

    // Parse response
    let briefContent: {
      title: string;
      shared_vibe: string;
      ways_to_show_up: string[];
      nudge: string | null;
    };

    try {
      briefContent = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("[DailyBrief] Failed to parse OpenAI response:", responseContent);
      throw new Error("Invalid response format from AI");
    }

    // Validate required fields
    if (!briefContent.title || !briefContent.shared_vibe || !Array.isArray(briefContent.ways_to_show_up)) {
      throw new Error("Missing required fields in AI response");
    }

    // Ensure exactly 3 ways_to_show_up
    if (briefContent.ways_to_show_up.length !== 3) {
      console.warn(`[DailyBrief] Got ${briefContent.ways_to_show_up.length} ways_to_show_up, expected 3`);
      // Pad or truncate to 3
      while (briefContent.ways_to_show_up.length < 3) {
        briefContent.ways_to_show_up.push("Be present and attentive");
      }
      briefContent.ways_to_show_up = briefContent.ways_to_show_up.slice(0, 3);
    }

    // ========================================
    // SAVE TO DATABASE
    // ========================================
    const { data: savedBrief, error: saveError } = await supabase
      .from("daily_briefs")
      .insert({
        connection_id: connectionId,
        owner_user_id: user.id,
        local_date: localDate,
        language,
        prompt_version: PROMPT_VERSION,
        model_version: OPENAI_MODELS.connectionBrief,
        title: briefContent.title,
        shared_vibe: briefContent.shared_vibe,
        ways_to_show_up: briefContent.ways_to_show_up,
        nudge: briefContent.nudge || null,
      })
      .select()
      .single();

    if (saveError) {
      console.error("[DailyBrief] Failed to save to DB:", saveError);
      // Still return the brief even if save fails
      return NextResponse.json({
        ...briefContent,
        connection_id: connectionId,
        local_date: localDate,
        _saved: false,
      });
    }

    // Release lock
    if (lockAcquired) {
      await releaseLock(lockKey!);
    }

    console.log(`[DailyBrief] Generated and saved brief for ${connectionId} on ${localDate}`);
    return NextResponse.json(savedBrief);

  } catch (error: any) {
    console.error("[DailyBrief] Error:", error);

    // Release lock on error
    try {
      if (lockAcquired && lockKey) {
        await releaseLock(lockKey);
      }
    } catch (unlockError) {
      console.error("[DailyBrief] Error releasing lock:", unlockError);
    }

    return NextResponse.json(
      { error: "Generation failed", message: "Unable to generate daily brief. Please try again." },
      { status: 500 }
    );
  }
}
