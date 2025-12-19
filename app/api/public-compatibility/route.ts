import { NextRequest, NextResponse } from "next/server";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { PublicCompatibilityContent, PublicCompatibilityResponse } from "@/types";
import { getCache, setCache } from "@/lib/cache";
import { isRedisAvailable, REDIS_UNAVAILABLE_RESPONSE } from "@/lib/cache/redis";
import { trackAiUsage } from "@/lib/ai/trackUsage";
import { checkBudget, incrementBudget, BUDGET_EXCEEDED_RESPONSE } from "@/lib/ai/costControl";
import {
  publicCompatibilitySchema,
  validateRequest,
} from "@/lib/validation/schemas";
import { AYREN_MODE_SHORT } from "@/lib/ai/voice";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit, checkBurstLimit, getClientIP, createRateLimitResponse } from "@/lib/cache/rateLimit";
import { ZODIAC_SIGNS } from "@/lib/constants";

// Idempotency cache TTL: 60 seconds
const IDEMPOTENCY_TTL = 60;

// Rate limits (per IP - anonymous endpoint)
// Human-friendly: DB hits (stone tablets) are FREE, only new generations count
const RATE_LIMIT = 60; // 60 requests per hour per IP
const RATE_WINDOW = 3600; // 1 hour
const COOLDOWN_SECONDS = 5; // 5 second cooldown between generations
const BURST_LIMIT = 10; // Max 10 requests in 10 seconds (anonymous = stricter)
const BURST_WINDOW = 10;

// Lock TTL: 30 seconds (for generation lock)
const LOCK_TTL = 30;

const PROMPT_VERSION = 1;

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

export async function POST(req: NextRequest) {
  const clientIP = getClientIP(req);

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

    const { signA, signB, requestId } = validation.data;

    // Normalize pair (alphabetical)
    const [sortedA, sortedB] = normalizePair(signA, signB);
    const pairKey = getPairKey(signA, signB);

    // ========================================
    // IDEMPOTENCY CHECK
    // ========================================
    const idempotencyKey = `compat:idempotency:${requestId}`;
    const cachedResponse = await getCache<PublicCompatibilityResponse>(
      idempotencyKey
    );

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
      });

      return NextResponse.json(cachedResponse);
    }

    // ========================================
    // CHECK DATABASE FOR EXISTING CONTENT
    // ========================================
    const admin = createAdminSupabaseClient();

    const { data: existingRow, error: selectError } = await admin
      .from("public_compatibility")
      .select("content_en_json, created_at")
      .eq("pair_key", pairKey)
      .single();

    if (existingRow && !selectError) {
      // Found in DB - return cached content (FREE - no rate limiting)
      console.log(`[PublicCompatibility] DB hit for pair: ${pairKey}`);

      const response: PublicCompatibilityResponse = {
        ...(existingRow.content_en_json as PublicCompatibilityContent),
        generatedAt: existingRow.created_at,
        fromCache: true,
      };

      // Cache for idempotency
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
      });

      return NextResponse.json(response);
    }

    // ========================================
    // RATE LIMITING (only on new generation - DB hits are FREE)
    // ========================================

    // Burst protection (bot defense - stricter for anonymous)
    const burstResult = await checkBurstLimit(`compat:${clientIP}`, BURST_LIMIT, BURST_WINDOW);
    if (!burstResult.success) {
      return NextResponse.json(
        createRateLimitResponse(BURST_WINDOW, "You're moving too fast — slow down a bit."),
        { status: 429, headers: { "Retry-After": String(BURST_WINDOW) } }
      );
    }

    // Cooldown check
    const cooldownKey = `compat:cooldown:${clientIP}`;
    const lastRequestTime = await getCache<number>(cooldownKey);
    if (lastRequestTime) {
      const elapsed = Math.floor((Date.now() - lastRequestTime) / 1000);
      const remaining = COOLDOWN_SECONDS - elapsed;
      if (remaining > 0) {
        return NextResponse.json(
          createRateLimitResponse(remaining, `Please wait ${remaining} seconds before requesting again.`),
          { status: 429, headers: { "Retry-After": String(remaining) } }
        );
      }
    }

    // Sustained rate limit check
    const rateLimitResult = await checkRateLimit(
      `compat:rate:${clientIP}`,
      RATE_LIMIT,
      RATE_WINDOW
    );
    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        createRateLimitResponse(retryAfter, "Too many compatibility requests. Please try again later."),
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    // Set cooldown (only after passing all rate limit checks)
    await setCache(cooldownKey, Date.now(), COOLDOWN_SECONDS);

    // ========================================
    // ACQUIRE LOCK (prevent duplicate generation)
    // ========================================
    const lockKey = `compat:lock:${pairKey}`;
    const existingLock = await getCache<string>(lockKey);

    if (existingLock) {
      // Another request is generating - PR-2: retry loop
      console.log(`[PublicCompatibility] Lock exists for ${pairKey}, waiting...`);

      const maxRetries = 3;
      const retryDelay = 2000; // 2 seconds between retries

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));

        const { data: retryRow } = await admin
          .from("public_compatibility")
          .select("content_en_json, created_at")
          .eq("pair_key", pairKey)
          .single();

        if (retryRow) {
          console.log(`[PublicCompatibility] ✓ Found DB result after ${attempt} wait(s)`);
          const response: PublicCompatibilityResponse = {
            ...(retryRow.content_en_json as PublicCompatibilityContent),
            generatedAt: retryRow.created_at,
            fromCache: true,
          };

          await setCache(idempotencyKey, response, IDEMPOTENCY_TTL);
          return NextResponse.json(response);
        }

        console.log(`[PublicCompatibility] DB still empty after attempt ${attempt}/${maxRetries}`);
      }

      // Still not ready after all retries - return temporary error
      console.log(`[PublicCompatibility] No DB result after ${maxRetries} retries, returning 503`);
      return NextResponse.json(
        {
          error: "Generation in progress",
          message: "Another request is generating this content. Please try again in a few seconds.",
        },
        { status: 503 }
      );
    }

    // Acquire lock
    await setCache(lockKey, "generating", LOCK_TTL);

    // ========================================
    // P0: REDIS AVAILABILITY CHECK (fail closed)
    // ========================================
    if (!isRedisAvailable()) {
      console.warn("[PublicCompatibility] Redis unavailable, failing closed");
      return NextResponse.json(REDIS_UNAVAILABLE_RESPONSE, { status: 503 });
    }

    // ========================================
    // P0: BUDGET CHECK (before OpenAI call)
    // ========================================
    const budgetCheck = await checkBudget();
    if (!budgetCheck.allowed) {
      console.warn("[PublicCompatibility] Budget exceeded, rejecting request");
      // Release lock before returning
      await setCache(lockKey, null, 0);
      return NextResponse.json(BUDGET_EXCEEDED_RESPONSE, { status: 503 });
    }

    // ========================================
    // GENERATE WITH OPENAI
    // ========================================
    console.log(`[PublicCompatibility] Generating for pair: ${pairKey}`);

    const signAName = getSignDisplayName(sortedA);
    const signBName = getSignDisplayName(sortedB);

    const systemPrompt = `${AYREN_MODE_SHORT}

CONTEXT:
You are generating a comprehensive compatibility reading between two zodiac signs. This is a "stone tablet" reading - it will be stored forever and shown to all users who ask about this sign pair.

IMPORTANT:
- Write for ANY two people with these sun signs (not specific individuals)
- Be balanced - every pair has strengths AND challenges
- Avoid deterministic language ("will" → "may", "always" → "often")
- Include practical, actionable advice
- Keep the warm, poetic Ayren voice throughout

OUTPUT FORMAT:
Respond with ONLY valid JSON. No markdown, no explanations—just the JSON object.`;

    const userPrompt = `Generate a compatibility reading for ${signAName} and ${signBName}.

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
  "longTermPotential": "1-2 paragraphs about long-term relationship potential",
  "bestMoveThisWeek": "One concrete micro-action either sign can take to improve the connection"
}

Make each section substantive and specific to this particular sign combination.`;

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODELS.horoscope,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error("No response from OpenAI");
    }

    const content: PublicCompatibilityContent = JSON.parse(responseContent);

    // Ensure pairKey and title are correct
    content.pairKey = pairKey;
    content.title = `${signAName} + ${signBName}`;

    // ========================================
    // STORE TO DATABASE
    // ========================================
    const { error: insertError } = await admin
      .from("public_compatibility")
      .insert({
        pair_key: pairKey,
        sign_a: sortedA,
        sign_b: sortedB,
        content_en_json: content,
      });

    if (insertError) {
      // Check if it's a unique constraint violation (race condition)
      if (insertError.code === "23505") {
        console.log(`[PublicCompatibility] Race condition - row already exists for ${pairKey}`);

        // Fetch the existing row
        const { data: existingRow } = await admin
          .from("public_compatibility")
          .select("content_en_json, created_at")
          .eq("pair_key", pairKey)
          .single();

        if (existingRow) {
          const response: PublicCompatibilityResponse = {
            ...(existingRow.content_en_json as PublicCompatibilityContent),
            generatedAt: existingRow.created_at,
            fromCache: true,
          };

          await setCache(idempotencyKey, response, IDEMPOTENCY_TTL);
          return NextResponse.json(response);
        }
      }

      console.error(`[PublicCompatibility] Insert error:`, insertError.message);
      throw new Error("Failed to store compatibility reading");
    }

    // Release lock
    await setCache(lockKey, null, 0);

    // ========================================
    // TRACK USAGE & RETURN
    // ========================================
    void trackAiUsage({
      featureLabel: "Home • Public Compatibility",
      route: "/api/public-compatibility",
      model: OPENAI_MODELS.horoscope,
      promptVersion: PROMPT_VERSION,
      cacheStatus: "miss",
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    });

    // P0: Increment daily budget counter
    void incrementBudget(OPENAI_MODELS.horoscope, inputTokens, outputTokens);

    const response: PublicCompatibilityResponse = {
      ...content,
      generatedAt: new Date().toISOString(),
      fromCache: false,
    };

    // Cache for idempotency
    await setCache(idempotencyKey, response, IDEMPOTENCY_TTL);

    console.log(`[PublicCompatibility] Generated and stored for pair: ${pairKey}`);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("[PublicCompatibility] Error:", error.message);

    return NextResponse.json(
      {
        error: "Generation failed",
        message: "We couldn't generate the compatibility reading. Please try again.",
      },
      { status: 500 }
    );
  }
}
