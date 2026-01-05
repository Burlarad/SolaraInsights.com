import { NextRequest, NextResponse } from "next/server";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import {
  PublicCompatibilityCore,
  PublicCompatibilityYearly,
  PublicCompatibilityResponse,
} from "@/types";
import {
  getCache,
  setCache,
  isRedisAvailable,
  REDIS_UNAVAILABLE_RESPONSE,
} from "@/lib/cache/redis";
import { trackAiUsage } from "@/lib/ai/trackUsage";
import {
  checkBudget,
  incrementBudget,
  BUDGET_EXCEEDED_RESPONSE,
} from "@/lib/ai/costControl";
import {
  publicCompatibilitySchema,
  validateRequest,
} from "@/lib/validation/schemas";
import { logTokenAudit } from "@/lib/ai/tokenAudit";
import { AYREN_MODE_SHORT } from "@/lib/ai/voice";
import {
  checkRateLimit,
  checkBurstLimit,
  getAnonId,
  createRateLimitResponse,
} from "@/lib/cache/rateLimit";
import { ZODIAC_SIGNS } from "@/lib/constants";
import {
  resolveLocale,
  getCriticalLanguageBlock,
} from "@/lib/i18n/resolveLocale";
import { localeNames, type Locale } from "@/i18n";

// Idempotency cache TTL: 60 seconds
const IDEMPOTENCY_TTL = 60;

// Core content cache TTL: 30 days (stable archetype)
const CORE_CACHE_TTL = 60 * 60 * 24 * 30;

// Yearly content cache TTL: 7 days (refreshed weekly)
const YEARLY_CACHE_TTL = 60 * 60 * 24 * 7;

// Rate limits (per IP - anonymous endpoint)
const RATE_LIMIT = 60; // 60 requests per hour per IP
const RATE_WINDOW = 3600; // 1 hour
const COOLDOWN_SECONDS = 5; // 5 second cooldown between generations
const BURST_LIMIT = 10; // Max 10 requests in 10 seconds
const BURST_WINDOW = 10;

// Lock TTL: 30 seconds (for generation lock)
const LOCK_TTL = 30;

const PROMPT_VERSION = 2;

/**
 * Normalize a sign pair to alphabetical order.
 * e.g., ("taurus", "aries") -> ["aries", "taurus"]
 */
function normalizePair(signA: string, signB: string): [string, string] {
  return signA < signB ? [signA, signB] : [signB, signA];
}

/**
 * Generate pair_key from two signs (alphabetically sorted).
 */
function getPairKey(signA: string, signB: string): string {
  const [a, b] = normalizePair(signA, signB);
  return `${a}__${b}`;
}

/**
 * Get display name for a sign.
 */
function getSignDisplayName(signKey: string): string {
  const sign = ZODIAC_SIGNS.find((s) => s.key === signKey);
  return sign?.name || signKey.charAt(0).toUpperCase() + signKey.slice(1);
}

/**
 * Get language name for prompt.
 */
function getLanguageName(locale: Locale): string {
  return localeNames[locale] || "English";
}

export async function POST(req: NextRequest) {
  // Use session+IP combo for rate limiting (more fair for shared networks)
  const anonId = getAnonId(req);

  try {
    // ========================================
    // VALIDATE REQUEST
    // ========================================
    const validation = await validateRequest(req, publicCompatibilitySchema);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", message: validation.error },
        { status: 400 }
      );
    }

    const { signA, signB, requestId, year, timezone, language } =
      validation.data;

    // Resolve target language with fallback chain
    const targetLanguage = resolveLocale(req, language);
    const languageName = getLanguageName(targetLanguage);

    // Get current year for yearly content
    const targetYear = year || new Date().getFullYear();

    // Normalize pair (alphabetical)
    const [sortedA, sortedB] = normalizePair(signA, signB);
    const pairKey = getPairKey(signA, signB);

    // ========================================
    // IDEMPOTENCY CHECK
    // ========================================
    const idempotencyKey = `compat:idempotency:${requestId}:${targetLanguage}`;
    const cachedResponse =
      await getCache<PublicCompatibilityResponse>(idempotencyKey);

    if (cachedResponse) {
      console.log(
        `[PublicCompatibility] Idempotency hit for requestId: ${requestId}`
      );

      void trackAiUsage({
        featureLabel: "Home • Public Compatibility",
        route: "/api/public-compatibility",
        model: OPENAI_MODELS.horoscope,
        promptVersion: PROMPT_VERSION,
        cacheStatus: "hit",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        language: targetLanguage,
      });

      return NextResponse.json(cachedResponse);
    }

    // ========================================
    // CHECK CACHES (Core + Yearly)
    // ========================================
    const coreCacheKey = `compat:core:v1:p${PROMPT_VERSION}:${pairKey}:${targetLanguage}`;
    const yearlyCacheKey = `compat:year:v1:p${PROMPT_VERSION}:${pairKey}:${targetYear}:${targetLanguage}`;

    const [cachedCore, cachedYearly] = await Promise.all([
      getCache<PublicCompatibilityCore>(coreCacheKey),
      getCache<PublicCompatibilityYearly>(yearlyCacheKey),
    ]);

    const coreHit = !!cachedCore;
    const yearlyHit = !!cachedYearly;

    // If both cached, return merged response immediately (FREE - no rate limiting)
    if (cachedCore && cachedYearly) {
      console.log(
        `[PublicCompatibility] Full cache hit for pair: ${pairKey}, year: ${targetYear}, lang: ${targetLanguage}`
      );

      const response: PublicCompatibilityResponse = {
        ...cachedCore,
        year: cachedYearly.year,
        yearlyTheme: cachedYearly.yearlyTheme,
        cosmicClimate: cachedYearly.cosmicClimate,
        growthOpportunities: cachedYearly.growthOpportunities,
        watchPoints: cachedYearly.watchPoints,
        bestMoveThisWeek: cachedYearly.bestMoveThisWeek,
        generatedAt: new Date().toISOString(),
        fromCache: true,
        cacheStatus: { core: "hit", yearly: "hit" },
      };

      await setCache(idempotencyKey, response, IDEMPOTENCY_TTL);

      void trackAiUsage({
        featureLabel: "Home • Public Compatibility",
        route: "/api/public-compatibility",
        model: OPENAI_MODELS.horoscope,
        promptVersion: PROMPT_VERSION,
        cacheStatus: "hit",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        language: targetLanguage,
      });

      return NextResponse.json(response);
    }

    // ========================================
    // RATE LIMITING (only on cache miss)
    // ========================================

    // Burst protection
    const burstResult = await checkBurstLimit(
      `compat:${anonId}`,
      BURST_LIMIT,
      BURST_WINDOW
    );
    if (!burstResult.success) {
      return NextResponse.json(
        createRateLimitResponse(
          BURST_WINDOW,
          "You're moving too fast — slow down a bit."
        ),
        { status: 429, headers: { "Retry-After": String(BURST_WINDOW) } }
      );
    }

    // Cooldown check
    const cooldownKey = `compat:cooldown:${anonId}`;
    const lastRequestTime = await getCache<number>(cooldownKey);
    if (lastRequestTime) {
      const elapsed = Math.floor((Date.now() - lastRequestTime) / 1000);
      const remaining = COOLDOWN_SECONDS - elapsed;
      if (remaining > 0) {
        return NextResponse.json(
          createRateLimitResponse(
            remaining,
            `Please wait ${remaining} seconds before requesting again.`
          ),
          { status: 429, headers: { "Retry-After": String(remaining) } }
        );
      }
    }

    // Sustained rate limit check
    const rateLimitResult = await checkRateLimit(
      `compat:rate:${anonId}`,
      RATE_LIMIT,
      RATE_WINDOW
    );
    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil(
        (rateLimitResult.resetAt - Date.now()) / 1000
      );
      return NextResponse.json(
        createRateLimitResponse(
          retryAfter,
          "Too many compatibility requests. Please try again later."
        ),
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    // Set cooldown
    await setCache(cooldownKey, Date.now(), COOLDOWN_SECONDS);

    // ========================================
    // ACQUIRE LOCK (prevent duplicate generation)
    // ========================================
    const lockKey = `compat:lock:${pairKey}:${targetLanguage}`;
    const existingLock = await getCache<string>(lockKey);

    if (existingLock) {
      console.log(
        `[PublicCompatibility] Lock exists for ${pairKey}, waiting...`
      );

      const maxRetries = 3;
      const retryDelay = 2000;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));

        const [retryCore, retryYearly] = await Promise.all([
          getCache<PublicCompatibilityCore>(coreCacheKey),
          getCache<PublicCompatibilityYearly>(yearlyCacheKey),
        ]);

        if (retryCore && retryYearly) {
          console.log(
            `[PublicCompatibility] ✓ Found cache after ${attempt} wait(s)`
          );
          const response: PublicCompatibilityResponse = {
            ...retryCore,
            year: retryYearly.year,
            yearlyTheme: retryYearly.yearlyTheme,
            cosmicClimate: retryYearly.cosmicClimate,
            growthOpportunities: retryYearly.growthOpportunities,
            watchPoints: retryYearly.watchPoints,
            bestMoveThisWeek: retryYearly.bestMoveThisWeek,
            generatedAt: new Date().toISOString(),
            fromCache: true,
            cacheStatus: { core: "hit", yearly: "hit" },
          };

          await setCache(idempotencyKey, response, IDEMPOTENCY_TTL);
          return NextResponse.json(response);
        }

        console.log(
          `[PublicCompatibility] Cache still empty after attempt ${attempt}/${maxRetries}`
        );
      }

      return NextResponse.json(
        {
          error: "Generation in progress",
          message:
            "Another request is generating this content. Please try again in a few seconds.",
        },
        { status: 503 }
      );
    }

    // Acquire lock
    await setCache(lockKey, "generating", LOCK_TTL);

    // ========================================
    // P0: REDIS AVAILABILITY CHECK
    // ========================================
    if (!isRedisAvailable()) {
      console.warn("[PublicCompatibility] Redis unavailable, failing closed");
      return NextResponse.json(REDIS_UNAVAILABLE_RESPONSE, { status: 503 });
    }

    // ========================================
    // P0: BUDGET CHECK
    // ========================================
    const budgetCheck = await checkBudget();
    if (!budgetCheck.allowed) {
      console.warn("[PublicCompatibility] Budget exceeded, rejecting request");
      await setCache(lockKey, null, 0);
      return NextResponse.json(BUDGET_EXCEEDED_RESPONSE, { status: 503 });
    }

    // ========================================
    // GENERATE MISSING CONTENT
    // ========================================
    const signAName = getSignDisplayName(sortedA);
    const signBName = getSignDisplayName(sortedB);
    const languageBlock = getCriticalLanguageBlock(languageName, targetLanguage);

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let coreContent: PublicCompatibilityCore = cachedCore!;
    let yearlyContent: PublicCompatibilityYearly = cachedYearly!;

    // Generate Core content if not cached
    if (!cachedCore) {
      console.log(
        `[PublicCompatibility] Generating Core for pair: ${pairKey}, lang: ${targetLanguage}`
      );

      const coreSystemPrompt = `${AYREN_MODE_SHORT}

CONTEXT:
You are generating a comprehensive compatibility reading between two zodiac signs. This is the CORE archetype - it will be stored long-term and shown to all users who ask about this sign pair.

IMPORTANT:
- Write for ANY two people with these sun signs (not specific individuals)
- Be balanced - every pair has strengths AND challenges
- Avoid deterministic language ("will" → "may", "always" → "often")
- Include practical, actionable advice
- Keep the warm, poetic Ayren voice throughout

${languageBlock}

OUTPUT FORMAT:
Respond with ONLY valid JSON. No markdown, no explanations—just the JSON object.`;

      const coreUserPrompt = `Generate a CORE compatibility reading for ${signAName} and ${signBName}.

Return JSON:
{
  "pairKey": "${pairKey}",
  "title": "${signAName} + ${signBName}",
  "summary": "2-3 paragraphs giving an overview of this pairing's dynamic",
  "strengths": ["strength 1", "strength 2", "strength 3", "strength 4"],
  "frictionPoints": ["friction 1", "friction 2", "friction 3"],
  "howToMakeItWork": ["tip 1", "tip 2", "tip 3"],
  "communicationStyle": "1-2 paragraphs about how these signs communicate together",
  "loveAndIntimacy": "1-2 paragraphs about romantic and intimate dynamics",
  "trustAndSecurity": "1-2 paragraphs about trust-building and emotional security",
  "longTermPotential": "1-2 paragraphs about long-term relationship potential"
}

Make each section substantive and specific to this particular sign combination.
Remember: ALL text values must be in ${languageName}.`;

      const coreCompletion = await openai.chat.completions.create({
        model: OPENAI_MODELS.horoscope,
        messages: [
          { role: "system", content: coreSystemPrompt },
          { role: "user", content: coreUserPrompt },
        ],
        temperature: 0.8,
        response_format: { type: "json_object" },
      });

      totalInputTokens += coreCompletion.usage?.prompt_tokens || 0;
      totalOutputTokens += coreCompletion.usage?.completion_tokens || 0;

      const coreResponse = coreCompletion.choices[0]?.message?.content;
      if (!coreResponse) {
        throw new Error("No response from OpenAI for Core content");
      }

      coreContent = JSON.parse(coreResponse);
      coreContent.pairKey = pairKey;
      coreContent.title = `${signAName} + ${signBName}`;

      // Cache Core content
      await setCache(coreCacheKey, coreContent, CORE_CACHE_TTL);
      console.log(`[PublicCompatibility] Core cached for ${pairKey}`);
    }

    // Generate Yearly content if not cached
    if (!cachedYearly) {
      console.log(
        `[PublicCompatibility] Generating Yearly for pair: ${pairKey}, year: ${targetYear}, lang: ${targetLanguage}`
      );

      const yearlySystemPrompt = `${AYREN_MODE_SHORT}

CONTEXT:
You are generating a YEARLY compatibility overlay for ${signAName} and ${signBName} for the year ${targetYear}. This adds time-sensitive guidance on top of their core archetype.

Consider major planetary transits affecting this pairing in ${targetYear}:
- Saturn, Jupiter, and outer planet movements
- Eclipse patterns and their impact on relationships
- Venus retrograde periods if applicable

${languageBlock}

OUTPUT FORMAT:
Respond with ONLY valid JSON. No markdown, no explanations—just the JSON object.`;

      const yearlyUserPrompt = `Generate the ${targetYear} yearly overlay for ${signAName} and ${signBName}.

Return JSON:
{
  "year": ${targetYear},
  "yearlyTheme": "${targetYear}: The Year of..." (catchy 5-7 word headline),
  "cosmicClimate": "1-2 paragraphs on how planetary transits affect this pair in ${targetYear}",
  "growthOpportunities": ["opportunity 1", "opportunity 2", "opportunity 3"],
  "watchPoints": ["watch point 1", "watch point 2", "watch point 3"],
  "bestMoveThisWeek": "One concrete micro-action either sign can take right now"
}

Remember: ALL text values must be in ${languageName}.`;

      const yearlyCompletion = await openai.chat.completions.create({
        model: OPENAI_MODELS.horoscope,
        messages: [
          { role: "system", content: yearlySystemPrompt },
          { role: "user", content: yearlyUserPrompt },
        ],
        temperature: 0.8,
        response_format: { type: "json_object" },
      });

      totalInputTokens += yearlyCompletion.usage?.prompt_tokens || 0;
      totalOutputTokens += yearlyCompletion.usage?.completion_tokens || 0;

      const yearlyResponse = yearlyCompletion.choices[0]?.message?.content;
      if (!yearlyResponse) {
        throw new Error("No response from OpenAI for Yearly content");
      }

      yearlyContent = JSON.parse(yearlyResponse);
      yearlyContent.year = targetYear;

      // Cache Yearly content
      await setCache(yearlyCacheKey, yearlyContent, YEARLY_CACHE_TTL);
      console.log(
        `[PublicCompatibility] Yearly cached for ${pairKey}:${targetYear}`
      );
    }

    // Release lock
    await setCache(lockKey, null, 0);

    // ========================================
    // TRACK USAGE & RETURN
    // ========================================
    if (totalInputTokens > 0 || totalOutputTokens > 0) {
      void trackAiUsage({
        featureLabel: "Home • Public Compatibility",
        route: "/api/public-compatibility",
        model: OPENAI_MODELS.horoscope,
        promptVersion: PROMPT_VERSION,
        cacheStatus: "miss",
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        language: targetLanguage,
      });

      void incrementBudget(
        OPENAI_MODELS.horoscope,
        totalInputTokens,
        totalOutputTokens
      );

      logTokenAudit({
        route: "/api/public-compatibility",
        featureLabel: "Home • Public Compatibility",
        model: OPENAI_MODELS.horoscope,
        cacheStatus: "miss",
        promptVersion: PROMPT_VERSION,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        language: targetLanguage,
      });
    }

    const response: PublicCompatibilityResponse = {
      ...coreContent,
      year: yearlyContent.year,
      yearlyTheme: yearlyContent.yearlyTheme,
      cosmicClimate: yearlyContent.cosmicClimate,
      growthOpportunities: yearlyContent.growthOpportunities,
      watchPoints: yearlyContent.watchPoints,
      bestMoveThisWeek: yearlyContent.bestMoveThisWeek,
      generatedAt: new Date().toISOString(),
      fromCache: false,
      cacheStatus: {
        core: coreHit ? "hit" : "miss",
        yearly: yearlyHit ? "hit" : "miss",
      },
    };

    // Cache for idempotency
    await setCache(idempotencyKey, response, IDEMPOTENCY_TTL);

    console.log(
      `[PublicCompatibility] Generated for pair: ${pairKey}, year: ${targetYear}, lang: ${targetLanguage}`
    );

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("[PublicCompatibility] Error:", error.message);

    return NextResponse.json(
      {
        error: "Generation failed",
        message:
          "We couldn't generate the compatibility reading. Please try again.",
      },
      { status: 500 }
    );
  }
}
