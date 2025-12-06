import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { ConnectionInsight } from "@/types";
import { getCache, setCache, getDayKey } from "@/lib/cache";

export async function POST(req: NextRequest) {
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
    const cacheKey = `connectionInsight:v1:${user.id}:${connectionId}:${requestTimeframe}:${periodKey}`;

    // Check cache
    const cachedInsight = await getCache<ConnectionInsight>(cacheKey);
    if (cachedInsight) {
      console.log(`[ConnectionInsight] Cache hit for ${cacheKey}`);
      return NextResponse.json(cachedInsight);
    }

    console.log(`[ConnectionInsight] Cache miss for ${cacheKey}, generating fresh insight...`);

    // Construct OpenAI prompt
    const systemPrompt = `You are a compassionate relationship and connection guide for Solara Insights, a sanctuary of calm, emotionally intelligent guidance.

Core principles:
- Always uplifting, never deterministic or fear-based
- Emphasize free will, growth, and agency
- Use plain, dyslexia-friendly language with short paragraphs (2-4 sentences max)
- Avoid medical, legal, or financial advice
- Focus on emotional intelligence and practical wisdom
- You are describing the DYNAMIC BETWEEN TWO PEOPLE, not just one person

You must respond with ONLY valid JSON matching this exact structure. No additional text, no markdown, no explanations—just the JSON object.`;

    const userPrompt = `Generate a relational insight for the connection between these two people.

Person 1 (the owner):
- Birth date: ${profile.birth_date}
- Birth time: ${profile.birth_time || "unknown (use solar chart approach)"}
- Birth location: ${profile.birth_city || "unknown"}, ${profile.birth_region || ""}, ${profile.birth_country || ""}
- Timezone: ${profile.timezone}

Person 2 (the connection):
- Name: ${connection.name}
- Relationship type: ${connection.relationship_type}
- Birth date: ${connectionBirthData.birth_date || "unknown"}
- Birth time: ${connectionBirthData.birth_time || "unknown (use solar chart approach)"}
- Birth location: ${connectionBirthData.birth_city || "unknown"}, ${connectionBirthData.birth_region || ""}, ${connectionBirthData.birth_country || ""}

Return a JSON object with this structure:
{
  "overview": "1-2 short paragraphs about the overall energy and essence of this ${connection.relationship_type} connection",
  "emotionalDynamics": "2-3 short paragraphs about how they tend to feel around each other, where they might regulate or trigger each other, and their emotional rhythms together",
  "communication": "2-3 short paragraphs about how they can better communicate and really hear each other, including specific ways to bridge any natural differences in their communication styles",
  "careSuggestions": "2-3 short paragraphs with concrete, simple ways Person 1 can care for and support Person 2 in a day-to-day way, based on their relational dynamic"
}

Write in a warm, gentle tone. Focus on meaning and practical insight, not technical astrology terms.`;

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

    // Return the connection insight
    return NextResponse.json(insight);
  } catch (error: any) {
    console.error("Error generating connection insight:", error);
    return NextResponse.json(
      {
        error: "Generation failed",
        message: "We couldn't open this connection's insight. Please try again in a moment.",
      },
      { status: 500 }
    );
  }
}
