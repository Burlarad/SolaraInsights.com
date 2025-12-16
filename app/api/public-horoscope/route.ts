import { NextRequest, NextResponse } from "next/server";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { PublicHoroscopeResponse } from "@/types";
import { getCache, setCache, getDayKey } from "@/lib/cache";
import { acquireLock, releaseLock } from "@/lib/cache/redis";
import { checkRateLimit, getClientIP } from "@/lib/cache/rateLimit";
import { trackAiUsage } from "@/lib/ai/trackUsage";
import { publicHoroscopeSchema, validateRequest } from "@/lib/validation/schemas";
import { AYREN_MODE_SHORT } from "@/lib/ai/voice";

// Rate limit: 30 requests per minute per IP
const RATE_LIMIT = 30;
const RATE_WINDOW_SECONDS = 60;

const PROMPT_VERSION = 2;

export async function POST(req: NextRequest) {
  // Rate limiting
  const clientIP = getClientIP(req);
  const rateLimit = await checkRateLimit(
    `public-horoscope:${clientIP}`,
    RATE_LIMIT,
    RATE_WINDOW_SECONDS
  );

  // Rate limit headers for all responses
  const rateLimitHeaders: Record<string, string> = {
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
    "X-RateLimit-Backend": rateLimit.backend,
  };

  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests", message: "Please wait a moment before trying again." },
      { status: 429, headers: rateLimitHeaders }
    );
  }

  let lockKey: string | undefined;
  let lockAcquired = false;

  try {
    // Validate request body
    const validation = await validateRequest(req, publicHoroscopeSchema);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", message: validation.error },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const { sign, timeframe, timezone, language } = validation.data;
    const targetLanguage = language || "en";

    // Title-case the sign for display in prompts (e.g., "aries" -> "Aries")
    const signDisplayName = sign.charAt(0).toUpperCase() + sign.slice(1);

    // ========================================
    // CACHING LAYER
    // ========================================

    // Use timezone to compute a day key (public horoscopes refresh daily regardless of timeframe)
    const periodKey = getDayKey(timezone);
    const cacheKey = `publicHoroscope:v1:p${PROMPT_VERSION}:${sign}:${timeframe}:${periodKey}:${targetLanguage}`;

    // Check cache
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

      return NextResponse.json(cachedHoroscope, { headers: rateLimitHeaders });
    }

    console.log(`[PublicHoroscope] Cache miss for ${cacheKey}, generating fresh horoscope...`);

    // Build lock key to prevent stampeding herd
    lockKey = `lock:publicHoroscope:p${PROMPT_VERSION}:${sign}:${timeframe}:${periodKey}:${targetLanguage}`;

    // Try to acquire lock
    lockAcquired = await acquireLock(lockKey, 60); // 60 second lock

    if (!lockAcquired) {
      // Another request is already generating this horoscope
      console.log(`[PublicHoroscope] Lock already held for ${lockKey}, waiting for cached result...`);

      // Wait a bit and check cache again (likely populated by the other request)
      await new Promise(resolve => setTimeout(resolve, 2000));

      const nowCachedHoroscope = await getCache<PublicHoroscopeResponse>(cacheKey);
      if (nowCachedHoroscope) {
        console.log(`[PublicHoroscope] ✓ Found cached result after lock wait`);
        return NextResponse.json(nowCachedHoroscope, { headers: rateLimitHeaders });
      }

      // Still not cached - proceed to generate anyway (lock may have been released)
      console.log(`[PublicHoroscope] No cached result after wait, generating anyway`);
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
    return NextResponse.json(horoscope, { headers: rateLimitHeaders });
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
      { status: 500, headers: rateLimitHeaders }
    );
  }
}
