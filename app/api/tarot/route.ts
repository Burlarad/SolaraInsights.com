import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { PublicTarotResponse, TarotSpread } from "@/types";
import { getCache, setCache, isRedisAvailable, REDIS_UNAVAILABLE_RESPONSE } from "@/lib/cache/redis";
import { trackAiUsage } from "@/lib/ai/trackUsage";
import { checkBudget, incrementBudget, BUDGET_EXCEEDED_RESPONSE } from "@/lib/ai/costControl";
import { publicTarotSchema, validateRequest } from "@/lib/validation/schemas";
import { logTokenAudit } from "@/lib/ai/tokenAudit";
import { AYREN_MODE_SHORT } from "@/lib/ai/voice";
import { isPremium, checkSeatMemberAccess } from "@/lib/entitlements/canAccessFeature";
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
import {
  resolveLocale,
  getCriticalLanguageBlock,
} from "@/lib/i18n/resolveLocale";
import { localeNames, type Locale } from "@/i18n";

// Idempotency cache TTL: 60 seconds
const IDEMPOTENCY_TTL = 60;

const PROMPT_VERSION = 2;
const MAX_RETRIES = 3;

// Full 78-card ID list for strict enforcement (Rider-Waite only)
const FULL_CARD_LIST = VALID_CARD_IDS.join('", "');

export async function POST(req: NextRequest) {
  // ========================================
  // STEP 1: AUTH — tarot is Sanctuary-only
  // ========================================
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        errorCode: "UNAUTHORIZED",
        message: "Please sign in to draw tarot cards.",
      },
      { status: 401 }
    );
  }

  const userId = user.id;

  try {
    // ========================================
    // STEP 2: PROFILE — required; null = hard stop
    // Profile must exist before any entitlement or generation logic.
    // ========================================
    const { data: userProfile, error: profileError } = await supabase
      .from("profiles")
      .select("membership_plan, subscription_status, role, is_comped, tarot_free_used")
      .eq("id", userId)
      .single();

    if (!userProfile) {
      console.error("[Tarot] Profile not found for user:", userId, profileError?.message);
      return NextResponse.json(
        {
          error: "Profile not found",
          errorCode: "PROFILE_NOT_FOUND",
          message: "Your account profile could not be loaded. Please try again.",
        },
        { status: 500 }
      );
    }

    // ========================================
    // STEP 3: ENTITLEMENTS — determine paid status
    // Premium (own active/trialing subscription) OR active seat member = paid.
    // Seat members skip the free-taste cap entirely.
    // ========================================
    const isPaid =
      isPremium(userProfile as any) ||
      (await checkSeatMemberAccess(userId, supabase));

    // ========================================
    // STEP 4: FREE TASTE GATE
    // Paid users draw without restriction.
    // Free users get exactly ONE lifetime reading.
    // Gate runs before validation / idempotency / rate-limit.
    // ========================================
    if (!isPaid && userProfile.tarot_free_used) {
      return NextResponse.json(
        {
          error: "tarot_limit_reached",
          errorCode: "TAROT_LIMIT_REACHED",
          message: "You've used your free tarot reading. Upgrade to Premium for unlimited readings.",
          upgradeUrl: "/join",
        },
        { status: 403 }
      );
    }

    // ========================================
    // STEP 5: VALIDATE REQUEST
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

    // Resolve target language with fallback chain (body → cookie → Accept-Language → cf-ipcountry → "en")
    const targetLanguage = resolveLocale(req, language);
    const languageName = localeNames[targetLanguage] || "English";

    // ========================================
    // STEP 6: IDEMPOTENCY CHECK (idempotency hits are FREE)
    // ========================================
    // Include language in key so readings match requested language
    const idempotencyKey = `tarot:idempotency:${requestId}:${targetLanguage}`;
    const cachedReading = await getCache<PublicTarotResponse>(idempotencyKey);

    if (cachedReading) {
      console.log(`[PublicTarot] Idempotency hit for requestId: ${requestId}`);

      void trackAiUsage({
        featureLabel: "Sanctuary • Tarot",
        route: "/api/tarot",
        model: OPENAI_MODELS.horoscope,
        promptVersion: PROMPT_VERSION,
        cacheStatus: "hit",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        userId,
        language: targetLanguage,
        timezone,
      });

      return NextResponse.json(cachedReading);
    }

    // ========================================
    // STEP 7: RATE LIMITING (only on idempotency miss)
    // ========================================
    const rateLimitResult = await checkTarotRateLimits(userId);
    const rateLimitHeaders: Record<string, string> =
      getTarotRateLimitHeaders(rateLimitResult);

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

    const languageBlock = getCriticalLanguageBlock(languageName, targetLanguage);

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

${languageBlock}

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
      featureLabel: "Sanctuary • Tarot",
      route: "/api/tarot",
      model: OPENAI_MODELS.horoscope,
      promptVersion: PROMPT_VERSION,
      cacheStatus: "miss",
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      userId,
      language: targetLanguage,
      timezone,
    });

    // P0: Increment daily budget counter
    void incrementBudget(OPENAI_MODELS.horoscope, totalInputTokens, totalOutputTokens);

    // Token audit logging
    logTokenAudit({
      route: "/api/tarot",
      featureLabel: "Sanctuary • Tarot",
      model: OPENAI_MODELS.horoscope,
      cacheStatus: "miss",
      promptVersion: PROMPT_VERSION,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      language: targetLanguage,
    });

    // Cache for idempotency
    await setCache(idempotencyKey, reading, IDEMPOTENCY_TTL);

    // Mark free lifetime taste as used for non-paid users (after successful generation)
    if (!isPaid && !userProfile.tarot_free_used) {
      try {
        await supabase
          .from("profiles")
          .update({ tarot_free_used: true })
          .eq("id", userId);
      } catch (markError) {
        // Non-fatal — log and continue. Reading was already generated.
        console.warn("[PublicTarot] Failed to mark tarot_free_used:", markError);
      }
    }

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
