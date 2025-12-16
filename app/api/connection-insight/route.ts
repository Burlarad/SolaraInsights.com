import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { getCache, setCache, getDayKey } from "@/lib/cache";

/**
 * Legacy connection insight format (this endpoint is deprecated)
 * Use /api/connection-brief and /api/connection-space-between instead
 */
interface ConnectionInsight {
  overview: string;
  emotionalDynamics: string;
  communication: string;
  careSuggestions: string;
}
import { acquireLockFailClosed, releaseLock, isRedisAvailable, REDIS_UNAVAILABLE_RESPONSE } from "@/lib/cache/redis";
import { checkRateLimit } from "@/lib/cache/rateLimit";
import { touchLastSeen } from "@/lib/activity/touchLastSeen";
import { trackAiUsage } from "@/lib/ai/trackUsage";
import { checkBudget, incrementBudget, BUDGET_EXCEEDED_RESPONSE } from "@/lib/ai/costControl";
import { AYREN_MODE_SHORT } from "@/lib/ai/voice";

// P0-3: Rate limits for connection insight (per user)
const USER_RATE_LIMIT = 10; // 10 requests per hour
const USER_RATE_WINDOW = 3600; // 1 hour
const COOLDOWN_SECONDS = 30; // 30 second cooldown

const PROMPT_VERSION = 2;

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
        { error: "Unauthorized", message: "Please sign in to view connection insights." },
        { status: 401 }
      );
    }

    // Track user activity (non-blocking)
    const admin = createAdminSupabaseClient();
    void touchLastSeen(admin, user.id, 30);

    // ========================================
    // P0-3: USER RATE LIMITING
    // ========================================
    // Cooldown check
    const cooldownKey = `conninsight:cooldown:${user.id}`;
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
      `conninsight:rate:${user.id}`,
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

    // Parse request body
    const body = await req.json();
    const { connectionId, timeframe } = body;

    if (!connectionId) {
      return NextResponse.json(
        { error: "Bad request", message: "Connection ID is required." },
        { status: 400 }
      );
    }

    // Default timeframe to "today" if not specified
    const requestTimeframe = timeframe || "today";

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

    // Validate profile has required birth data
    if (!profile.birth_date || !profile.timezone) {
      return NextResponse.json(
        {
          error: "Incomplete profile",
          message: "Please complete your birth signature in Settings to view connection insights.",
        },
        { status: 400 }
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
        {
          error: "Connection not found",
          message: "This connection doesn't exist or you don't have access to it.",
        },
        { status: 404 }
      );
    }

    // Determine connection's birth data (use linked profile if available)
    let connectionBirthData = {
      birth_date: connection.birth_date,
      birth_time: connection.birth_time,
      birth_city: connection.birth_city,
      birth_region: connection.birth_region,
      birth_country: connection.birth_country,
    };

    if (connection.linked_profile_id) {
      // Load linked profile's birth data
      const { data: linkedProfile } = await supabase
        .from("profiles")
        .select("birth_date, birth_time, birth_city, birth_region, birth_country")
        .eq("id", connection.linked_profile_id)
        .single();

      if (linkedProfile) {
        connectionBirthData = {
          birth_date: linkedProfile.birth_date,
          birth_time: linkedProfile.birth_time,
          birth_city: linkedProfile.birth_city,
          birth_region: linkedProfile.birth_region,
          birth_country: linkedProfile.birth_country,
        };
      }
    }

    // ========================================
    // CACHING LAYER
    // ========================================

    // Connection insights refresh at the viewer's (profile's) midnight
    const periodKey = getDayKey(profile.timezone);
    const language = profile.language || "en";
    const cacheKey = `connectionInsight:v1:p${PROMPT_VERSION}:${user.id}:${connectionId}:${requestTimeframe}:${periodKey}:${language}`;

    // Check cache
    const cachedInsight = await getCache<ConnectionInsight>(cacheKey);
    if (cachedInsight) {
      console.log(`[ConnectionInsight] Cache hit for ${cacheKey}`);

      // Track cache hit (no tokens consumed)
      void trackAiUsage({
        featureLabel: "Connections • Insight",
        route: "/api/connection-insight",
        model: OPENAI_MODELS.insights,
        promptVersion: PROMPT_VERSION,
        cacheStatus: "hit",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        userId: user.id,
        timeframe: requestTimeframe,
        periodKey,
        language,
        timezone: profile.timezone || null,
      });

      return NextResponse.json(cachedInsight);
    }

    console.log(`[ConnectionInsight] Cache miss for ${cacheKey}, generating fresh insight...`);

    // ========================================
    // P0: REDIS AVAILABILITY CHECK (fail closed)
    // ========================================
    if (!isRedisAvailable()) {
      console.warn("[ConnectionInsight] Redis unavailable, failing closed");
      return NextResponse.json(REDIS_UNAVAILABLE_RESPONSE, { status: 503 });
    }

    // ========================================
    // P0: BUDGET CHECK (before OpenAI call)
    // ========================================
    const budgetCheck = await checkBudget();
    if (!budgetCheck.allowed) {
      console.warn("[ConnectionInsight] Budget exceeded, rejecting request");
      return NextResponse.json(BUDGET_EXCEEDED_RESPONSE, { status: 503 });
    }

    // Build lock key to prevent stampede
    lockKey = `lock:connectionInsight:v1:p${PROMPT_VERSION}:${user.id}:${connectionId}:${requestTimeframe}:${periodKey}:${language}`;

    // P0: Acquire lock with FAIL-CLOSED behavior
    const lockResult = await acquireLockFailClosed(lockKey, 60);

    if (lockResult.redisDown) {
      console.warn("[ConnectionInsight] Redis unavailable during lock, failing closed");
      return NextResponse.json(REDIS_UNAVAILABLE_RESPONSE, { status: 503 });
    }

    lockAcquired = lockResult.acquired;

    if (!lockAcquired) {
      // Another request is already generating this insight
      console.log(`[ConnectionInsight] Lock already held for ${lockKey}, waiting for cached result...`);

      // Wait a bit and check cache again (likely populated by the other request)
      await new Promise(resolve => setTimeout(resolve, 2000));

      const nowCachedInsight = await getCache<ConnectionInsight>(cacheKey);
      if (nowCachedInsight) {
        console.log(`[ConnectionInsight] ✓ Found cached result after lock wait`);
        return NextResponse.json(nowCachedInsight);
      }

      // Still not cached - return 503 to prevent duplicate generation
      console.log(`[ConnectionInsight] No cached result after wait, returning 503`);
      return NextResponse.json(
        { error: "Generation in progress", message: "Please try again in a moment." },
        { status: 503 }
      );
    } else {
      console.log(`[ConnectionInsight] ✓ Lock acquired for ${lockKey}, generating insight...`);
    }

    // Determine tone guidance based on relationship type
    const getToneGuidance = (type: string): string => {
      const t = type.toLowerCase();
      if (t === "partner") {
        return "Romantic, intimate tone is appropriate. May reference emotional and physical closeness.";
      } else if (t === "friend" || t === "colleague") {
        return "Warm, platonic tone. Never romance-coded. Focus on mutual respect, support, and camaraderie.";
      } else if (t === "parent" || t === "child" || t === "sibling") {
        return "Family-appropriate tone. Focus on unconditional bonds, growth, and generational patterns.";
      }
      return "Warm, neutral tone. Default to friend-safe content.";
    };

    const toneGuidance = getToneGuidance(connection.relationship_type);
    const userName = profile.preferred_name || profile.full_name || "you";
    const connectionName = connection.name;

    // Construct OpenAI prompt using Ayren voice
    const systemPrompt = `${AYREN_MODE_SHORT}

CONTEXT:
You are describing the DYNAMIC between ${userName} and ${connectionName}.
This is a ${connection.relationship_type} connection.

TONE GUIDANCE:
${toneGuidance}

NAMING RULES (STRICT):
- Always use "${userName}" when referring to the person reading this
- Always use "${connectionName}" when referring to the other person
- NEVER use "Person 1", "Person 2", "the owner", "the connection", or any impersonal labels
- Use "you and ${connectionName}" phrasing throughout

SAFETY RULES (STRICT):
- Never claim to know ${connectionName}'s private thoughts or feelings with certainty
- Never say "they secretly feel..." or "they are thinking..."
- Never reveal what relationship label either person chose
- Never expose if their relationship labels don't match
- Never give manipulation tactics or coercion advice
- Never weaponize insights ("say this to trigger them")
- Use "may," "might," "could," "tends to" — not "will," "is," "definitely"

ADAPTATION FOR CONNECTIONS:
- Each section should follow Ayren voice principles (non-deterministic, warm, triumphant close)
- Include micro-actions where appropriate (caring gestures, communication moves)
- Focus on the relationship dynamic, not individual charts

OUTPUT FORMAT:
Respond with ONLY valid JSON. No markdown, no explanations—just the JSON object.`;

    const userPrompt = `Generate a relational insight for the connection between ${userName} and ${connectionName}.

${userName}'s birth signature:
- Birth date: ${profile.birth_date}
- Birth time: ${profile.birth_time || "unknown (use solar chart approach)"}
- Birth location: ${profile.birth_city || "unknown"}, ${profile.birth_region || ""}, ${profile.birth_country || ""}
- Timezone: ${profile.timezone}

${connectionName}'s birth signature:
- Relationship type: ${connection.relationship_type}
- Birth date: ${connectionBirthData.birth_date || "unknown"}
- Birth time: ${connectionBirthData.birth_time || "unknown (use solar chart approach)"}
- Birth location: ${connectionBirthData.birth_city || "unknown"}, ${connectionBirthData.birth_region || ""}, ${connectionBirthData.birth_country || ""}

Return a JSON object with this structure:
{
  "overview": "Exactly 2 paragraphs about the overall energy and essence of this ${connection.relationship_type} connection between ${userName} and ${connectionName}. 8-12 sentences total. Use their names throughout.",
  "emotionalDynamics": "Exactly 2 paragraphs about emotional rhythms between ${userName} and ${connectionName}. Include 1 micro-action for emotional attunement.",
  "communication": "Exactly 2 paragraphs about how ${userName} and ${connectionName} communicate. Include 1 micro-action for better listening or expression.",
  "careSuggestions": "Exactly 2 paragraphs with concrete ways ${userName} can support ${connectionName}. Include 1 micro-action (<=10 min)."
}

Remember: Use "${userName}" and "${connectionName}" throughout. Never use "Person 1/2" or impersonal labels.
Follow Ayren voice rules: non-deterministic wording, calm-power close, practical micro-actions.`;

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODELS.insights,
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

    // Track cache miss (tokens consumed)
    void trackAiUsage({
      featureLabel: "Connections • Insight",
      route: "/api/connection-insight",
      model: OPENAI_MODELS.insights,
      promptVersion: PROMPT_VERSION,
      cacheStatus: "miss",
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      totalTokens: completion.usage?.total_tokens || 0,
      userId: user.id,
      timeframe: requestTimeframe,
      periodKey,
      language,
      timezone: profile.timezone || null,
    });

    // P0: Increment daily budget counter
    void incrementBudget(
      OPENAI_MODELS.insights,
      completion.usage?.prompt_tokens || 0,
      completion.usage?.completion_tokens || 0
    );

    // Parse and validate the JSON response
    let insight: ConnectionInsight;
    try {
      insight = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", responseContent);
      throw new Error("Invalid response format from AI");
    }

    // Cache the connection insight (TTL: 24 hours)
    await setCache(cacheKey, insight, 86400);

    // Release lock after successful generation
    if (lockAcquired) {
      await releaseLock(lockKey!);
      console.log(`[ConnectionInsight] ✓ Lock released for ${lockKey}`);
    }

    // Return the connection insight
    return NextResponse.json(insight);
  } catch (error: any) {
    console.error("Error generating connection insight:", error);

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
        message: "We couldn't open this connection's insight. Please try again in a moment.",
      },
      { status: 500 }
    );
  }
}
