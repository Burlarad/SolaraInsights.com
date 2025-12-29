import { NextRequest, NextResponse } from "next/server";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { PublicHoroscopeResponse } from "@/types";
import { getCache, setCache, getDayKey, acquireLockFailClosed, releaseLock, REDIS_UNAVAILABLE_RESPONSE } from "@/lib/cache/redis";
import { checkRateLimit, checkBurstLimit, getClientIP, createRateLimitResponse } from "@/lib/cache/rateLimit";
import { trackAiUsage } from "@/lib/ai/trackUsage";
import { checkBudget, incrementBudget, BUDGET_EXCEEDED_RESPONSE } from "@/lib/ai/costControl";
import { publicHoroscopeSchema, validateRequest } from "@/lib/validation/schemas";
import { logTokenAudit } from "@/lib/ai/tokenAudit";
import { AYREN_MODE_SHORT } from "@/lib/ai/voice";

// Rate limits (per IP - anonymous endpoint)
// Human-friendly: cache hits are FREE, only cache misses count toward limits
const RATE_LIMIT = 60; // 60 requests per hour per IP
const RATE_WINDOW_SECONDS = 3600; // 1 hour
const BURST_LIMIT = 10; // Max 10 requests in 10 seconds (anonymous = stricter)
const BURST_WINDOW = 10;

const PROMPT_VERSION = 2;

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req);

  let lockKey: string | undefined;
  let lockAcquired = false;

  try {
    // Validate request body
    const validation = await validateRequest(req, publicHoroscopeSchema);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", message: validation.error },
        { status: 400 }
      );
    }

    const { sign, timeframe, timezone, language } = validation.data;
    const targetLanguage = language || "en";

    // Title-case the sign for display in prompts (e.g., "aries" -> "Aries")
    const signDisplayName = sign.charAt(0).toUpperCase() + sign.slice(1);

    // ========================================
    // CACHING LAYER (check cache BEFORE rate limiting)
    // ========================================

    // Use timezone to compute a day key (public horoscopes refresh daily regardless of timeframe)
    const periodKey = getDayKey(timezone);
    const cacheKey = `publicHoroscope:v1:p${PROMPT_VERSION}:${sign}:${timeframe}:${periodKey}:${targetLanguage}`;

    // Check cache - cache hits are FREE (no rate limiting)
    const cachedHoroscope = await getCache<PublicHoroscopeResponse>(cacheKey);
    if (cachedHoroscope) {
      console.log(`[PublicHoroscope] Cache hit for ${cacheKey}`);

      // Track cache hit (no tokens consumed)
      void trackAiUsage({
        featureLabel: "Home • Public Horoscope",
        route: "/api/public-horoscope",
        model: OPENAI_MODELS.horoscope,
        promptVersion: PROMPT_VERSION,
        cacheStatus: "hit",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        userId: null,
        timeframe,
        periodKey,
        language: targetLanguage,
        timezone,
      });

      return NextResponse.json(cachedHoroscope);
    }

    console.log(`[PublicHoroscope] Cache miss for ${cacheKey}, generating fresh horoscope...`);

    // ========================================
    // RATE LIMITING (only on cache miss - cache hits are FREE)
    // ========================================

    // Burst protection (bot defense - stricter for anonymous)
    const burstResult = await checkBurstLimit(`pubhoroscope:${clientIP}`, BURST_LIMIT, BURST_WINDOW);
    if (!burstResult.success) {
      return NextResponse.json(
        createRateLimitResponse(BURST_WINDOW, "You're moving too fast — slow down a bit."),
        { status: 429, headers: { "Retry-After": String(BURST_WINDOW) } }
      );
    }

    // Sustained rate limit check
    const rateLimitResult = await checkRateLimit(
      `pubhoroscope:rate:${clientIP}`,
      RATE_LIMIT,
      RATE_WINDOW_SECONDS
    );
    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        createRateLimitResponse(retryAfter, "Too many horoscope requests. Please try again later."),
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    // ========================================
    // P0: BUDGET CHECK (before OpenAI call)
    // ========================================
    const budgetCheck = await checkBudget();
    if (!budgetCheck.allowed) {
      console.warn(`[PublicHoroscope] Budget exceeded, rejecting request`);
      return NextResponse.json(BUDGET_EXCEEDED_RESPONSE, { status: 503 });
    }

    // Build lock key to prevent stampeding herd
    lockKey = `lock:publicHoroscope:p${PROMPT_VERSION}:${sign}:${timeframe}:${periodKey}:${targetLanguage}`;

    // P0: Try to acquire lock with FAIL-CLOSED behavior
    const lockResult = await acquireLockFailClosed(lockKey, 60);

    // If Redis is down, fail closed (don't proceed with expensive OpenAI call)
    if (lockResult.redisDown) {
      console.warn(`[PublicHoroscope] Redis unavailable, failing closed`);
      return NextResponse.json(REDIS_UNAVAILABLE_RESPONSE, { status: 503 });
    }

    lockAcquired = lockResult.acquired;

    if (!lockAcquired) {
      // Another request is already generating this horoscope
      // PR-2: Retry loop - wait and check cache multiple times
      console.log(`[PublicHoroscope] Lock already held for ${lockKey}, waiting for cached result...`);

      const maxRetries = 3;
      const retryDelay = 2000; // 2 seconds between retries

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));

        const nowCachedHoroscope = await getCache<PublicHoroscopeResponse>(cacheKey);
        if (nowCachedHoroscope) {
          console.log(`[PublicHoroscope] ✓ Found cached result after ${attempt} wait(s)`);
          return NextResponse.json(nowCachedHoroscope);
        }

        console.log(`[PublicHoroscope] Cache still empty after attempt ${attempt}/${maxRetries}`);
      }

      // Still not cached after all retries - return 503
      console.log(`[PublicHoroscope] No cached result after ${maxRetries} retries, returning 503`);
      return NextResponse.json(
        { error: "Generation in progress", message: "Please try again in a moment." },
        { status: 503 }
      );
    } else {
      console.log(`[PublicHoroscope] ✓ Lock acquired for ${lockKey}, generating horoscope...`);
    }

    // Construct the OpenAI prompt using Ayren voice
    const systemPrompt = `${AYREN_MODE_SHORT}

CONTEXT:
This is a PUBLIC, non-personalized reading for ${signDisplayName}. Keep it general but still warm and insightful.

LANGUAGE:
- Write ALL content in language code: ${targetLanguage}
- Field names in JSON remain in English, but all content values must be in the user's language

OUTPUT FORMAT:
Respond with ONLY valid JSON. No markdown, no explanations—just the JSON object.`;

    const timeframeLabel =
      timeframe === "today"
        ? "Today's"
        : timeframe === "week"
        ? "This Week's"
        : "This Month's";

    const userPrompt = `Generate a ${timeframe} horoscope for ${signDisplayName}.

Current date: ${new Date().toISOString()}
Timeframe: ${timeframe}

Return JSON:
{
  "title": "${timeframeLabel} Energy for ${signDisplayName}",
  "summary": "Exactly 2 paragraphs, 8-12 sentences total. Include 1 micro-action (<=10 min).",
  "keyThemes": ["theme1", "theme2", "theme3"]
}

Follow the Ayren voice rules strictly: 2 paragraphs, non-deterministic wording, calm-power close.`;

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODELS.horoscope,
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
      featureLabel: "Home • Public Horoscope",
      route: "/api/public-horoscope",
      model: OPENAI_MODELS.horoscope,
      promptVersion: PROMPT_VERSION,
      cacheStatus: "miss",
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      totalTokens: completion.usage?.total_tokens || 0,
      userId: null,
      timeframe,
      periodKey,
      language: targetLanguage,
      timezone,
    });

    // P0: Increment daily budget counter
    void incrementBudget(
      OPENAI_MODELS.horoscope,
      completion.usage?.prompt_tokens || 0,
      completion.usage?.completion_tokens || 0
    );

    // Token audit logging
    logTokenAudit({
      route: "/api/public-horoscope",
      featureLabel: "Home • Public Horoscope",
      model: OPENAI_MODELS.horoscope,
      cacheStatus: "miss",
      promptVersion: PROMPT_VERSION,
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      language: targetLanguage,
      timeframe,
    });

    // Parse and validate the JSON response
    let horoscope: PublicHoroscopeResponse;
    try {
      horoscope = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", responseContent);
      throw new Error("Invalid response format from AI");
    }

    // Cache the horoscope (TTL: 24 hours)
    await setCache(cacheKey, horoscope, 86400);

    // Release lock after successful generation
    if (lockAcquired) {
      await releaseLock(lockKey);
      console.log(`[PublicHoroscope] ✓ Lock released for ${lockKey}`);
    }

    // Return the horoscope
    return NextResponse.json(horoscope);
  } catch (error: any) {
    console.error("Error generating public horoscope:", error);

    // Release lock on error (if we acquired it)
    try {
      if (lockAcquired && lockKey) {
        await releaseLock(lockKey);
      }
    } catch (unlockError) {
      console.error("Error releasing lock on failure:", unlockError);
    }

    return NextResponse.json(
      {
        error: "Generation failed",
        message: "We couldn't generate the horoscope. Please try again in a moment.",
      },
      { status: 500 }
    );
  }
}
