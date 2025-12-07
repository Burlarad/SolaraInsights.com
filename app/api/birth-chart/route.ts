import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { FullBirthChartInsight } from "@/types";
import { getCache, setCache } from "@/lib/cache";
import { createHash } from "crypto";

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

    // ========================================
    // CACHING LAYER
    // ========================================

    // Create a signature of birth details to use as cache key
    const birthSignature = `${profile.birth_date}|${profile.birth_time || "unknown"}|${profile.birth_city}|${profile.birth_region}|${profile.birth_country}|${profile.timezone}`;
    const hash = createHash("sha256").update(birthSignature).digest("hex").slice(0, 16);
    const cacheKey = `birthChart:v1:${user.id}:${hash}`;

    // Check cache
    const cachedChart = await getCache<FullBirthChartInsight>(cacheKey);
    if (cachedChart) {
      console.log(`[BirthChart] Cache hit for ${cacheKey}`);
      return NextResponse.json(cachedChart);
    }

    console.log(`[BirthChart] Cache miss for ${cacheKey}, generating fresh birth chart...`);

    // Construct the OpenAI prompt for a full birth chart
    const systemPrompt = `You are a compassionate astrologer for Solara Insights.

ASTROLOGICAL SYSTEM TO USE (THIS IS REQUIRED, DO NOT IGNORE):

- Zodiac: Western tropical (NOT sidereal). Aries begins at 0° on the March equinox.
- House system: Placidus (time-sensitive, quadrant-based).
- Aspects: Use major aspects only:
  - conjunction, opposition, trine, square, sextile.
- Aspect orbs (approximate):
  - conjunction: up to ~8°
  - opposition: up to ~8°
  - trine: up to ~6°
  - square: up to ~7°
  - sextile: up to ~6°.
- Birthplace matters: City, region/state, and country are ALL critically important and must be used together to locate the correct place on Earth for house and rising sign calculations. Do not ignore any part of the location.
- Rising sign (Ascendant):
  - When birth time is known, you MUST compute the Ascendant from the local birth time, birthplace (city + region/state + country), and timezone using Western tropical + Placidus.
  - The Ascendant's sign is the Rising sign and must be consistent with the chart's time and location.
  - The Rising sign is one of the three most important placements (Sun, Moon, Rising) and must be accurate.
- Unknown birth time:
  - Use a solar chart approach (Sun on the Ascendant, equal houses from the Sun).
  - Be explicit that houses and angles are approximate/less precise when time is unknown.

Core principles:
- Always uplifting, never deterministic or fear-based.
- Emphasize free will, growth, and agency.
- Use plain, dyslexia-friendly language with short paragraphs (2–4 sentences max per description).
- Do NOT give medical, legal, or financial advice.
- Do NOT output technical degrees or ephemeris numbers—just conceptual, meaningful placements.
- Focus on emotional intelligence and practical wisdom.

You must respond with ONLY valid JSON matching the FullBirthChartInsight structure. No additional text, no markdown, no explanations—just the JSON object.`;

    const userPrompt = `Generate a complete natal birth chart for ${profile.preferred_name || profile.full_name || "this person"}.

Birth details (ALL of these are critical for accurate Sun, Moon, and Rising calculations):
- Birth date: ${profile.birth_date} (YYYY-MM-DD format)
- Local birth time: ${profile.birth_time || "unknown birth time; use solar chart approach"} (this is the time at the birthplace in the local timezone, NOT UTC)
- Birthplace city: ${profile.birth_city}
- Birthplace region/state: ${profile.birth_region}
- Birthplace country: ${profile.birth_country}
- Full location string: ${locationString}
- Timezone at birth: ${profile.timezone} (IANA timezone for the birthplace at the time of birth)

IMPORTANT: You must use the COMPLETE birthplace (city + region/state + country) to determine the correct geographic location on Earth. This is essential for calculating the Rising sign (Ascendant) and house cusps accurately using the Placidus system.

${
  !profile.birth_time
    ? "NOTE: Birth time is unknown, so use a solar chart approach (Sun on the Ascendant, equal houses from the Sun). Houses and angles will be approximate/less precise. Omit house placements for planets and note the limitation in angle descriptions."
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
    // Sun and Moon MUST always be included with accurate signs calculated using Western tropical zodiac from the birth date.
    // Each object: { "name": "Sun", "sign": "Taurus", "house": "10th house", "description": "2-4 sentences about this placement" }
    // If birth time is known, include "house" field for each planet (calculated using Placidus houses).
    // If birth time unknown, omit "house" field for each planet.
    // The Sun and Moon are two of the three most important placements (along with Rising/Ascendant) and must be computed correctly.
  ],
  "houses": [
    // Array of 12 objects for all houses (1st through 12th)
    // Each object: { "house": "1st", "signOnCusp": "Gemini", "themes": "1-2 sentences about key life themes for this house in THIS chart" }
    // If birth time unknown, provide general themes but note they are less precise
  ],
  "angles": {
    // The ascendant.sign is the Rising sign and MUST be computed from the birth date, local birth time, birthplace (city + region/state + country), and timezone using the Western tropical zodiac and Placidus house system.
    // The Rising sign (Ascendant) is one of the three most important placements (Sun, Moon, Rising) and must be accurate.
    // When birth time is known, calculate the exact Ascendant sign based on the time and location. When birth time is unknown, use the solar chart approach (Sun's sign = Ascendant sign).
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

    // Cache the birth chart (TTL: 30 days - birth charts are stable unless birth data changes)
    await setCache(cacheKey, birthChart, 60 * 60 * 24 * 30);

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
