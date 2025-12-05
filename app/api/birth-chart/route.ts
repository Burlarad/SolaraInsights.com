import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { FullBirthChartInsight } from "@/types";

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user and their profile
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in to view your birth chart." },
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

    // Validate required birth details (including region and country for full location)
    if (
      !profile.birth_date ||
      !profile.birth_city ||
      !profile.birth_region ||
      !profile.birth_country ||
      !profile.timezone
    ) {
      return NextResponse.json(
        {
          error: "Incomplete profile",
          message:
            "We need your full birth date, time, and location in Settings to generate your birth chart.",
          missingFields: {
            birth_date: !profile.birth_date,
            birth_time: !profile.birth_time,
            birth_city: !profile.birth_city,
            birth_region: !profile.birth_region,
            birth_country: !profile.birth_country,
            timezone: !profile.timezone,
          },
        },
        { status: 400 }
      );
    }

    // Build location string
    const locationString = `${profile.birth_city}, ${profile.birth_region}, ${profile.birth_country}`;

    // Construct the OpenAI prompt for a full birth chart
    const systemPrompt = `You are a compassionate astrologer for Solara Insights.

Core principles:
- Always uplifting, never deterministic or fear-based
- Emphasize free will, growth, and agency
- Use plain, dyslexia-friendly language with short paragraphs (2-4 sentences max per description)
- Do NOT give medical, legal, or financial advice
- Do NOT output technical degrees or ephemeris numbers—just conceptual, meaningful placements
- Focus on emotional intelligence and practical wisdom

You must respond with ONLY valid JSON matching the FullBirthChartInsight structure. No additional text, no markdown, no explanations—just the JSON object.`;

    const userPrompt = `Generate a complete natal birth chart for ${profile.preferred_name || profile.full_name || "this person"}.

Birth details:
- Date: ${profile.birth_date}
- Time: ${profile.birth_time || "unknown birth time; use solar chart approach"}
- Location: ${locationString}
- Timezone: ${profile.timezone}

${
  !profile.birth_time
    ? "NOTE: Birth time is unknown, so use a solar chart approach (houses and angles will be less precise)."
    : ""
}

Return a JSON object with this EXACT structure:

{
  "blueprint": {
    "birthDate": "${profile.birth_date}",
    "birthTime": ${profile.birth_time ? `"${profile.birth_time}"` : "null"},
    "birthLocation": "${locationString}",
    "timezone": "${profile.timezone}"
  },
  "planets": [
    // Array of 12 objects for: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, North Node, Chiron
    // Each object: { "name": "Sun", "sign": "Taurus", "house": "10th house", "description": "2-4 sentences about this placement" }
    // If birth time unknown, omit "house" field for each planet
  ],
  "houses": [
    // Array of 12 objects for all houses (1st through 12th)
    // Each object: { "house": "1st", "signOnCusp": "Gemini", "themes": "1-2 sentences about key life themes for this house in THIS chart" }
    // If birth time unknown, provide general themes but note they are less precise
  ],
  "angles": {
    "ascendant": { "sign": "Gemini", "description": "2-3 sentences about what this rising sign means for their outward expression" },
    "midheaven": { "sign": "Aquarius", "description": "2-3 sentences about career/public life" },
    "descendant": { "sign": "Sagittarius", "description": "2-3 sentences about partnership approach" },
    "ic": { "sign": "Leo", "description": "2-3 sentences about roots and inner world" }
  },
  "aspects": [
    // Array of 5-7 most important aspects (e.g., Sun square Moon, Venus trine Mars)
    // Each object: { "between": "Sun square Moon", "type": "square", "impact": "2-3 sentences about the psychological meaning" }
  ],
  "patterns": {
    "elements": {
      "fire": 3,
      "earth": 2,
      "air": 5,
      "water": 2,
      "summary": "1-2 paragraphs explaining the element balance and what it means for their temperament"
    },
    "modalities": {
      "cardinal": 4,
      "fixed": 3,
      "mutable": 5,
      "summary": "1-2 paragraphs explaining their mode balance and approach to life"
    },
    "chartRuler": {
      "planet": "Mercury",
      "sign": "Taurus",
      "house": "11th house",
      "description": "2-3 paragraphs about how the chart ruler colors the entire chart and life approach"
    },
    "majorThemes": "2-4 paragraphs synthesizing the big themes, emotional blocks, and growth edges from the entire chart"
  }
}

Focus on:
- Providing a conceptual, meaningful chart (not technical calculations)
- Warm, non-fatalistic language
- Actionable insights for growth and self-understanding
- Integration of all chart elements into a coherent narrative`;

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODELS.insights,
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

    // Parse and validate the JSON response
    let birthChart: FullBirthChartInsight;
    try {
      birthChart = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", responseContent);
      throw new Error("Invalid response format from AI");
    }

    // Return the full birth chart insight
    return NextResponse.json(birthChart);
  } catch (error: any) {
    console.error("Error generating birth chart:", error);
    return NextResponse.json(
      {
        error: "Generation failed",
        message: "We couldn't generate your birth chart. Please try again in a moment.",
      },
      { status: 500 }
    );
  }
}
