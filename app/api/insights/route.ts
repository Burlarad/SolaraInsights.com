import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { InsightsRequest, SanctuaryInsight } from "@/types";
import { getTarotCardNames } from "@/lib/tarot";
import { getRuneNames } from "@/lib/runes";
import { getCache, setCache, acquireLockFailClosed, releaseLock, isRedisAvailable, REDIS_UNAVAILABLE_RESPONSE } from "@/lib/cache/redis";
import { checkRateLimit } from "@/lib/cache/rateLimit";
import { getUserPeriodKeys, buildInsightCacheKey, buildInsightLockKey } from "@/lib/timezone/periodKeys";
import { getEffectiveTimezone } from "@/lib/location/detection";
import { touchLastSeen } from "@/lib/activity/touchLastSeen";
import { trackAiUsage } from "@/lib/ai/trackUsage";
import { checkBudget, incrementBudget, BUDGET_EXCEEDED_RESPONSE } from "@/lib/ai/costControl";
import { AYREN_MODE_SHORT, PRO_SOCIAL_NUDGE_INSTRUCTION, HUMOR_INSTRUCTION, LOW_SIGNAL_GUARDRAIL } from "@/lib/ai/voice";
import { parseMetadataFromSummary, getSummaryTextOnly } from "@/lib/social/summarize";

const PROMPT_VERSION = 2;

// P0-3: Rate limits for protected endpoint (per user)
const USER_RATE_LIMIT = 20; // 20 requests per hour
const USER_RATE_WINDOW = 3600; // 1 hour
const COOLDOWN_SECONDS = 30; // 30 second cooldown between requests

/**
 * Check if debug mode is enabled (query param or non-production)
 */
function isDebugMode(req: NextRequest): boolean {
  const debugParam = req.nextUrl.searchParams.get("debug");
  return debugParam === "1" || process.env.NODE_ENV !== "production";
}

/**
 * Get TTL in seconds based on insight timeframe
 * Longer timeframes get longer TTLs since they change less frequently
 */
function getTtlSeconds(timeframe: string): number {
  switch (timeframe) {
    case "today":
      return 172800; // 48 hours
    case "week":
      return 864000; // 10 days
    case "month":
      return 3456000; // 40 days
    case "year":
      return 34560000; // 400 days
    default:
      return 86400; // 24 hours fallback
  }
}

export async function POST(req: NextRequest) {
  // Parse request body first (outside try block for error handling)
  const body: InsightsRequest = await req.json();
  const { timeframe, focusQuestion } = body;

  // Get authenticated user (outside try block so we can use in catch)
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Please sign in to access insights." },
      { status: 401 }
    );
  }

  // Capture user ID for use in error handler
  const userId = user.id;

  // Track user activity (non-blocking)
  const admin = createAdminSupabaseClient();
  void touchLastSeen(admin, user.id, 30);

  // ========================================
  // P0-3: USER RATE LIMITING
  // ========================================
  // Cooldown check
  const cooldownKey = `insights:cooldown:${user.id}`;
  const lastRequestTime = await getCache<number>(cooldownKey);
  if (lastRequestTime) {
    const elapsed = Math.floor((Date.now() - lastRequestTime) / 1000);
    const remaining = COOLDOWN_SECONDS - elapsed;
    if (remaining > 0) {
      return NextResponse.json(
        {
          error: "Cooldown active",
          message: `Please wait ${remaining} seconds before requesting again.`,
          retryAfterSeconds: remaining,
        },
        { status: 429, headers: { "Retry-After": String(remaining) } }
      );
    }
  }

  // Rate limit check
  const rateLimitResult = await checkRateLimit(
    `insights:rate:${user.id}`,
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

  // Set cooldown
  await setCache(cooldownKey, Date.now(), COOLDOWN_SECONDS);

  // Declare periodKey outside try block so it's accessible in error handler
  let periodKey: string | undefined;

  try {

    // Load user's profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        {
          error: "Profile not found",
          message: "Unable to load your profile. Please try again.",
        },
        { status: 404 }
      );
    }

    // Validate required birth details
    if (!profile.birth_date || !profile.timezone) {
      return NextResponse.json(
        {
          error: "Incomplete profile",
          message: "Please complete your birth signature in Settings to receive personalized insights.",
        },
        { status: 400 }
      );
    }

    // Optionally load all social summaries for the user (if any exist)
    const { data: socialSummaries } = await supabase
      .from("social_summaries")
      .select("provider, summary")
      .eq("user_id", user.id)
      .order("last_collected_at", { ascending: false });

    // Parse metadata from first summary (if any) for humor/nudge decisions
    const socialMetadata = socialSummaries && socialSummaries.length > 0
      ? parseMetadataFromSummary(socialSummaries[0].summary)
      : null;

    // Combine all social summaries into a single context block (text only, no metadata block)
    const socialContext = socialSummaries && socialSummaries.length > 0
      ? socialSummaries.map(s => getSummaryTextOnly(s.summary)).join("\n\n---\n\n")
      : null;

    // ========================================
    // CACHING LAYER
    // ========================================

    // Get effective timezone (with UTC fallback if missing)
    const effectiveTimezone = getEffectiveTimezone(profile);

    // Get period keys based on user's timezone
    const periodKeys = getUserPeriodKeys(effectiveTimezone);

    // Select the appropriate period key based on timeframe
    periodKey = timeframe === "today" ? periodKeys.daily
      : timeframe === "week" ? periodKeys.weekly
      : timeframe === "month" ? periodKeys.monthly
      : periodKeys.yearly;

    // Get user's language preference (default to English)
    const targetLanguage = profile.language || "en";

    // Build cache and lock keys
    const cacheKey = buildInsightCacheKey(user.id, timeframe, periodKey, targetLanguage, PROMPT_VERSION);
    const lockKey = buildInsightLockKey(user.id, timeframe, periodKey, PROMPT_VERSION);

    // Check cache first
    const cachedInsight = await getCache<SanctuaryInsight>(cacheKey);
    if (cachedInsight) {
      console.log(`[Insights] ✓ Cache hit for ${cacheKey}`);

      // Track cache hit (no tokens consumed)
      void trackAiUsage({
        featureLabel: "Sanctuary • Daily Light",
        route: "/api/insights",
        model: OPENAI_MODELS.insights,
        promptVersion: PROMPT_VERSION,
        cacheStatus: "hit",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        userId: user.id,
        timeframe,
        periodKey,
        language: targetLanguage,
        timezone: effectiveTimezone,
      });

      // Include debug meta if enabled
      if (isDebugMode(req)) {
        return NextResponse.json({
          ...cachedInsight,
          _debug: {
            timeframe,
            periodKey,
            timezone: effectiveTimezone,
            cacheKey,
            cacheHit: true,
            generatedAt: null, // Unknown for cached responses
            promptVersion: PROMPT_VERSION,
          },
        });
      }

      return NextResponse.json(cachedInsight);
    }

    // Cache miss - need to generate fresh insight
    console.log(`[Insights] ✗ Cache miss for ${cacheKey}`);

    // ========================================
    // P0: REDIS AVAILABILITY CHECK (fail closed)
    // ========================================
    if (!isRedisAvailable()) {
      console.warn("[Insights] Redis unavailable, failing closed");
      return NextResponse.json(REDIS_UNAVAILABLE_RESPONSE, { status: 503 });
    }

    // ========================================
    // P0: BUDGET CHECK (before OpenAI call)
    // ========================================
    const budgetCheck = await checkBudget();
    if (!budgetCheck.allowed) {
      console.warn("[Insights] Budget exceeded, rejecting request");
      return NextResponse.json(BUDGET_EXCEEDED_RESPONSE, { status: 503 });
    }

    // P0: Acquire lock with FAIL-CLOSED behavior
    const lockResult = await acquireLockFailClosed(lockKey, 60);

    if (lockResult.redisDown) {
      console.warn("[Insights] Redis unavailable during lock, failing closed");
      return NextResponse.json(REDIS_UNAVAILABLE_RESPONSE, { status: 503 });
    }

    const lockAcquired = lockResult.acquired;

    if (!lockAcquired) {
      // Another request is already generating this insight
      console.log(`[Insights] Lock already held for ${lockKey}, waiting for cached result...`);

      // Wait a bit and check cache again (likely populated by the other request)
      await new Promise(resolve => setTimeout(resolve, 2000));

      const nowCachedInsight = await getCache<SanctuaryInsight>(cacheKey);
      if (nowCachedInsight) {
        console.log(`[Insights] ✓ Found cached result after lock wait`);
        return NextResponse.json(nowCachedInsight);
      }

      // Still not cached - return 503 to prevent duplicate generation
      console.log(`[Insights] No cached result after wait, returning 503`);
      return NextResponse.json(
        { error: "Generation in progress", message: "Please try again in a moment." },
        { status: 503 }
      );
    } else {
      console.log(`[Insights] ✓ Lock acquired for ${lockKey}, generating insight...`);
    }

    // Build social metadata context for prompt
    const socialMetadataContext = socialMetadata
      ? `
SOCIAL SIGNAL METADATA (internal use only, never mention to user):
- signalStrength: ${socialMetadata.signalStrength}
- accountType: ${socialMetadata.accountType}
- humorEligible: ${socialMetadata.humorEligible}
- humorDial: ${socialMetadata.humorDial}
- humorStyle: ${socialMetadata.humorStyle}`
      : "";

    // Construct the OpenAI prompt using Ayren voice
    const systemPrompt = `${AYREN_MODE_SHORT}
${PRO_SOCIAL_NUDGE_INSTRUCTION}
${HUMOR_INSTRUCTION}
${LOW_SIGNAL_GUARDRAIL}

CONTEXT:
This is a PERSONALIZED insight for a specific person based on their birth chart and current transits.
${socialMetadataContext}

LANGUAGE:
- Write ALL narrative text in language code: ${targetLanguage}
- Field names in JSON remain in English, but all content values must be in the user's language

OUTPUT FORMAT:
Respond with ONLY valid JSON. No markdown, no explanations—just the JSON object.`;

    // Get tarot card and rune names for prompt constraints
    const tarotCardNames = getTarotCardNames();
    const runeNames = getRuneNames();

    const userPrompt = `Generate ${timeframe} insights for ${profile.preferred_name || profile.full_name || "this person"}.

Birth details:
- Date: ${profile.birth_date}
- Time: ${profile.birth_time || "unknown"}
- Location: ${profile.birth_city || "unknown"}, ${profile.birth_region || ""}, ${profile.birth_country || ""}
- Timezone: ${profile.timezone}
- Sign: ${profile.zodiac_sign || "unknown"}

Current date: ${new Date().toISOString()}
Period: ${periodKey} (${timeframe})
Timeframe: ${timeframe}
${focusQuestion ? `Focus question: ${focusQuestion}` : ""}

${socialContext ? `Social context (optional, do not mention platforms directly):

${socialContext}

If this block is empty or missing, ignore it. Use it subtly to enhance your understanding of their emotional tone and expression patterns.` : ""}

IMPORTANT CONSTRAINTS:

For the tarot card:
- You MUST choose exactly one cardName from this list: ${tarotCardNames.join(", ")}.
- Do NOT invent card names outside this list.
- Do NOT claim you are literally drawing from a physical deck.
- Treat the card as a symbolic archetype that fits this person's current energy.

For the rune:
- You MUST choose exactly one name from this list: ${runeNames.join(", ")}.
- Do NOT invent new rune names.
- Do NOT claim you are physically pulling a rune.
- Present it as a symbolic archetype.

Return a JSON object with this structure:
{
  "personalNarrative": "Exactly 2 paragraphs, 8-12 sentences total. Include 1 micro-action (<=10 min). Follow Ayren voice rules.",
  "emotionalCadence": {
    "dawn": "one-word emotional state",
    "midday": "one-word emotional state",
    "dusk": "one-word emotional state"
  },
  "coreThemes": ["theme1", "theme2", "theme3"],
  "focusForPeriod": "one paragraph of practical focus",
  "tarot": {
    "cardName": "card name",
    "arcanaType": "Major or Minor Arcana",
    "summary": "one sentence",
    "symbolism": "one paragraph",
    "guidance": "one paragraph"
  },
  "rune": {
    "name": "rune name",
    "keyword": "one word",
    "meaning": "one paragraph",
    "affirmation": "one sentence"
  },
  "luckyCompass": {
    "numbers": [
      {"value": NUMBER_1_99, "label": "ROOT|PATH|BLOOM", "meaning": "one sentence"},
      {"value": NUMBER_1_99, "label": "ROOT|PATH|BLOOM", "meaning": "one sentence"},
      {"value": NUMBER_1_99, "label": "ROOT|PATH|BLOOM", "meaning": "one sentence"}
    ],
    "powerWords": ["WORD1", "WORD2", "WORD3"],
    "handwrittenNote": "1-2 sentence affirmation"
  },
  "journalPrompt": "A gentle reflection question for their private journal"
}

LUCKY COMPASS RULES:
- Generate 3 DIFFERENT lucky numbers between 1-99 (not duplicates)
- Numbers should feel meaningful for this specific period (${periodKey}) and person
- Each period should produce different numbers - do NOT reuse the same numbers across periods
- Labels should be one of: ROOT (grounding), PATH (direction), BLOOM (growth)
- Power words should be inspiring single words relevant to this period`;

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODELS.insights,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error("No response from OpenAI");
    }

    // Track cache miss (tokens consumed)
    void trackAiUsage({
      featureLabel: "Sanctuary • Daily Light",
      route: "/api/insights",
      model: OPENAI_MODELS.insights,
      promptVersion: PROMPT_VERSION,
      cacheStatus: "miss",
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      totalTokens: completion.usage?.total_tokens || 0,
      userId: user.id,
      timeframe,
      periodKey,
      language: targetLanguage,
      timezone: effectiveTimezone,
    });

    // P0: Increment daily budget counter
    void incrementBudget(
      OPENAI_MODELS.insights,
      completion.usage?.prompt_tokens || 0,
      completion.usage?.completion_tokens || 0
    );

    // Parse and validate the JSON response
    let insight: SanctuaryInsight;
    try {
      insight = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", responseContent);
      throw new Error("Invalid response format from AI");
    }

    // Cache the fresh insight (TTL varies by timeframe)
    const ttlSeconds = getTtlSeconds(timeframe);
    await setCache(cacheKey, insight, ttlSeconds);

    // Release lock after successful generation
    if (lockAcquired) {
      await releaseLock(lockKey);
      console.log(`[Insights] ✓ Lock released for ${lockKey}`);
    }

    // Return the insight with debug meta if enabled
    if (isDebugMode(req)) {
      return NextResponse.json({
        ...insight,
        _debug: {
          timeframe,
          periodKey,
          timezone: effectiveTimezone,
          cacheKey,
          cacheHit: false,
          generatedAt: new Date().toISOString(),
          promptVersion: PROMPT_VERSION,
        },
      });
    }

    return NextResponse.json(insight);
  } catch (error: any) {
    console.error("Error generating insights:", error);

    // Release lock on error (if we got far enough to create one)
    try {
      // Note: periodKey might not be defined if error occurred before caching layer
      if (periodKey) {
        const lockKey = buildInsightLockKey(userId, timeframe, periodKey, PROMPT_VERSION);
        await releaseLock(lockKey);
      }
    } catch (unlockError) {
      console.error("Error releasing lock on failure:", unlockError);
    }

    return NextResponse.json(
      {
        error: "Generation failed",
        message: "We couldn't tune today's insight. Please try again in a moment.",
      },
      { status: 500 }
    );
  }
}
