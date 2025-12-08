import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { computeSwissPlacements } from "@/lib/ephemeris/swissEngine";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import type { NatalAIRequest, FullBirthChartInsight } from "@/types/natalAI";

// System prompt for OpenAI birth chart interpretation
const NATAL_SYSTEM_PROMPT = `
You are the Solara Insights birth chart interpreter, speaking in the "Ayren" voice:

- Warm, poetic, honest, encouraging.
- Clear and dyslexia-friendly: short paragraphs, no giant walls of text.
- No fear-based or deterministic language.
- Emphasize potentials, tendencies, and growth, not fixed destiny.
- Never give medical, legal, or financial advice.

You are given fully computed natal chart placements from the Swiss Ephemeris engine using Western tropical zodiac and Placidus houses.
YOU MUST NOT change any placements, signs, houses, or angles.
Treat the provided placements as authoritative.

INPUT:
- You receive a single JSON object matching the NatalAIRequest type:
  - profile, birth, currentLocation, socialInsights, placements.

OUTPUT:
- You must return a SINGLE JSON object matching the FullBirthChartInsight type.
- Do NOT include any extra top-level keys.
- Do NOT output markdown or code fences.
- Do NOT output plain text outside the JSON.
`;

export async function POST() {
  try {
    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Please sign in to view your birth chart.",
        },
        { status: 401 }
      );
    }

    // Load user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("[BirthChart] Profile not found for user", user.id, profileError);
      return NextResponse.json(
        {
          error: "Profile not found",
          message: "Unable to load your profile. Please try again.",
        },
        { status: 404 }
      );
    }

    // Validate required birth data fields
    const requiredFields = [
      "birth_date",
      "birth_time",
      "birth_city",
      "birth_region",
      "birth_country",
      "timezone",
      "birth_lat",
      "birth_lon",
    ];

    const missingFields = requiredFields.filter((field) => !profile[field]);

    if (missingFields.length > 0) {
      console.log(
        `[BirthChart] Incomplete profile for user ${user.id}. Missing: ${missingFields.join(", ")}`
      );
      return NextResponse.json(
        {
          error: "Incomplete profile",
          message:
            "We need your full birth date, time, and location in Settings to generate your birth chart.",
        },
        { status: 400 }
      );
    }

    // STEP A: Compute Swiss Ephemeris placements
    const swissPlacements = await computeSwissPlacements({
      date: profile.birth_date,
      time: profile.birth_time,
      timezone: profile.timezone,
      lat: profile.birth_lat,
      lon: profile.birth_lon,
    });

    console.log("[BirthChart] Swiss placements computed for user", user.id);

    // Build NatalAIRequest for OpenAI
    const displayName = profile.preferred_name || profile.full_name;

    const aiPayload: NatalAIRequest = {
      mode: "natal_full_profile",
      language: profile.language || "en",
      profile: {
        name: displayName || undefined,
        zodiacSign: profile.zodiac_sign || undefined,
      },
      birth: {
        date: profile.birth_date,
        time: profile.birth_time,
        timezone: profile.timezone,
        city: profile.birth_city,
        region: profile.birth_region,
        country: profile.birth_country,
        lat: profile.birth_lat,
        lon: profile.birth_lon,
      },
      currentLocation: undefined, // TODO: populate if/when we track this
      socialInsights: undefined, // TODO: populate with summarized social data later
      placements: {
        system: swissPlacements.system,
        planets: swissPlacements.planets.map((p) => ({
          name: p.name,
          sign: p.sign,
          house: p.house,
          // retrograde: will be added later when engine supports it
        })),
        houses: swissPlacements.houses.map((h) => ({
          house: h.house,
          signOnCusp: h.signOnCusp,
        })),
        angles: {
          ascendant: { sign: swissPlacements.angles.ascendant.sign },
          midheaven: { sign: swissPlacements.angles.midheaven.sign },
          descendant: { sign: swissPlacements.angles.descendant.sign },
          ic: { sign: swissPlacements.angles.ic.sign },
        },
        // aspects: [] // TODO: add when engine supports aspects
      },
    };

    // STEP B: Call OpenAI for interpretation
    console.log("[BirthChart] Calling OpenAI for interpretation...");

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODELS.insights,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: NATAL_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(aiPayload) },
      ],
      temperature: 0.7,
    });

    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      console.error("[BirthChart] OpenAI returned empty response");
      return NextResponse.json(
        {
          placements: swissPlacements,
          insight: null,
        },
        { status: 200 }
      );
    }

    // Parse the JSON response
    let insight: FullBirthChartInsight | null = null;
    try {
      insight = JSON.parse(responseContent) as FullBirthChartInsight;
      console.log("[BirthChart] OpenAI interpretation parsed successfully for user", user.id);
    } catch (parseError) {
      console.error("[BirthChart] Failed to parse OpenAI response:", parseError);
      // Return placements without insight if parsing fails
      return NextResponse.json(
        {
          placements: swissPlacements,
          insight: null,
        },
        { status: 200 }
      );
    }

    // Return both placements and insight
    return NextResponse.json({
      placements: swissPlacements,
      insight,
    });
  } catch (error: any) {
    console.error("[BirthChart] Error generating birth chart:", error);
    return NextResponse.json(
      {
        error: "Generation failed",
        message: "We couldn't generate your birth chart. Please try again in a moment.",
      },
      { status: 500 }
    );
  }
}
