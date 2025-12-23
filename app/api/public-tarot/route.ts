import { NextRequest, NextResponse } from "next/server";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { PublicTarotResponse, TarotSpread } from "@/types";
import { getCache, setCache } from "@/lib/cache";
import { isRedisAvailable, REDIS_UNAVAILABLE_RESPONSE } from "@/lib/cache/redis";
import { trackAiUsage } from "@/lib/ai/trackUsage";
import { checkBudget, incrementBudget, BUDGET_EXCEEDED_RESPONSE } from "@/lib/ai/costControl";
import { publicTarotSchema, validateRequest } from "@/lib/validation/schemas";
import { logTokenAudit } from "@/lib/ai/tokenAudit";
import { AYREN_MODE_SHORT } from "@/lib/ai/voice";
import {
  VALID_CARD_IDS,
  isValidCardId,
  getCardById,
  SPREAD_POSITIONS,
} from "@/lib/tarot/cards";
import {
  checkTarotRateLimits,
  getTarotRateLimitHeaders,
} from "@/lib/cache/tarotRateLimit";

// Idempotency cache TTL: 60 seconds
const IDEMPOTENCY_TTL = 60;

const PROMPT_VERSION = 2;
const MAX_RETRIES = 3;

// Full 78-card ID list for strict enforcement (Rider-Waite only)
const FULL_CARD_LIST = VALID_CARD_IDS.join('", "');

// Session cookie settings (30 days, HttpOnly, SameSite=Lax)
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(req: NextRequest) {
  // TODO: Extract userId from auth if available
  const userId: string | null = null; // Will be populated when auth is wired

  try {
    // ========================================
    // 1. VALIDATE REQUEST (before everything)
    // ========================================
    const validation = await validateRequest(req, publicTarotSchema);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", message: validation.error },
        { status: 400 }
      );
    }

    const { question, spread, requestId, timezone, language, userContext } =
      validation.data;
    const targetLanguage = language || "en";

    // ========================================
    // 2. IDEMPOTENCY CHECK (idempotency hits are FREE)
    // ========================================
    // Include language in key so readings match requested language
    const idempotencyKey = `tarot:idempotency:${requestId}:${targetLanguage}`;
    const cachedReading = await getCache<PublicTarotResponse>(idempotencyKey);

    if (cachedReading) {
      console.log(`[PublicTarot] Idempotency hit for requestId: ${requestId}`);

      void trackAiUsage({
        featureLabel: "Home • Public Tarot",
        route: "/api/public-tarot",
        model: OPENAI_MODELS.horoscope,
        promptVersion: PROMPT_VERSION,
        cacheStatus: "hit",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        userId: userId,
        language: targetLanguage,
        timezone,
      });

      return NextResponse.json(cachedReading);
    }

    // ========================================
    // 3. RATE LIMITING (only on idempotency miss)
    // ========================================
    const rateLimitResult = await checkTarotRateLimits(req, userId);
    const rateLimitHeaders: Record<string, string> =
      getTarotRateLimitHeaders(rateLimitResult);

    // Set session cookie if this is a new session
    if (rateLimitResult.isNewSession) {
      rateLimitHeaders["Set-Cookie"] =
        `tarot_session=${rateLimitResult.sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_COOKIE_MAX_AGE}`;
    }

    if (!rateLimitResult.allowed) {
      const retryAfter = rateLimitResult.retryAfterSeconds || 10;
      const message =
        rateLimitResult.reason === "cooldown"
          ? `Please wait ${retryAfter} seconds before drawing again.`
          : rateLimitResult.reason === "hourly_limit"
          ? `You've reached your hourly limit. Try again in ${Math.ceil(retryAfter / 60)} minutes.`
          : `You've reached your daily limit. Try again tomorrow.`;

      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message,
          retryAfterSeconds: retryAfter,
          reason: rateLimitResult.reason,
        },
        {
          status: 429,
          headers: { ...rateLimitHeaders, "Retry-After": String(retryAfter) },
        }
      );
    }

    console.log(
      `[PublicTarot] Generating reading for requestId: ${requestId}, spread: ${spread}`
    );

    // ========================================
    // P0: REDIS AVAILABILITY CHECK (fail closed)
    // ========================================
    if (!isRedisAvailable()) {
      console.warn("[PublicTarot] Redis unavailable, failing closed");
      return NextResponse.json(REDIS_UNAVAILABLE_RESPONSE, { status: 503, headers: rateLimitHeaders });
    }

    // ========================================
    // P0: BUDGET CHECK (before OpenAI call)
    // ========================================
    const budgetCheck = await checkBudget();
    if (!budgetCheck.allowed) {
      console.warn("[PublicTarot] Budget exceeded, rejecting request");
      return NextResponse.json(BUDGET_EXCEEDED_RESPONSE, { status: 503, headers: rateLimitHeaders });
    }

    // ========================================
    // OPENAI GENERATION
    // ========================================
    const positions = SPREAD_POSITIONS[spread as TarotSpread];

    // Build personalization context (quiet - never mentioned in response)
    let personalizationContext = "";
    if (userContext) {
      const parts: string[] = [];
      if (userContext.preferredName) {
        parts.push(`The querent's name is ${userContext.preferredName}.`);
      }
      if (userContext.astroSummary) {
        parts.push(`Astrological context: ${userContext.astroSummary}`);
      }
      if (userContext.socialInsightsSummary) {
        parts.push(`Social context: ${userContext.socialInsightsSummary}`);
      }
      if (parts.length > 0) {
        personalizationContext = `\n\nQUERENT CONTEXT (use subtly, never mention directly):\n${parts.join("\n")}`;
      }
    }

    const systemPrompt = `${AYREN_MODE_SHORT}

CONTEXT:
You are drawing tarot cards for a reading. The querent has asked a question and selected a ${spread}-card spread.${personalizationContext}

CRITICAL CARD DRAWING RULES:
- You MUST select cards ONLY from this exact list of 78 valid card IDs
- VALID CARD IDS: ["${FULL_CARD_LIST}"]
- Each card may be upright (reversed: false) or reversed (reversed: true)
- Cards must be UNIQUE - never repeat the same card in a spread
- If you use ANY card ID not in this list, the reading will fail

SPREAD POSITIONS:
${positions.map((p, i) => `Position ${i + 1}: ${p}`).join("\n")}

LANGUAGE:
- Write ALL interpretation content in language code: ${targetLanguage}
- JSON field names stay in English

OUTPUT FORMAT:
Respond with ONLY valid JSON. No markdown, no explanations—just the JSON object.`;

    const userPrompt = `Draw ${spread} tarot card(s) for this question:
"${question}"

Return JSON:
{
  "drawnCards": [
    { "cardId": "exact-card-id-from-list", "position": "${positions[0]}", "reversed": false }
    ${spread > 1 ? `// ... one entry for each of the ${spread} positions` : ""}
  ],
  "interpretation": {
    "cards": [
      {
        "cardId": "exact-card-id-from-list",
        "cardName": "Full Card Name",
        "position": "${positions[0]}",
        "reversed": false,
        "meaning": "2-3 sentences about this card in this position, relating to the question"
      }
      ${spread > 1 ? `// ... one entry for each of the ${spread} cards` : ""}
    ],
    "synthesis": "2-3 paragraphs weaving all cards together into a cohesive reading",
    "actionSteps": ["micro-action 1 (<=10 min)", "micro-action 2", "micro-action 3"],
    "reflectionQuestion": "A thought-provoking question for the querent to sit with"
  }
}

CRITICAL: Use ONLY card IDs from the provided list. Any invalid ID will cause a failure.`;

    let reading: PublicTarotResponse | null = null;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let attempts = 0;
    let lastInvalidCards: string[] = [];

    // Retry loop for card validation - NO random patching
    while (attempts < MAX_RETRIES && !reading) {
      attempts++;

      const completion = await openai.chat.completions.create({
        model: OPENAI_MODELS.horoscope,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.85,
        response_format: { type: "json_object" },
      });

      totalInputTokens += completion.usage?.prompt_tokens || 0;
      totalOutputTokens += completion.usage?.completion_tokens || 0;

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error("No response from OpenAI");
      }

      try {
        const parsed = JSON.parse(responseContent);

        // Validate all card IDs strictly
        const invalidCards: string[] = [];
        for (const card of parsed.drawnCards || []) {
          if (!isValidCardId(card.cardId)) {
            invalidCards.push(card.cardId);
          }
        }

        if (invalidCards.length > 0) {
          console.warn(
            `[PublicTarot] Invalid card IDs on attempt ${attempts}:`,
            invalidCards
          );
          lastInvalidCards = invalidCards;

          // Continue to retry - do NOT patch with random cards
          if (attempts < MAX_RETRIES) {
            continue;
          }

          // All retries exhausted with invalid cards - fail cleanly
          throw new Error(
            `Invalid card IDs after ${MAX_RETRIES} attempts: ${invalidCards.join(", ")}`
          );
        }

        // All cards valid - enrich with names from our library
        const enrichedCards = parsed.interpretation?.cards?.map((c: any) => {
          const cardData = getCardById(c.cardId);
          return {
            ...c,
            cardName: cardData?.name || c.cardName || c.cardId,
          };
        });

        reading = {
          question,
          spread: spread as TarotSpread,
          drawnCards: parsed.drawnCards.map((c: any) => ({
            cardId: c.cardId,
            position: c.position,
            reversed: c.reversed || false,
          })),
          interpretation: {
            cards: enrichedCards || [],
            synthesis: parsed.interpretation?.synthesis || "",
            actionSteps: parsed.interpretation?.actionSteps || [],
            reflectionQuestion: parsed.interpretation?.reflectionQuestion || "",
          },
          generatedAt: new Date().toISOString(),
        };
      } catch (parseError: any) {
        console.error(
          `[PublicTarot] Parse error on attempt ${attempts}:`,
          parseError.message
        );
        if (attempts >= MAX_RETRIES) {
          throw new Error("Invalid response format from AI");
        }
      }
    }

    if (!reading) {
      console.error(
        `[PublicTarot] Failed after ${MAX_RETRIES} attempts. Last invalid cards:`,
        lastInvalidCards
      );
      throw new Error("Failed to generate valid reading after retries");
    }

    // Track usage
    void trackAiUsage({
      featureLabel: "Home • Public Tarot",
      route: "/api/public-tarot",
      model: OPENAI_MODELS.horoscope,
      promptVersion: PROMPT_VERSION,
      cacheStatus: "miss",
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      userId: userId,
      language: targetLanguage,
      timezone,
    });

    // P0: Increment daily budget counter
    void incrementBudget(OPENAI_MODELS.horoscope, totalInputTokens, totalOutputTokens);

    // Token audit logging
    logTokenAudit({
      route: "/api/public-tarot",
      featureLabel: "Home • Public Tarot",
      model: OPENAI_MODELS.horoscope,
      cacheStatus: "miss",
      promptVersion: PROMPT_VERSION,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      language: targetLanguage,
    });

    // Cache for idempotency
    await setCache(idempotencyKey, reading, IDEMPOTENCY_TTL);

    console.log(`[PublicTarot] Generated reading in ${attempts} attempt(s)`);

    return NextResponse.json(reading, { headers: rateLimitHeaders });
  } catch (error: any) {
    console.error("[PublicTarot] Error generating reading:", error.message);

    return NextResponse.json(
      {
        error: "Generation failed",
        message:
          "We couldn't complete your reading. Please try again in a moment.",
      },
      { status: 500 }
    );
  }
}
