import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { InsightsRequest, SanctuaryInsight } from "@/types";

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body: InsightsRequest = await req.json();
    const { timeframe, focusQuestion } = body;

    // Get authenticated user and their profile
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in to access insights." },
        { status: 401 }
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
        {
          error: "Profile not found",
          message: "Unable to load your profile. Please try again.",
        },
        { status: 404 }
      );
    }

    // Validate required birth details
    if (!profile.birth_date || !profile.timezone) {
      return NextResponse.json(
        {
          error: "Incomplete profile",
          message: "Please complete your birth signature in Settings to receive personalized insights.",
        },
        { status: 400 }
      );
    }

    // Optionally load social summary for Facebook (if available)
    const { data: socialSummary } = await supabase
      .from("social_summaries")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "facebook")
      .order("last_collected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Construct the OpenAI prompt
    const systemPrompt = `You are a compassionate astrology guide for Solara Insights, a sanctuary of calm, emotionally intelligent guidance.

Core principles:
- Always uplifting, never deterministic or fear-based
- Emphasize free will, growth, and agency
- Use plain, dyslexia-friendly language with short paragraphs
- Avoid medical, legal, or financial advice
- Focus on emotional intelligence and practical wisdom

You must respond with ONLY valid JSON matching this exact structure. No additional text, no markdown, no explanations—just the JSON object.`;

    const userPrompt = `Generate ${timeframe} insights for ${profile.preferred_name || profile.full_name || "this person"}.

Birth details:
- Date: ${profile.birth_date}
- Time: ${profile.birth_time || "unknown"}
- Location: ${profile.birth_city || "unknown"}, ${profile.birth_region || ""}, ${profile.birth_country || ""}
- Timezone: ${profile.timezone}
- Sign: ${profile.zodiac_sign || "unknown"}

Current date: ${new Date().toISOString()}
Timeframe: ${timeframe}
${focusQuestion ? `Focus question: ${focusQuestion}` : ""}

${socialSummary?.summary ? `Social context (optional, do not mention platforms directly):

${socialSummary.summary}

If this block is empty or missing, ignore it. Use it subtly to enhance your understanding of their emotional tone and expression patterns.` : ""}

Return a JSON object with this structure:
{
  "personalNarrative": "2-3 paragraphs of gentle, personalized guidance",
  "emotionalCadence": {
    "dawn": "one-word emotional state",
    "midday": "one-word emotional state",
    "dusk": "one-word emotional state"
  },
  "coreThemes": ["theme1", "theme2", "theme3"],
  "focusForPeriod": "one paragraph of practical focus",
  "tarot": {
    "cardName": "card name",
    "arcanaType": "Major or Minor Arcana",
    "summary": "one sentence",
    "symbolism": "one paragraph",
    "guidance": "one paragraph"
  },
  "rune": {
    "name": "rune name",
    "keyword": "one word",
    "meaning": "one paragraph",
    "affirmation": "one sentence"
  },
  "luckyCompass": {
    "numbers": [
      {"value": 18, "label": "ROOT", "meaning": "one sentence"},
      {"value": 56, "label": "ROOT", "meaning": "one sentence"},
      {"value": 66, "label": "ROOT", "meaning": "one sentence"}
    ],
    "powerWords": ["WORD1", "WORD2", "WORD3"],
    "handwrittenNote": "1-2 sentence affirmation"
  },
  "journalPrompt": "A gentle reflection question for their private journal"
}`;

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODELS.insights,
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

    // Parse and validate the JSON response
    let insight: SanctuaryInsight;
    try {
      insight = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", responseContent);
      throw new Error("Invalid response format from AI");
    }

    // Return the insight
    return NextResponse.json(insight);
  } catch (error: any) {
    console.error("Error generating insights:", error);
    return NextResponse.json(
      {
        error: "Generation failed",
        message: "We couldn't tune today's insight. Please try again in a moment.",
      },
      { status: 500 }
    );
  }
}
