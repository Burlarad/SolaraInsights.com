import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { InsightsRequest, SanctuaryInsight } from "@/types";
import { getTarotCardNames } from "@/lib/tarot";
// FEATURE DISABLED: Rune Whisper / Daily Sigil
// import { getRuneNames } from "@/lib/runes";
import { getCache, setCache, acquireLockFailClosed, releaseLock, isRedisAvailable, REDIS_UNAVAILABLE_RESPONSE } from "@/lib/cache/redis";
import { checkRateLimit, checkBurstLimit, createRateLimitResponse } from "@/lib/cache/rateLimit";
import { getUserPeriodKeys, buildInsightCacheKey, buildInsightLockKey } from "@/lib/timezone/periodKeys";
import { getEffectiveTimezone, isValidBirthTimezone } from "@/lib/location/detection";
import { touchLastSeen } from "@/lib/activity/touchLastSeen";
import { trackAiUsage } from "@/lib/ai/trackUsage";
import { logTokenAudit } from "@/lib/ai/tokenAudit";
import { checkBudget, incrementBudget, BUDGET_EXCEEDED_RESPONSE } from "@/lib/ai/costControl";
import { AYREN_MODE_SHORT, PRO_SOCIAL_NUDGE_INSTRUCTION, HUMOR_INSTRUCTION, LOW_SIGNAL_GUARDRAIL } from "@/lib/ai/voice";
import { parseMetadataFromSummary, getSummaryTextOnly } from "@/lib/social/summarize";
import { normalizeInsight } from "@/lib/insights/normalizeInsight";
import { createApiErrorResponse, generateRequestId, INSIGHTS_ERROR_CODES } from "@/lib/api/errorResponse";
import { isUserSocialStale, triggerSocialSyncFireAndForget } from "@/lib/social/staleness";
import { buildYearContext, hasGlobalEventsForYear } from "@/lib/insights/yearContext";
import { loadStoredBirthChart } from "@/lib/birthChart/storage";
import { AYREN_MODE_SOULPRINT_LONG } from "@/lib/ai/voice";
import { resolveLocaleAuth, getCriticalLanguageBlock } from "@/lib/i18n/resolveLocale";
import { localeNames, isValidLocale } from "@/i18n";

// Bump to v4 to invalidate legacy cached insights (year tab now uses global events)
const PROMPT_VERSION = 4;

// Human-friendly rate limits (only applies on cache miss / generation)
// Users can navigate Today→Week→Month→Year freely since cache hits bypass these
const USER_RATE_LIMIT = 60; // 60 generations per hour (generous for heavy users)
const USER_RATE_WINDOW = 3600; // 1 hour
const COOLDOWN_SECONDS = 5; // 5 second cooldown (just enough to prevent spam)
const BURST_LIMIT = 20; // Max 20 requests in 10 seconds (bot defense)
const BURST_WINDOW = 10; // 10 second burst window

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
  const { timeframe, focusQuestion, language: bodyLanguage } = body;

  // Get authenticated user (outside try block so we can use in catch)
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createApiErrorResponse({
      error: "Unauthorized",
      message: "Please sign in to access insights.",
      errorCode: INSIGHTS_ERROR_CODES.UNAUTHORIZED,
      status: 401,
      route: "/api/insights",
    });
  }

  // Capture user ID for use in error handler
  const userId = user.id;

  // Declare periodKey outside try block so it's accessible in error handler
  let periodKey: string | undefined;

  // Create admin client safely - if service role key is missing, we'll skip admin features
  let admin: ReturnType<typeof createAdminSupabaseClient> | null = null;
  try {
    admin = createAdminSupabaseClient();
    // Track user activity (non-blocking)
    void touchLastSeen(admin, user.id, 30);
  } catch (adminError) {
    console.warn("[Insights] Admin client unavailable, skipping activity tracking:", adminError);
    // Continue without admin features - insights should still work
  }

  try {
    // ========================================
    // TIMEFRAME VALIDATION (reject week/month)
    // ========================================
    const ALLOWED_TIMEFRAMES = ["today", "year"];
    if (!ALLOWED_TIMEFRAMES.includes(timeframe)) {
      return createApiErrorResponse({
        error: "Invalid timeframe",
        message: "Only 'today' and 'year' insights are available. Week and month insights are not supported.",
        errorCode: INSIGHTS_ERROR_CODES.INVALID_TIMEFRAME,
        status: 400,
        route: "/api/insights",
      });
    }

    // ========================================
    // PROFILE VALIDATION (before cache check)
    // ========================================

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

    // PR2 Guardrail: Reject UTC timezone (likely from fallback poisoning)
    if (!isValidBirthTimezone(profile.timezone)) {
      console.log(
        `[Insights] Invalid timezone for user ${user.id}: "${profile.timezone}" (UTC fallback detected)`
      );
      return NextResponse.json(
        {
          error: "Invalid timezone",
          message: "Your timezone appears to be incorrectly set to UTC. Please update your birth location in Settings to receive properly timed insights.",
        },
        { status: 400 }
      );
    }

    // ========================================
    // COMPUTE CACHE KEY EARLY
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

    // Get user's language preference with fallback chain:
    // 1. body.language (UI override - allows instant language switch)
    // 2. profile.language (stored preference)
    // 3. cookie → Accept-Language → cf-ipcountry → "en"
    const targetLanguage = (bodyLanguage && isValidLocale(bodyLanguage))
      ? bodyLanguage
      : resolveLocaleAuth(req, profile.language);
    const languageName = localeNames[targetLanguage] || "English";

    // Build cache and lock keys
    const cacheKey = buildInsightCacheKey(user.id, timeframe, periodKey, targetLanguage, PROMPT_VERSION);
    const lockKey = buildInsightLockKey(user.id, timeframe, periodKey, PROMPT_VERSION);

    // ========================================
    // SOCIAL SYNC STALE CHECK (fire-and-forget)
    // Only for "today" timeframe to avoid duplicate syncs
    // Only when social_insights_enabled is true
    // Wrapped in try/catch to never block insights generation
    // ========================================
    if (timeframe === "today" && admin && profile.social_insights_enabled) {
      try {
        const cronSecret = process.env.CRON_SECRET;
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
        const cookieHeader = req.headers.get("cookie") || undefined;

        // Check staleness using admin client (needs service role for social_accounts)
        const isStale = await isUserSocialStale(
          user.id,
          effectiveTimezone,
          profile.last_social_sync_local_date,
          admin
        );

        if (isStale) {
          // Fire and forget - don't await completion
          // Uses CRON_SECRET if available, otherwise forwards cookies for session auth
          void triggerSocialSyncFireAndForget(user.id, baseUrl, cronSecret, cookieHeader);
        }
      } catch (staleSyncError) {
        // Log and continue - social sync failure should never block insights
        console.warn("[Insights] Social stale check failed, skipping:", staleSyncError);
      }
    }

    // ========================================
    // CACHE CHECK FIRST (before rate limiting)
    // Cache hits are FREE - no cooldown, no rate limit
    // ========================================
    const cachedInsight = await getCache<SanctuaryInsight>(cacheKey);
    if (cachedInsight) {
      console.log(`[Insights] ✓ Cache hit for ${cacheKey}`);

      // Select model for tracking (matches generation model)
      const cachedModel = timeframe === "year"
        ? OPENAI_MODELS.yearlyInsights
        : OPENAI_MODELS.dailyInsights;
      const cachedFeatureLabel = timeframe === "year" ? "Sanctuary • Yearly Insight" : "Sanctuary • Daily Light";

      // Track cache hit (no tokens consumed)
      void trackAiUsage({
        featureLabel: cachedFeatureLabel,
        route: "/api/insights",
        model: cachedModel,
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

      // Normalize cached insight to ensure consistent shape
      const normalizedCachedInsight = normalizeInsight(cachedInsight);

      // Include debug meta if enabled
      if (isDebugMode(req)) {
        return NextResponse.json({
          ...normalizedCachedInsight,
          _debug: {
            timeframe,
            periodKey,
            timezone: effectiveTimezone,
            cacheKey,
            cacheHit: true,
            generatedAt: null,
            promptVersion: PROMPT_VERSION,
          },
        });
      }

      return NextResponse.json(normalizedCachedInsight);
    }

    // ========================================
    // CACHE MISS - Apply rate limiting now
    // Only generation attempts count toward limits
    // ========================================
    console.log(`[Insights] ✗ Cache miss for ${cacheKey}`);

    // Burst check first (bot defense - 20 requests in 10 seconds)
    const burstResult = await checkBurstLimit(`insights:${user.id}`, BURST_LIMIT, BURST_WINDOW);
    if (!burstResult.success) {
      const retryAfter = Math.ceil((burstResult.resetAt - Date.now()) / 1000);
      return createApiErrorResponse({
        error: "rate_limited",
        message: "Slow down — you're generating insights too quickly.",
        errorCode: INSIGHTS_ERROR_CODES.RATE_LIMIT,
        status: 429,
        retryAfterSeconds: retryAfter,
        route: "/api/insights",
      });
    }

    // Cooldown check (only for generation attempts)
    const cooldownKey = `insights:cooldown:${user.id}`;
    const lastRequestTime = await getCache<number>(cooldownKey);
    if (lastRequestTime) {
      const elapsed = Math.floor((Date.now() - lastRequestTime) / 1000);
      const remaining = COOLDOWN_SECONDS - elapsed;
      if (remaining > 0) {
        return createApiErrorResponse({
          error: "rate_limited",
          message: "Just a moment — your next insight is brewing.",
          errorCode: INSIGHTS_ERROR_CODES.COOLDOWN,
          status: 429,
          retryAfterSeconds: remaining,
          route: "/api/insights",
        });
      }
    }

    // Sustained rate limit check (60 generations per hour)
    const rateLimitResult = await checkRateLimit(
      `insights:rate:${user.id}`,
      USER_RATE_LIMIT,
      USER_RATE_WINDOW
    );
    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
      return createApiErrorResponse({
        error: "rate_limited",
        message: `You've reached your hourly limit. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
        errorCode: INSIGHTS_ERROR_CODES.RATE_LIMIT,
        status: 429,
        retryAfterSeconds: retryAfter,
        route: "/api/insights",
      });
    }

    // Set cooldown NOW (we're about to generate)
    await setCache(cooldownKey, Date.now(), COOLDOWN_SECONDS);

    // Load social summaries only when social_insights is enabled
    // This gates the entire social context feature on the user's preference
    let socialSummaries: { provider: string; summary: string }[] | null = null;
    if (profile.social_insights_enabled) {
      const { data } = await supabase
        .from("social_summaries")
        .select("provider, summary")
        .eq("user_id", user.id)
        .order("last_fetched_at", { ascending: false });
      socialSummaries = data;
    }

    // Parse metadata from first summary (if any) for humor/nudge decisions
    const socialMetadata = socialSummaries && socialSummaries.length > 0
      ? parseMetadataFromSummary(socialSummaries[0].summary)
      : null;

    // Combine all social summaries into a single context block (text only, no metadata block)
    const socialContext = socialSummaries && socialSummaries.length > 0
      ? socialSummaries.map(s => getSummaryTextOnly(s.summary)).join("\n\n---\n\n")
      : null;

    // ========================================
    // YEAR CONTEXT: Load global events + user transits for year tab
    // ========================================
    let yearContext: string | null = null;
    if (timeframe === "year") {
      const currentYear = new Date().getFullYear();
      console.log(`[Insights] Loading year context for ${currentYear}`);

      // Check if global events exist for this year
      const hasEvents = await hasGlobalEventsForYear(supabase, currentYear);

      if (hasEvents) {
        // Try to load user's natal placements for transit calculation
        let natalPlacements: Array<{ name: string; longitude: number | null }> = [];
        try {
          const birthChart = await loadStoredBirthChart(user.id);
          if (birthChart?.placements?.planets) {
            natalPlacements = birthChart.placements.planets.map((p) => ({
              name: p.name,
              longitude: p.longitude,
            }));
            console.log(`[Insights] Loaded ${natalPlacements.length} natal placements for transit calculation`);
          }
        } catch (birthChartError) {
          console.warn("[Insights] Failed to load birth chart for transits:", birthChartError);
          // Continue without user transits - global events still valuable
        }

        // Build year context with global events + optional user transits
        try {
          const context = await buildYearContext(supabase, currentYear, natalPlacements);
          yearContext = context.formattedContext;
          console.log(`[Insights] Built year context: ${context.globalEvents.length} global events, ${context.userTransits.length} user transits`);
        } catch (contextError) {
          console.error("[Insights] Failed to build year context:", contextError);
          // Continue without year context - AI can still generate generic yearly insight
        }
      } else {
        console.log(`[Insights] No global events for ${currentYear}, generating without astrological context`);
      }
    }

    // ========================================
    // P0: REDIS AVAILABILITY CHECK (fail closed)
    // ========================================
    if (!isRedisAvailable()) {
      console.warn("[Insights] Redis unavailable, failing closed");
      return createApiErrorResponse({
        error: "service_unavailable",
        message: "Our cosmic connection is temporarily down. Please try again shortly.",
        errorCode: INSIGHTS_ERROR_CODES.REDIS_UNAVAILABLE,
        status: 503,
        route: "/api/insights",
      });
    }

    // ========================================
    // P0: BUDGET CHECK (before OpenAI call)
    // ========================================
    const budgetCheck = await checkBudget();
    if (!budgetCheck.allowed) {
      console.warn("[Insights] Budget exceeded, rejecting request");
      return createApiErrorResponse({
        error: "service_unavailable",
        message: "The cosmic treasury needs to restock. Try again later.",
        errorCode: INSIGHTS_ERROR_CODES.BUDGET_EXCEEDED,
        status: 503,
        route: "/api/insights",
      });
    }

    // P0: Acquire lock with FAIL-CLOSED behavior
    const lockResult = await acquireLockFailClosed(lockKey, 60);

    if (lockResult.redisDown) {
      console.warn("[Insights] Redis unavailable during lock, failing closed");
      return createApiErrorResponse({
        error: "service_unavailable",
        message: "Our cosmic connection is temporarily down. Please try again shortly.",
        errorCode: INSIGHTS_ERROR_CODES.REDIS_UNAVAILABLE,
        status: 503,
        route: "/api/insights",
      });
    }

    const lockAcquired = lockResult.acquired;

    if (!lockAcquired) {
      // Another request is already generating this insight
      // PR-2: Retry loop instead of failing fast
      console.log(`[Insights] Lock already held for ${lockKey}, entering retry loop...`);

      const MAX_RETRIES = 3;
      const RETRY_DELAY_MS = 2000;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        console.log(`[Insights] Retry ${attempt}/${MAX_RETRIES}: waiting ${RETRY_DELAY_MS}ms for cached result...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));

        const nowCachedInsight = await getCache<SanctuaryInsight>(cacheKey);
        if (nowCachedInsight) {
          console.log(`[Insights] ✓ Found cached result on retry ${attempt}`);
          return NextResponse.json(normalizeInsight(nowCachedInsight));
        }
      }

      // Still not cached after all retries - return user-friendly response
      console.log(`[Insights] No cached result after ${MAX_RETRIES} retries, returning 503`);
      return createApiErrorResponse({
        error: "still_generating",
        message: "Your insight is being created. Please try again in a moment.",
        errorCode: INSIGHTS_ERROR_CODES.LOCK_BUSY,
        status: 503,
        route: "/api/insights",
      });
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

    // Construct the OpenAI prompt using appropriate Ayren voice
    // Year tab uses long-form voice for expansive yearly narrative
    const ayrenVoice = timeframe === "year" ? AYREN_MODE_SOULPRINT_LONG : AYREN_MODE_SHORT;

    const languageBlock = getCriticalLanguageBlock(languageName, targetLanguage);

    const systemPrompt = `${ayrenVoice}
${PRO_SOCIAL_NUDGE_INSTRUCTION}
${HUMOR_INSTRUCTION}
${LOW_SIGNAL_GUARDRAIL}

CONTEXT:
This is a PERSONALIZED insight for a specific person based on their birth chart and current transits.
${socialMetadataContext}

${languageBlock}

OUTPUT FORMAT:
Respond with ONLY valid JSON. No markdown, no explanations—just the JSON object.`;

    // Get tarot card names for prompt constraints
    const tarotCardNames = getTarotCardNames();
    // FEATURE DISABLED: Rune Whisper / Daily Sigil
    // const runeNames = getRuneNames();

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

${yearContext ? `
ASTROLOGICAL YEAR CONTEXT (use this to personalize the yearly insight):

${yearContext}

Use this astronomical data to create a meaningful yearly narrative. Reference specific planetary events and personal transits where relevant.
` : ""}

${socialContext ? `Social context (optional, do not mention platforms directly):

${socialContext}

If this block is empty or missing, ignore it. Use it subtly to enhance your understanding of their emotional tone and expression patterns.` : ""}

IMPORTANT CONSTRAINTS:

For the tarot card:
- You MUST choose exactly one cardName from this list: ${tarotCardNames.join(", ")}.
- Do NOT invent card names outside this list.
- Do NOT claim you are literally drawing from a physical deck.
- Treat the card as a symbolic archetype that fits this person's current energy.

Return a JSON object with this structure:
{
  "personalNarrative": "Exactly 2 paragraphs, 8-12 sentences total. Include 1 micro-action (<=10 min). Follow Ayren voice rules.",
  "emotionalCadence": {
    "dawn": "one-word emotional state for sunrise",
    "midday": "one-word emotional state for noon",
    "dusk": "one-word emotional state for sunset",
    "evening": "one-word emotional state for after sunset",
    "midnight": "one-word emotional state for midnight",
    "morning": "one-word emotional state for pre-dawn"
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

    // Select model based on timeframe:
    // - "today" → gpt-4.1-mini (daily, cheap)
    // - "year" → gpt-5.1 (premium, cached for full year)
    const selectedModel = timeframe === "year"
      ? OPENAI_MODELS.yearlyInsights
      : OPENAI_MODELS.dailyInsights;

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: selectedModel,
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
    const featureLabel = timeframe === "year" ? "Sanctuary • Yearly Insight" : "Sanctuary • Daily Light";
    void trackAiUsage({
      featureLabel,
      route: "/api/insights",
      model: selectedModel,
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

    // Token audit logging
    logTokenAudit({
      route: "/api/insights",
      featureLabel,
      model: selectedModel,
      cacheStatus: "miss",
      promptVersion: PROMPT_VERSION,
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      language: targetLanguage,
      timeframe,
    });

    // P0: Increment daily budget counter
    void incrementBudget(
      selectedModel,
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

    // Normalize the insight to ensure consistent shape before caching
    const normalizedInsight = normalizeInsight(insight);

    // Cache the normalized insight (TTL varies by timeframe)
    const ttlSeconds = getTtlSeconds(timeframe);
    await setCache(cacheKey, normalizedInsight, ttlSeconds);

    // Release lock after successful generation
    if (lockAcquired) {
      await releaseLock(lockKey);
      console.log(`[Insights] ✓ Lock released for ${lockKey}`);
    }

    // Return the normalized insight with debug meta if enabled
    if (isDebugMode(req)) {
      return NextResponse.json({
        ...normalizedInsight,
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

    return NextResponse.json(normalizedInsight);
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

    return createApiErrorResponse({
      error: "generation_failed",
      message: "We couldn't tune today's insight. Please try again in a moment.",
      errorCode: INSIGHTS_ERROR_CODES.PROVIDER_ERROR,
      status: 500,
      route: "/api/insights",
    });
  }
}
