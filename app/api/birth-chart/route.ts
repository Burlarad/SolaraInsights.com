import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOrComputeBirthChart } from "@/lib/birthChart/storage";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import type { NatalAIRequest, FullBirthChartInsight } from "@/types/natalAI";

// System prompt for OpenAI birth chart interpretation
const NATAL_SYSTEM_PROMPT = `
You are the Solara Insights birth chart interpreter, speaking in the "Ayren" voice.

ROLE & TONE
- You are a compassionate, emotionally intelligent astrologer.
- Your tone is warm, poetic, and honest, but always practical and grounded.
- Use short, dyslexia-friendly paragraphs (2–4 sentences each).
- Never use fear-based or deterministic language.
- Emphasize free will, growth, and agency, not fixed fate.
- Never give medical, legal, or financial advice.

INPUT
- You receive a single JSON object describing the person's chart and context (NatalAIRequest).
- It includes:
  - mode: "natal_full_profile"
  - language: the user's selected language code (e.g., "en", "es", "fr", "de", "pt")
  - profile.name and profile.zodiacSign
  - birth.date, birth.time (or null), birth.timezone, birth.city/region/country, birth.lat/lon
  - placements.system ("western_tropical_placidus")
  - placements.planets: each planet name, sign, and house
  - placements.houses: house number and signOnCusp
  - placements.angles: Ascendant, Midheaven, Descendant, IC

You MUST treat all placements you are given as authoritative.
You MUST NOT change any signs, houses, or angles.

LANGUAGE:
- The input payload contains a "language" field with the user's selected language code
- You MUST write ALL narrative text (headline, overallVibe, bigThree, sections) in the user's selected language
- You MUST set meta.language to match the input payload's language field
- Field names in the JSON remain in English, but all content values must be in the user's language

OUTPUT
- You MUST return a SINGLE JSON object with this exact structure:

{
  "meta": {
    "mode": "natal_full_profile",
    "language": "<must match input payload's language field>"
  },
  "coreSummary": {
    "headline": "Short 1–2 sentence title for this chart (in user's language).",
    "overallVibe": "1–2 short paragraphs summarizing the overall chart tone in Ayren's voice (in user's language).",
    "bigThree": {
      "sun": "Short 1–2 sentence summary of Sun sign + house (in user's language).",
      "moon": "Short 1–2 sentence summary of Moon sign + house (in user's language).",
      "rising": "Short 1–2 sentence summary of Rising sign (in user's language)."
    }
  },
  "sections": {
    "identity": "2–4 short paragraphs about self-image, ego, and presence (in user's language).",
    "emotions": "2–4 short paragraphs about emotional life, Moon themes, and how feelings move (in user's language).",
    "loveAndRelationships": "2–4 short paragraphs about love, attachment, and relationship patterns (in user's language).",
    "workAndMoney": "2–4 short paragraphs about work style, resources, and money patterns (in user's language).",
    "purposeAndGrowth": "2–4 short paragraphs about long-term growth, life lessons, and purpose (in user's language).",
    "innerWorld": "2–4 short paragraphs about inner landscape, psyche, and spiritual/psychological themes (in user's language)."
  }
}

CRITICAL RULES
- You MUST include all of the keys shown above: meta, coreSummary, sections, and all nested keys.
- You MUST NOT add any extra top-level keys.
- You MUST NOT wrap the JSON in markdown, code fences, or any extra text.
- You MUST NOT output any explanation outside of the JSON.
- All text values must be plain strings (no HTML, no markdown).
- The meta.language field MUST exactly match the language field from the input payload.

If the input birth time is null or approximate, you may mention that house-based themes are approximate, but you must still provide a full and gentle interpretation.
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

    // Validate required birth data fields (full chart requires derived location)
    const requiredFields = [
      "birth_date",
      "birth_lat",
      "birth_lon",
      "timezone",
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
            "We need your birth date and full birthplace in Settings so Solara can generate your birth chart.",
        },
        { status: 400 }
      );
    }

    console.log("[BirthChart] Using birth data for computation", {
      userId: user.id,
      birth_date: profile.birth_date,
      birth_time: profile.birth_time,
      timezone: profile.timezone,
      birth_city: profile.birth_city,
      birth_region: profile.birth_region,
      birth_country: profile.birth_country,
      birth_lat: profile.birth_lat,
      birth_lon: profile.birth_lon,
    });

    // STEP A: Load or compute Swiss Ephemeris placements
    // This uses stored placements from database if available,
    // or computes fresh if not found/invalid
    const swissPlacements = await getOrComputeBirthChart(user.id, profile);

    console.log("[BirthChart] Placements loaded for user", user.id);
    console.log(
      "[BirthChart] Placements snapshot",
      JSON.stringify(
        {
          houses: swissPlacements.houses.map((h) => ({
            house: h.house,
            signOnCusp: h.signOnCusp,
          })),
          planets: swissPlacements.planets.map((p) => ({
            name: p.name,
            sign: p.sign,
            house: p.house,
          })),
          angles: {
            ascendant: swissPlacements.angles.ascendant,
            midheaven: swissPlacements.angles.midheaven,
            descendant: swissPlacements.angles.descendant,
            ic: swissPlacements.angles.ic,
          },
        },
        null,
        2
      )
    );

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
      const parsed = JSON.parse(responseContent);

      if (!parsed || typeof parsed !== "object") {
        throw new Error("OpenAI response is not an object");
      }

      if (!parsed.coreSummary || !parsed.sections) {
        console.error(
          "[BirthChart] OpenAI response missing required coreSummary/sections fields"
        );
        return NextResponse.json(
          {
            placements: swissPlacements,
            insight: null,
          },
          { status: 200 }
        );
      }

      insight = parsed as FullBirthChartInsight;

      console.log(
        "[BirthChart] OpenAI interpretation parsed successfully for user",
        user.id
      );
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
    console.log(`[BirthChart] Returning ${swissPlacements.houses.length} houses to client`);
    console.log(`[BirthChart] Houses:`, JSON.stringify(swissPlacements.houses, null, 2));

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
