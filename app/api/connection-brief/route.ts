import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { DailyBrief } from "@/types";
import { getCache, setCache, getDayKey } from "@/lib/cache";
import { acquireLockFailClosed, releaseLock, isRedisAvailable, REDIS_UNAVAILABLE_RESPONSE } from "@/lib/cache/redis";
import { checkRateLimit } from "@/lib/cache/rateLimit";
import { touchLastSeen } from "@/lib/activity/touchLastSeen";
import { trackAiUsage } from "@/lib/ai/trackUsage";
import { checkBudget, incrementBudget, BUDGET_EXCEEDED_RESPONSE } from "@/lib/ai/costControl";
import { AYREN_MODE_SHORT } from "@/lib/ai/voice";

// Rate limits for daily brief (per user)
const USER_RATE_LIMIT = 20; // 20 requests per hour
const USER_RATE_WINDOW = 3600; // 1 hour
const COOLDOWN_SECONDS = 10; // 10 second cooldown

const PROMPT_VERSION = 1;

/**
 * Daily Connection Brief API (Layer A)
 *
 * Returns a light "weather report" for the connection today.
 * - Generated on-demand when user opens a connection
 * - Saved to DB and immutable for that day
 * - Uses local date based on user's timezone
 */
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
        { error: "Unauthorized", message: "Please sign in to view connection briefs." },
        { status: 401 }
      );
    }

    // Track user activity (non-blocking)
    const admin = createAdminSupabaseClient();
    void touchLastSeen(admin, user.id, 30);

    // ========================================
    // RATE LIMITING
    // ========================================
    const cooldownKey = `connbrief:cooldown:${user.id}`;
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

    const rateLimitResult = await checkRateLimit(
      `connbrief:rate:${user.id}`,
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

    await setCache(cooldownKey, Date.now(), COOLDOWN_SECONDS);

    // Parse request body
    const body = await req.json();
    const { connectionId } = body;

    if (!connectionId) {
      return NextResponse.json(
        { error: "Bad request", message: "Connection ID is required." },
        { status: 400 }
      );
    }

    // Load user's profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profile not found", message: "Unable to load your profile." },
        { status: 404 }
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
        { error: "Connection not found", message: "This connection doesn't exist or you don't have access to it." },
        { status: 404 }
      );
    }

    // ========================================
    // CALCULATE LOCAL DATE
    // ========================================
    const timezone = profile.timezone || "America/New_York";
    const localDateKey = getDayKey(timezone);
    const localDate = localDateKey.replace("day:", ""); // "YYYY-MM-DD"
    const language = profile.language || "en";

    // ========================================
    // CHECK DB FOR EXISTING BRIEF
    // ========================================
    const { data: existingBrief } = await supabase
      .from("daily_briefs")
      .select("*")
      .eq("connection_id", connectionId)
      .eq("local_date", localDate)
      .eq("language", language)
      .eq("prompt_version", PROMPT_VERSION)
      .single();

    if (existingBrief) {
      console.log(`[DailyBrief] Found existing brief for ${connectionId} on ${localDate}`);
      return NextResponse.json(existingBrief);
    }

    console.log(`[DailyBrief] No existing brief for ${connectionId} on ${localDate}, generating...`);

    // ========================================
    // REDIS AVAILABILITY CHECK
    // ========================================
    if (!isRedisAvailable()) {
      console.warn("[DailyBrief] Redis unavailable, failing closed");
      return NextResponse.json(REDIS_UNAVAILABLE_RESPONSE, { status: 503 });
    }

    // ========================================
    // BUDGET CHECK
    // ========================================
    const budgetCheck = await checkBudget();
    if (!budgetCheck.allowed) {
      console.warn("[DailyBrief] Budget exceeded, rejecting request");
      return NextResponse.json(BUDGET_EXCEEDED_RESPONSE, { status: 503 });
    }

    // ========================================
    // ACQUIRE LOCK
    // ========================================
    lockKey = `lock:dailybrief:v${PROMPT_VERSION}:${connectionId}:${localDate}:${language}`;
    const lockResult = await acquireLockFailClosed(lockKey, 60);

    if (lockResult.redisDown) {
      return NextResponse.json(REDIS_UNAVAILABLE_RESPONSE, { status: 503 });
    }

    lockAcquired = lockResult.acquired;

    if (!lockAcquired) {
      // Another request is generating - wait and check DB again
      await new Promise(resolve => setTimeout(resolve, 2000));

      const { data: nowExistingBrief } = await supabase
        .from("daily_briefs")
        .select("*")
        .eq("connection_id", connectionId)
        .eq("local_date", localDate)
        .eq("language", language)
        .eq("prompt_version", PROMPT_VERSION)
        .single();

      if (nowExistingBrief) {
        return NextResponse.json(nowExistingBrief);
      }

      return NextResponse.json(
        { error: "Generation in progress", message: "Please try again in a moment." },
        { status: 503 }
      );
    }

    // ========================================
    // GENERATE DAILY BRIEF
    // ========================================
    const getToneGuidance = (type: string): string => {
      const t = type.toLowerCase();
      if (t === "partner") {
        return "Warm, affectionate tone is appropriate. May reference closeness and partnership.";
      } else if (t === "friend" || t === "colleague") {
        return "Warm, platonic tone. Never romance-coded. Focus on mutual support and camaraderie.";
      } else if (t === "parent" || t === "child" || t === "sibling") {
        return "Family-appropriate tone. Focus on unconditional bonds and care.";
      }
      return "Warm, neutral tone. Default to friend-safe content.";
    };

    const toneGuidance = getToneGuidance(connection.relationship_type);
    const connectionName = connection.name;

    const systemPrompt = `${AYREN_MODE_SHORT}

You are generating a DAILY CONNECTION BRIEF - a light, general "weather report" for the connection today.

CONTEXT:
This is a ${connection.relationship_type} connection with ${connectionName}.

TONE GUIDANCE:
${toneGuidance}

NAMING RULES (STRICT):
- Always use "you" when referring to the person reading this
- Always use "${connectionName}" when referring to the other person
- NEVER use "Person 1", "Person 2", or any impersonal labels
- Use "you and ${connectionName}" phrasing throughout

SAFETY RULES (STRICT):
- This is a GENERAL "weather report" - NOT a detailed analysis
- Never claim to know ${connectionName}'s private thoughts or feelings
- Never be creepy, coercive, or manipulative
- Never give advice to manipulate or trigger ${connectionName}
- Keep it uplifting and general
- Use "may," "might," "could" — not "will" or "is"

OUTPUT FORMAT:
Return ONLY valid JSON:
{
  "title": "Today with ${connectionName}",
  "shared_vibe": "2-4 sentences describing the shared energy today. General, warm, non-invasive. Like a weather report for the connection.",
  "ways_to_show_up": [
    "Action-verb bullet 1 (e.g., 'Listen for what isn't being said')",
    "Action-verb bullet 2 (e.g., 'Share a small appreciation')",
    "Action-verb bullet 3 (e.g., 'Give space when needed')"
  ],
  "nudge": "Optional single line micro-nudge, or null if not needed. Must be gentle, never pushy."
}`;

    const userPrompt = `Generate a daily connection brief for ${connectionName} (${connection.relationship_type}).

The brief should feel like a gentle morning weather report for the connection - light, warm, and supportive.

Ways to show up bullets must:
- Start with an action verb
- Be completable in 10 minutes or less
- Be appropriate for a ${connection.relationship_type} relationship

Return the JSON object now.`;

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

    // Track usage
    void trackAiUsage({
      featureLabel: "Connections • Daily Brief",
      route: "/api/connection-brief",
      model: OPENAI_MODELS.insights,
      promptVersion: PROMPT_VERSION,
      cacheStatus: "miss",
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      totalTokens: completion.usage?.total_tokens || 0,
      userId: user.id,
      timeframe: "today",
      periodKey: localDateKey,
      language,
      timezone,
    });

    void incrementBudget(
      OPENAI_MODELS.insights,
      completion.usage?.prompt_tokens || 0,
      completion.usage?.completion_tokens || 0
    );

    // Parse response
    let briefContent: {
      title: string;
      shared_vibe: string;
      ways_to_show_up: string[];
      nudge: string | null;
    };

    try {
      briefContent = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("[DailyBrief] Failed to parse OpenAI response:", responseContent);
      throw new Error("Invalid response format from AI");
    }

    // Validate required fields
    if (!briefContent.title || !briefContent.shared_vibe || !Array.isArray(briefContent.ways_to_show_up)) {
      throw new Error("Missing required fields in AI response");
    }

    // Ensure exactly 3 ways_to_show_up
    if (briefContent.ways_to_show_up.length !== 3) {
      console.warn(`[DailyBrief] Got ${briefContent.ways_to_show_up.length} ways_to_show_up, expected 3`);
      // Pad or truncate to 3
      while (briefContent.ways_to_show_up.length < 3) {
        briefContent.ways_to_show_up.push("Be present and attentive");
      }
      briefContent.ways_to_show_up = briefContent.ways_to_show_up.slice(0, 3);
    }

    // ========================================
    // SAVE TO DATABASE
    // ========================================
    const { data: savedBrief, error: saveError } = await supabase
      .from("daily_briefs")
      .insert({
        connection_id: connectionId,
        owner_user_id: user.id,
        local_date: localDate,
        language,
        prompt_version: PROMPT_VERSION,
        model_version: OPENAI_MODELS.insights,
        title: briefContent.title,
        shared_vibe: briefContent.shared_vibe,
        ways_to_show_up: briefContent.ways_to_show_up,
        nudge: briefContent.nudge || null,
      })
      .select()
      .single();

    if (saveError) {
      console.error("[DailyBrief] Failed to save to DB:", saveError);
      // Still return the brief even if save fails
      return NextResponse.json({
        ...briefContent,
        connection_id: connectionId,
        local_date: localDate,
        _saved: false,
      });
    }

    // Release lock
    if (lockAcquired) {
      await releaseLock(lockKey!);
    }

    console.log(`[DailyBrief] Generated and saved brief for ${connectionId} on ${localDate}`);
    return NextResponse.json(savedBrief);

  } catch (error: any) {
    console.error("[DailyBrief] Error:", error);

    // Release lock on error
    try {
      if (lockAcquired && lockKey) {
        await releaseLock(lockKey);
      }
    } catch (unlockError) {
      console.error("[DailyBrief] Error releasing lock:", unlockError);
    }

    return NextResponse.json(
      { error: "Generation failed", message: "Unable to generate daily brief. Please try again." },
      { status: 500 }
    );
  }
}
