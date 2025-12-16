import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { SpaceBetweenReport } from "@/types";
import { getCache, setCache } from "@/lib/cache";
import { acquireLockFailClosed, releaseLock, isRedisAvailable, REDIS_UNAVAILABLE_RESPONSE } from "@/lib/cache/redis";
import { checkRateLimit } from "@/lib/cache/rateLimit";
import { touchLastSeen } from "@/lib/activity/touchLastSeen";
import { trackAiUsage } from "@/lib/ai/trackUsage";
import { checkBudget, incrementBudget, BUDGET_EXCEEDED_RESPONSE } from "@/lib/ai/costControl";
import { AYREN_MODE_SOULPRINT_LONG } from "@/lib/ai/voice";

// Rate limits for space between (per user)
const USER_RATE_LIMIT = 10; // 10 requests per hour (more expensive)
const USER_RATE_WINDOW = 3600; // 1 hour
const COOLDOWN_SECONDS = 30; // 30 second cooldown

const PROMPT_VERSION = 1;

/**
 * Space Between API (Layer B)
 *
 * Returns the deep "stone tablet" relationship blueprint.
 * - Generated once (first open) and saved to DB permanently
 * - Never regenerates - immutable once created
 * - Uses linked profile's birth data + social insights if available
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
        { error: "Unauthorized", message: "Please sign in to view Space Between." },
        { status: 401 }
      );
    }

    // Track user activity (non-blocking)
    const admin = createAdminSupabaseClient();
    void touchLastSeen(admin, user.id, 30);

    // ========================================
    // RATE LIMITING
    // ========================================
    const cooldownKey = `spacebetween:cooldown:${user.id}`;
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
      `spacebetween:rate:${user.id}`,
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

    // Validate user has birth data
    if (!profile.birth_date || !profile.timezone) {
      return NextResponse.json(
        {
          error: "Incomplete profile",
          message: "Please complete your birth signature in Settings to view Space Between.",
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
        { error: "Connection not found", message: "This connection doesn't exist or you don't have access to it." },
        { status: 404 }
      );
    }

    // ========================================
    // MUTUAL CHECK GATE
    // ========================================
    // Space Between requires mutual connection (both users have added each other)
    if (!connection.is_mutual) {
      return NextResponse.json(
        {
          error: "MUTUAL_REQUIRED",
          message: `Space Between unlocks when ${connection.name} adds you back. Once they do, this will open automatically.`,
        },
        { status: 403 }
      );
    }

    const language = profile.language || "en";

    // ========================================
    // CHECK DB FOR EXISTING REPORT (STONE TABLET)
    // ========================================
    const { data: existingReport } = await supabase
      .from("space_between_reports")
      .select("*")
      .eq("connection_id", connectionId)
      .eq("language", language)
      .eq("prompt_version", PROMPT_VERSION)
      .single();

    if (existingReport) {
      console.log(`[SpaceBetween] Found existing stone tablet for ${connectionId}`);
      return NextResponse.json(existingReport);
    }

    console.log(`[SpaceBetween] No existing report for ${connectionId}, generating stone tablet...`);

    // ========================================
    // GATHER LINKED PROFILE DATA (IF AVAILABLE)
    // ========================================
    let linkedBirthData: {
      birth_date: string | null;
      birth_time: string | null;
      birth_city: string | null;
      birth_region: string | null;
      birth_country: string | null;
    } | null = null;
    let linkedSocialData: string | null = null;
    let includesLinkedBirthData = false;
    let includesLinkedSocialData = false;

    // First check connection's own birth data
    let connectionBirthData = {
      birth_date: connection.birth_date,
      birth_time: connection.birth_time,
      birth_city: connection.birth_city,
      birth_region: connection.birth_region,
      birth_country: connection.birth_country,
    };

    // If linked to a real profile, use their data
    if (connection.linked_profile_id) {
      const { data: linkedProfile } = await supabase
        .from("profiles")
        .select("birth_date, birth_time, birth_city, birth_region, birth_country")
        .eq("id", connection.linked_profile_id)
        .single();

      if (linkedProfile && linkedProfile.birth_date) {
        linkedBirthData = linkedProfile;
        connectionBirthData = {
          birth_date: linkedProfile.birth_date,
          birth_time: linkedProfile.birth_time,
          birth_city: linkedProfile.birth_city,
          birth_region: linkedProfile.birth_region,
          birth_country: linkedProfile.birth_country,
        };
        includesLinkedBirthData = true;
      }

      // Try to get social insights summary (if available)
      const { data: socialSummaries } = await supabase
        .from("social_summaries")
        .select("summary")
        .eq("user_id", connection.linked_profile_id);

      if (socialSummaries && socialSummaries.length > 0) {
        linkedSocialData = socialSummaries.map(s => s.summary).join(" ");
        includesLinkedSocialData = true;
      }
    }

    // ========================================
    // REDIS AVAILABILITY CHECK
    // ========================================
    if (!isRedisAvailable()) {
      console.warn("[SpaceBetween] Redis unavailable, failing closed");
      return NextResponse.json(REDIS_UNAVAILABLE_RESPONSE, { status: 503 });
    }

    // ========================================
    // BUDGET CHECK
    // ========================================
    const budgetCheck = await checkBudget();
    if (!budgetCheck.allowed) {
      console.warn("[SpaceBetween] Budget exceeded, rejecting request");
      return NextResponse.json(BUDGET_EXCEEDED_RESPONSE, { status: 503 });
    }

    // ========================================
    // ACQUIRE LOCK
    // ========================================
    lockKey = `lock:spacebetween:v${PROMPT_VERSION}:${connectionId}:${language}`;
    const lockResult = await acquireLockFailClosed(lockKey, 120); // 2 min timeout for long generation

    if (lockResult.redisDown) {
      return NextResponse.json(REDIS_UNAVAILABLE_RESPONSE, { status: 503 });
    }

    lockAcquired = lockResult.acquired;

    if (!lockAcquired) {
      await new Promise(resolve => setTimeout(resolve, 3000));

      const { data: nowExistingReport } = await supabase
        .from("space_between_reports")
        .select("*")
        .eq("connection_id", connectionId)
        .eq("language", language)
        .eq("prompt_version", PROMPT_VERSION)
        .single();

      if (nowExistingReport) {
        return NextResponse.json(nowExistingReport);
      }

      return NextResponse.json(
        { error: "Generation in progress", message: "Please try again in a moment." },
        { status: 503 }
      );
    }

    // ========================================
    // GENERATE SPACE BETWEEN REPORT
    // ========================================
    const getToneGuidance = (type: string): string => {
      const t = type.toLowerCase();
      if (t === "partner") {
        return "Romantic, intimate tone is appropriate. May reference emotional and physical closeness, partnership dynamics, and shared intimacy.";
      } else if (t === "friend" || t === "colleague") {
        return "Warm, platonic tone. Never romance-coded. Focus on mutual respect, support, camaraderie, and collaborative energy.";
      } else if (t === "parent" || t === "child" || t === "sibling") {
        return "Family-appropriate tone. Focus on unconditional bonds, generational patterns, growth, and familial love.";
      }
      return "Warm, neutral tone. Default to friend-safe content.";
    };

    const toneGuidance = getToneGuidance(connection.relationship_type);
    const userName = profile.preferred_name || profile.full_name || "you";
    const connectionName = connection.name;

    // Build birth data context
    const userBirthContext = `${userName}'s birth signature:
- Birth date: ${profile.birth_date}
- Birth time: ${profile.birth_time || "unknown (use solar chart approach)"}
- Birth location: ${profile.birth_city || "unknown"}, ${profile.birth_region || ""}, ${profile.birth_country || ""}
- Timezone: ${profile.timezone}`;

    const connectionBirthContext = `${connectionName}'s birth signature:
- Birth date: ${connectionBirthData.birth_date || "unknown"}
- Birth time: ${connectionBirthData.birth_time || "unknown (use solar chart approach)"}
- Birth location: ${connectionBirthData.birth_city || "unknown"}, ${connectionBirthData.birth_region || ""}, ${connectionBirthData.birth_country || ""}
${includesLinkedBirthData ? "(This is verified birth data from their Solara profile)" : "(Birth data provided by " + userName + ")"}`;

    const socialContext = includesLinkedSocialData
      ? `\n\nAdditional context about ${connectionName} from their social presence:\n${linkedSocialData}`
      : "";

    const systemPrompt = `${AYREN_MODE_SOULPRINT_LONG}

You are generating a SPACE BETWEEN REPORT - a deep "stone tablet" relationship blueprint.

CONTEXT:
This is a ${connection.relationship_type} connection between ${userName} and ${connectionName}.
This report will be generated ONCE and saved permanently. Make it meaningful and comprehensive.

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

OUTPUT FORMAT:
Return ONLY valid JSON with 5 sections, each 2-3 paragraphs:
{
  "relationship_essence": "The core soul signature of this connection. What makes ${userName} and ${connectionName} drawn to each other? What fundamental dynamic exists between you? 2-3 paragraphs.",
  "emotional_blueprint": "How ${userName} and ${connectionName} feel together. Emotional rhythms, safety patterns, vulnerabilities that emerge in this space. 2-3 paragraphs.",
  "communication_patterns": "How ${userName} and ${connectionName} communicate, listen, and express. Potential friction points and gifts in how you exchange ideas and feelings. 2-3 paragraphs.",
  "growth_edges": "Where ${userName} and ${connectionName} stretch each other. The growth invitations present in this connection. What each person may learn from the other. 2-3 paragraphs.",
  "care_guide": "How ${userName} can show up for ${connectionName}, and vice versa. Concrete ways to nurture this connection. Include 2-3 specific micro-actions. 2-3 paragraphs."
}`;

    const userPrompt = `Generate a Space Between report for the ${connection.relationship_type} connection between ${userName} and ${connectionName}.

${userBirthContext}

${connectionBirthContext}${socialContext}

This is a deep, permanent relationship blueprint. Make each section rich, specific, and meaningful.
Use their names throughout. Never use impersonal labels.

Return the JSON object now.`;

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODELS.deep, // Use deeper model for stone tablet
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error("No response from OpenAI");
    }

    // Track usage
    void trackAiUsage({
      featureLabel: "Connections • Space Between",
      route: "/api/connection-space-between",
      model: OPENAI_MODELS.deep,
      promptVersion: PROMPT_VERSION,
      cacheStatus: "miss",
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      totalTokens: completion.usage?.total_tokens || 0,
      userId: user.id,
      timeframe: "permanent",
      periodKey: "stone_tablet",
      language,
      timezone: profile.timezone || null,
    });

    void incrementBudget(
      OPENAI_MODELS.deep,
      completion.usage?.prompt_tokens || 0,
      completion.usage?.completion_tokens || 0
    );

    // Parse response
    let reportContent: {
      relationship_essence: string;
      emotional_blueprint: string;
      communication_patterns: string;
      growth_edges: string;
      care_guide: string;
    };

    try {
      reportContent = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("[SpaceBetween] Failed to parse OpenAI response:", responseContent);
      throw new Error("Invalid response format from AI");
    }

    // Validate required fields
    const requiredFields = [
      "relationship_essence",
      "emotional_blueprint",
      "communication_patterns",
      "growth_edges",
      "care_guide",
    ];

    for (const field of requiredFields) {
      if (!reportContent[field as keyof typeof reportContent]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // ========================================
    // SAVE TO DATABASE (STONE TABLET)
    // ========================================
    const { data: savedReport, error: saveError } = await supabase
      .from("space_between_reports")
      .insert({
        connection_id: connectionId,
        owner_user_id: user.id,
        language,
        prompt_version: PROMPT_VERSION,
        model_version: OPENAI_MODELS.deep,
        includes_linked_birth_data: includesLinkedBirthData,
        includes_linked_social_data: includesLinkedSocialData,
        linked_profile_id: connection.linked_profile_id || null,
        relationship_essence: reportContent.relationship_essence,
        emotional_blueprint: reportContent.emotional_blueprint,
        communication_patterns: reportContent.communication_patterns,
        growth_edges: reportContent.growth_edges,
        care_guide: reportContent.care_guide,
      })
      .select()
      .single();

    if (saveError) {
      console.error("[SpaceBetween] Failed to save to DB:", saveError);
      // Still return the report even if save fails
      return NextResponse.json({
        ...reportContent,
        connection_id: connectionId,
        includes_linked_birth_data: includesLinkedBirthData,
        includes_linked_social_data: includesLinkedSocialData,
        _saved: false,
      });
    }

    // Release lock
    if (lockAcquired) {
      await releaseLock(lockKey!);
    }

    console.log(`[SpaceBetween] Generated and saved stone tablet for ${connectionId}`);
    return NextResponse.json(savedReport);

  } catch (error: any) {
    console.error("[SpaceBetween] Error:", error);

    // Release lock on error
    try {
      if (lockAcquired && lockKey) {
        await releaseLock(lockKey);
      }
    } catch (unlockError) {
      console.error("[SpaceBetween] Error releasing lock:", unlockError);
    }

    return NextResponse.json(
      { error: "Generation failed", message: "Unable to generate Space Between report. Please try again." },
      { status: 500 }
    );
  }
}
