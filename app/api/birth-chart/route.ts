import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { FullBirthChartInsight } from "@/types";
import { getCache, setCache } from "@/lib/cache";
import { createHash } from "crypto";
import { generateBirthChartPlacements } from "./generatePlacements";

export async function POST(_req: NextRequest) {
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

    // ========================================
    // CACHING LAYER
    // ========================================

    // Create a signature of birth details to use as cache key
    // v2_placements = two-step pipeline (placements first, then interpretation)
    const birthSignature = `${profile.birth_date}|${profile.birth_time || "unknown"}|${profile.birth_city}|${profile.birth_region}|${profile.birth_country}|${profile.timezone}`;
    const hash = createHash("sha256").update(birthSignature).digest("hex").slice(0, 16);
    const cacheKey = `birthChart:v2_placements:${user.id}:${hash}`;

    // Check cache
    const cachedChart = await getCache<FullBirthChartInsight>(cacheKey);
    if (cachedChart) {
      // Check if cached chart has UTC timezone - if so, treat as stale and regenerate
      if (cachedChart.blueprint?.timezone === "UTC") {
        console.log(`[BirthChart] Cached chart has UTC timezone; treating as stale and regenerating with timezone inference.`);
        // Fall through to regeneration
      } else {
        console.log(`[BirthChart] Cache hit for ${cacheKey}`);
        return NextResponse.json(cachedChart);
      }
    }

    console.log(`[BirthChart] ${cachedChart ? "Cache stale (UTC timezone)" : "Cache miss"} for ${cacheKey}, generating fresh birth chart using two-step pipeline...`);

    // ========================================
    // STEP A: GENERATE PLACEMENTS (RAW ASTRO MATH)
    // ========================================

    const placements = await generateBirthChartPlacements({
      birth_date: profile.birth_date,
      birth_time: profile.birth_time,
      birth_city: profile.birth_city,
      birth_region: profile.birth_region,
      birth_country: profile.birth_country,
      timezone: profile.timezone,
      preferred_name: profile.preferred_name,
      full_name: profile.full_name,
    });

    console.log(`[BirthChart] Step A complete. Placements: Sun=${placements.planets.find(p => p.name === "Sun")?.sign}, Moon=${placements.planets.find(p => p.name === "Moon")?.sign}, Rising=${placements.angles.ascendant.sign}`);

    // ========================================
    // STEP B: GENERATE INTERPRETATION FROM PLACEMENTS
    // ========================================

    // Construct the OpenAI prompt for interpretation (not re-computation)
    const systemPrompt = `You are a compassionate astrologer for Solara Insights.

CRITICAL: You are given a complete set of natal chart placements that have already been computed using Western tropical zodiac and Placidus houses.

You MUST NOT recompute or change any placements, signs, houses, or aspects.
You MUST NOT modify the Sun sign, Moon sign, Rising sign (Ascendant), or any other placement.

Your ONLY job is to interpret the placements you are given and return a FullBirthChartInsight JSON object with descriptions, themes, and narratives.

If you disagree with the placements, you must still treat them as authoritative and interpret them as given.

Core principles:
- Always uplifting, never deterministic or fear-based.
- Emphasize free will, growth, and agency.
- Use plain, dyslexia-friendly language with short paragraphs (2–4 sentences max per description).
- Do NOT give medical, legal, or financial advice.
- Do NOT output technical degrees or ephemeris numbers—just conceptual, meaningful placements.
- Focus on emotional intelligence and practical wisdom.

You must respond with ONLY valid JSON matching the FullBirthChartInsight structure. No additional text, no markdown, no explanations—just the JSON object.`;

    const userPrompt = `Using the following pre-computed natal chart placements, generate a complete birth chart interpretation for ${profile.preferred_name || profile.full_name || "this person"}.

CRITICAL: Do NOT change any placements. Use them EXACTLY as given below.

Pre-computed placements JSON (Western tropical zodiac + Placidus houses):
${JSON.stringify(placements, null, 2)}

Return a JSON object with this EXACT structure (using the placements provided above):

{
  "blueprint": {
    "birthDate": "${placements.blueprint.birthDate}",
    "birthTime": ${placements.blueprint.birthTime ? `"${placements.blueprint.birthTime}"` : "null"},
    "birthLocation": "${placements.blueprint.birthLocation}",
    "timezone": "${placements.blueprint.timezone}"
  },
  "planets": [
    // Array of 12 objects for: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, North Node, Chiron
    // USE THE EXACT SIGNS AND HOUSES FROM THE PLACEMENTS JSON ABOVE. DO NOT RECOMPUTE.
    // Each object: { "name": "Sun", "sign": "Taurus", "house": "10th house", "description": "2-4 sentences interpreting this placement" }
    // Convert house numbers from placements (e.g., 10) to ordinal strings (e.g., "10th house")
    // If house is not provided in placements, omit the "house" field
  ],
  "houses": [
    // Array of 12 objects for all houses (1st through 12th)
    // USE THE EXACT SIGN ON CUSP FROM THE PLACEMENTS JSON ABOVE. DO NOT RECOMPUTE.
    // Each object: { "house": "1st", "signOnCusp": "Gemini", "themes": "1-2 sentences about key life themes for this house in THIS chart" }
    // Convert house numbers from placements (e.g., 1) to ordinal strings (e.g., "1st")
  ],
  "angles": {
    // USE THE EXACT SIGNS FROM THE PLACEMENTS JSON ABOVE. DO NOT RECOMPUTE.
    // The ascendant.sign from placements is the Rising sign.
    "ascendant": { "sign": "${placements.angles.ascendant.sign}", "description": "2-3 sentences about what this rising sign means for their outward expression" },
    "midheaven": { "sign": "${placements.angles.midheaven.sign}", "description": "2-3 sentences about career/public life" },
    "descendant": { "sign": "${placements.angles.descendant.sign}", "description": "2-3 sentences about partnership approach" },
    "ic": { "sign": "${placements.angles.ic.sign}", "description": "2-3 sentences about roots and inner world" }
  },
  "aspects": [
    // Array of 5-7 aspects
    // USE THE EXACT ASPECTS FROM THE PLACEMENTS JSON ABOVE. DO NOT RECOMPUTE OR ADD NEW ASPECTS.
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
- Interpreting the given placements (DO NOT change signs, houses, or aspects)
- Providing a conceptual, meaningful interpretation (not technical recalculations)
- Warm, non-fatalistic language
- Actionable insights for growth and self-understanding
- Integration of all chart elements into a coherent narrative

REMINDER: You are interpreting PRE-COMPUTED placements. The Sun sign, Moon sign, Rising sign, houses, and aspects are already determined. Your job is ONLY to write descriptions and interpretations.`;

    // Call OpenAI for interpretation
    console.log(`[BirthChart] Step B: Generating interpretation from placements...`);

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODELS.insights,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7, // Higher temperature for creative interpretation
      response_format: { type: "json_object" },
    });

    console.log(`[BirthChart] Step B complete. Interpretation generated.`);

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

    // ========================================
    // GUARDRAILS: Validate Step B didn't change Sun, Moon, Rising, or Timezone
    // ========================================
    const sunFromStepA = placements.planets.find((p) => p.name === "Sun")?.sign;
    const moonFromStepA = placements.planets.find((p) => p.name === "Moon")?.sign;
    const risingFromStepA = placements.angles.ascendant.sign;
    const timezoneFromStepA = placements.blueprint.timezone;

    const sunFromStepB = birthChart.planets.find((p) => p.name === "Sun")?.sign;
    const moonFromStepB = birthChart.planets.find((p) => p.name === "Moon")?.sign;
    const risingFromStepB = birthChart.angles.ascendant.sign;
    const timezoneFromStepB = birthChart.blueprint.timezone;

    if (sunFromStepA !== sunFromStepB) {
      console.error(`[BirthChart] GUARDRAIL VIOLATION: Step B changed Sun sign from ${sunFromStepA} to ${sunFromStepB}`);
      throw new Error(`Step B modified Sun placement: expected ${sunFromStepA}, got ${sunFromStepB}`);
    }

    if (moonFromStepA !== moonFromStepB) {
      console.error(`[BirthChart] GUARDRAIL VIOLATION: Step B changed Moon sign from ${moonFromStepA} to ${moonFromStepB}`);
      throw new Error(`Step B modified Moon placement: expected ${moonFromStepA}, got ${moonFromStepB}`);
    }

    if (risingFromStepA !== risingFromStepB) {
      console.error(`[BirthChart] GUARDRAIL VIOLATION: Step B changed Rising sign from ${risingFromStepA} to ${risingFromStepB}`);
      throw new Error(`Step B modified Rising sign: expected ${risingFromStepA}, got ${risingFromStepB}`);
    }

    if (timezoneFromStepA !== timezoneFromStepB) {
      console.error(`[BirthChart] GUARDRAIL VIOLATION: Step B changed timezone from ${timezoneFromStepA} to ${timezoneFromStepB}`);
      // Force it to use the correct timezone from Step A
      birthChart.blueprint.timezone = timezoneFromStepA;
      console.log(`[BirthChart] Timezone corrected to ${timezoneFromStepA}`);
    }

    // Preserve timezoneWasInferred flag from Step A
    if (placements.blueprint.timezoneWasInferred !== undefined) {
      birthChart.blueprint.timezoneWasInferred = placements.blueprint.timezoneWasInferred;
    }

    console.log(`[BirthChart] Guardrails passed: Sun=${sunFromStepB}, Moon=${moonFromStepB}, Rising=${risingFromStepB}, Timezone=${birthChart.blueprint.timezone}${birthChart.blueprint.timezoneWasInferred ? " (inferred)" : ""}`);

    // Cache the birth chart (TTL: 30 days - birth charts are stable unless birth data changes)
    await setCache(cacheKey, birthChart, 60 * 60 * 24 * 30);

    // Return the full birth chart insight
    return NextResponse.json(birthChart);
  } catch (error: any) {
    // Enhanced error logging for debugging
    console.error("[BirthChart] FULL ERROR DETAILS:", {
      message: error?.message ?? "Unknown error",
      name: error?.name ?? "Error",
      stack: error?.stack,
      cause: error?.cause,
      // Log first 500 chars of full error object for context
      raw: JSON.stringify(error, Object.getOwnPropertyNames(error)).slice(0, 500),
    });

    return NextResponse.json(
      {
        error: "Generation failed",
        message: "We couldn't generate your birth chart. Please try again in a moment.",
        // In dev mode, include debug info
        ...(process.env.NODE_ENV === "development" && {
          debug: {
            error: error?.message ?? "Unknown error",
            type: error?.name ?? "Error",
            at: "birth-chart route",
          }
        })
      },
      { status: 500 }
    );
  }
}
