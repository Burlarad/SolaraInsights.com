import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { InsightsRequest, SanctuaryInsight } from "@/types";
import { getTarotCardNames } from "@/lib/tarot";
import { getRuneNames } from "@/lib/runes";
import { getCache, setCache, acquireLock, releaseLock } from "@/lib/cache/redis";
import { getUserPeriodKeys, buildInsightCacheKey, buildInsightLockKey } from "@/lib/timezone/periodKeys";
import { getEffectiveTimezone } from "@/lib/location/detection";
import { touchLastSeen } from "@/lib/activity/touchLastSeen";
import { trackAiUsage } from "@/lib/ai/trackUsage";
import { AYREN_MODE_SHORT } from "@/lib/ai/voice";

const PROMPT_VERSION = 2;

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

    // Optionally load social summary for Facebook (if available)
    const { data: socialSummary } = await supabase
      .from("social_summaries")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "facebook")
      .order("last_collected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

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

    // Acquire lock to prevent duplicate generation
    const lockAcquired = await acquireLock(lockKey, 60); // 60 second lock

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

      // Still not cached - proceed to generate (lock may have been released)
      console.log(`[Insights] No cached result after wait, generating anyway`);
    } else {
      console.log(`[Insights] ✓ Lock acquired for ${lockKey}, generating insight...`);
    }

    // Construct the OpenAI prompt using Ayren voice
    const systemPrompt = `${AYREN_MODE_SHORT}

CONTEXT:
This is a PERSONALIZED insight for a specific person based on their birth chart and current transits.

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

${socialSummary?.summary ? `Social context (optional, do not mention platforms directly):

${socialSummary.summary}

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
