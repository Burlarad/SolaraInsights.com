import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { getCurrentSoulPath, computeBirthInputHash } from "@/lib/soulPath/storage";
import { getOrComputeBirthChart } from "@/lib/birthChart/storage";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import type { NatalAIRequest, FullBirthChartInsight } from "@/types/natalAI";
import { touchLastSeen } from "@/lib/activity/touchLastSeen";
import { trackAiUsage } from "@/lib/ai/trackUsage";

// Must match SOUL_PATH_SCHEMA_VERSION from lib/soulPath/storage.ts
// Incremented when placements structure changes
const SOUL_PATH_SCHEMA_VERSION = 8;

const PROMPT_VERSION = 1;

/**
 * Load cached Soul Print narrative from soul_paths table
 *
 * Stone tablet contract: narrative is valid ONLY if ALL conditions match:
 * - birth_input_hash (birth data unchanged)
 * - schema_version (placements structure unchanged)
 * - narrative_prompt_version (prompt unchanged)
 * - narrative_language (language unchanged)
 * - soul_path_narrative_json is not null
 *
 * @param userId - User's UUID
 * @param birthInputHash - Current birth input hash to validate against
 * @param schemaVersion - Current schema version to validate against
 * @param promptVersion - Prompt version to match
 * @param language - Language code to match
 * @returns Cached narrative or null if not found/invalid
 */
async function loadCachedNarrative(
  userId: string,
  birthInputHash: string,
  schemaVersion: number,
  promptVersion: number,
  language: string
): Promise<FullBirthChartInsight | null> {
  try {
    const supabase = createAdminSupabaseClient();

    const { data, error } = await supabase
      .from("soul_paths")
      .select("soul_path_narrative_json, narrative_prompt_version, narrative_language, birth_input_hash, schema_version")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    // Validate ALL cache conditions (stone tablet contract)
    if (
      !data.soul_path_narrative_json ||
      data.birth_input_hash !== birthInputHash ||
      data.schema_version !== schemaVersion ||
      data.narrative_prompt_version !== promptVersion ||
      data.narrative_language !== language
    ) {
      if (data.soul_path_narrative_json) {
        // Narrative exists but is stale - log reason
        const reasons = [];
        if (data.birth_input_hash !== birthInputHash) reasons.push("birth data changed");
        if (data.schema_version !== schemaVersion) reasons.push(`schema mismatch (stored: ${data.schema_version}, current: ${schemaVersion})`);
        if (data.narrative_prompt_version !== promptVersion) reasons.push(`prompt version mismatch (stored: ${data.narrative_prompt_version}, current: ${promptVersion})`);
        if (data.narrative_language !== language) reasons.push(`language mismatch (stored: ${data.narrative_language}, current: ${language})`);
        console.log(`[BirthChart] Narrative cache invalid for user ${userId}: ${reasons.join(", ")}`);
      }
      return null;
    }

    return data.soul_path_narrative_json as FullBirthChartInsight;
  } catch (error: any) {
    console.warn(`[BirthChart] Error loading cached narrative:`, error.message);
    return null;
  }
}

/**
 * Store Soul Print narrative in soul_paths table
 *
 * IMPORTANT: This function only updates narrative-specific columns.
 * It preserves birth_input_hash and schema_version (set by getCurrentSoulPath).
 *
 * @param userId - User's UUID
 * @param narrative - The generated narrative to store
 * @param promptVersion - Prompt version used
 * @param language - Language code used
 * @param model - Model used for generation
 */
async function storeCachedNarrative(
  userId: string,
  narrative: FullBirthChartInsight,
  promptVersion: number,
  language: string,
  model: string
): Promise<void> {
  try {
    const supabase = createAdminSupabaseClient();

    // Update only narrative columns - preserves birth_input_hash and schema_version
    const { error } = await supabase
      .from("soul_paths")
      .update({
        soul_path_narrative_json: narrative,
        narrative_prompt_version: promptVersion,
        narrative_language: language,
        narrative_model: model,
        narrative_generated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      console.error(`[BirthChart] Failed to store narrative for user ${userId}:`, error);
    } else {
      console.log(`[BirthChart] ✓ Narrative cached for user ${userId} (prompt v${promptVersion}, lang: ${language})`);
    }
  } catch (error: any) {
    console.error(`[BirthChart] Error storing narrative:`, error.message);
  }
}

// Soul Path narrative prompt (story-driven, permanent interpretation)
const SOUL_PATH_SYSTEM_PROMPT = `
You are writing a Soul Path — a permanent, story-driven interpretation of someone's birth chart.

This is NOT a horoscope. This is NOT astrology education. This is NOT predictive.
This is a calm, human narrative designed to help someone feel deeply seen and understood.

⸻ CORE PRINCIPLES (DO NOT VIOLATE) ⸻

TONE:
- Warm, grounded, compassionate, quietly profound
- Think: a wise friend who understands them deeply
- Short, dyslexia-friendly paragraphs (2–4 sentences)
- No fear-based or deterministic language
- Emphasize free will, growth, and agency

EXPLICITLY FORBIDDEN:
- Astrology teaching or explanations of what signs/houses/planets mean
- Bullet lists or itemized formats in narrative text
- Jargon explanations
- Predictions or fortune-telling
- Instructions or "you should" language
- Medical, legal, or financial advice

⸻ INPUT DATA ⸻

You receive a NatalAIRequest object containing:
- placements.planets (name, sign, house, longitude, retrograde)
- placements.houses (house number, signOnCusp, cuspLongitude)
- placements.angles (Ascendant, Midheaven, Descendant, IC with sign + longitude)
- placements.aspects (planetary aspects with type and orb)
- placements.derived (chartRuler, dominantSigns, dominantPlanets, elementBalance, modalityBalance, topAspects)
- placements.calculated (chartType, partOfFortune, southNode, emphasis, patterns)

You MUST treat all placements as authoritative. Do NOT change signs, houses, or angles.
You MUST synthesize meaning from this data — never restate raw data.

LANGUAGE:
- Write ALL narrative text in the user's selected language (from input payload's "language" field)
- Set meta.language to match input language exactly
- Field names in JSON stay English; content values must be in user's language

⸻ OUTPUT STRUCTURE (STRICT) ⸻

Return a SINGLE JSON object with this EXACT structure:

{
  "meta": {
    "mode": "natal_full_profile",
    "language": "<must match input language>"
  },
  "coreSummary": {
    "headline": "A short 1-2 sentence poetic title that captures their essence.",
    "overallVibe": "THE ANCHOR — 1-2 short paragraphs that quietly orient the reader. Weave together: chart type (day/night), Rising sign, chart ruler, dominant planets/signs, and major patterns (if present). This is a feeling of recognition, not analysis. No interpretation yet.",
    "bigThree": {
      "sun": "1-2 sentences describing Sun as an inner force (identity, vitality) — weave in house as life arena naturally, never as a label.",
      "moon": "1-2 sentences describing Moon as emotional center — weave in house as emotional territory, never as a label.",
      "rising": "1-2 sentences describing Rising as presence and approach to life — never explain what Rising 'means'."
    }
  },
  "sections": {
    "identity": "THE SOUL'S OPERATING SYSTEM — 2-4 short paragraphs on how they move through life. Weave: chart type, chart ruler, dominant planets. Focus on rhythm, emotional processing, how effort/pressure/stillness are experienced. Should feel like: 'Yes, this is how I've always moved.'",
    "emotions": "THE SHAPE OF ENERGY — 2-4 short paragraphs on what repeats and concentrates. Weave: dominant signs, element balance, modality balance, stelliums (if present). Describe where energy gathers, where life feels intense. Never frame imbalance as 'missing' or 'lacking'.",
    "loveAndRelationships": "TENSION & GIFT (Relating) — 2-4 short paragraphs on how tension shapes relating. Weave: Venus, Mars, meaningful aspects (especially to/from these planets), Descendant. Frame tension as pressure that produces depth, friction that refines. Never frame as flaw. Only include major patterns if relevant.",
    "workAndMoney": "THE LIFE ARENAS (Material World) — 2-4 short paragraphs on where life speaks loudest in work/resources. Weave: house emphasis (2nd, 6th, 10th houses), stelliums by house, planets ruling these houses. Houses appear as life arenas, never labels.",
    "purposeAndGrowth": "DIRECTION & EASE — 2-4 short paragraphs on growth and natural joy. Weave: North Node (invitation), South Node (familiar terrain), Part of Fortune (ease and natural joy). No destiny language. Frame as gentle direction, not command.",
    "innerWorld": "THE INNER LANDSCAPE — 2-4 short paragraphs on inner characters and psyche. Introduce planets as inner forces (Mercury = expression, Venus = relating, Mars = drive). End with a CLOSING REFLECTION: one short paragraph that feels grounding, hopeful, personal (not instructional). Something they might screenshot."
  }
}

⸻ CRITICAL RULES ⸻

- You MUST include all keys shown above: meta, coreSummary, sections, and all nested keys
- You MUST NOT add any extra top-level keys
- You MUST NOT wrap JSON in markdown, code fences, or any extra text
- You MUST NOT output any explanation outside of the JSON
- All text values must be plain strings (no HTML, no markdown, no bullet points)
- The meta.language field MUST exactly match the language field from input payload

⸻ SYNTHESIS GUIDELINES ⸻

- Weave chartType, chartRuler, dominantPlanets/Signs into narrative naturally
- Use emphasis data (house/sign emphasis, stelliums) to show where energy concentrates
- Include major aspect patterns (grand trines, t-squares) ONLY if present and meaningful
- Integrate Chiron ONLY if relevant to the narrative
- Frame retrograde planets as reflective or internal processing, never as "broken"
- If birth time is null/approximate, gently note house themes are approximate

⸻ FINAL CHECK ⸻

Before responding, ask yourself:
- Does this feel like a story?
- Would this help someone feel calmer and more understood?
- Does it honor complexity without overwhelming?
- Does it sound human, not like astrology education?

If yes — respond. If not — rewrite.
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
          message: "Please sign in to view your Soul Path.",
        },
        { status: 401 }
      );
    }

    // Track user activity (non-blocking)
    const admin = createAdminSupabaseClient();
    void touchLastSeen(admin, user.id, 30);

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
            "We need your birth date and full birthplace in Settings so Solara can generate your Soul Path.",
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
    // Primary: Use new Soul Path storage (soul_paths table)
    // Fallback: If soul_paths fails, use legacy Birth Chart storage (profiles table)
    let swissPlacements;
    try {
      swissPlacements = await getCurrentSoulPath(user.id, profile);
      console.log(`[BirthChart] Soul Path loaded via getCurrentSoulPath for user ${user.id}`);
    } catch (soulPathError: any) {
      console.warn(
        `[BirthChart] getCurrentSoulPath failed for user ${user.id}, falling back to legacy storage:`,
        soulPathError.message
      );
      swissPlacements = await getOrComputeBirthChart(user.id, profile);
      console.log(`[BirthChart] Soul Path loaded via legacy getOrComputeBirthChart for user ${user.id}`);
    }

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

    // ========================================
    // STEP B: Check for cached AI narrative
    // ========================================

    const targetLanguage = profile.language || "en";

    // Compute birth input hash for cache validation
    const currentBirthInputHash = computeBirthInputHash(profile);

    // Try to load cached narrative (stone tablet - validates ALL conditions)
    const cachedNarrative = await loadCachedNarrative(
      user.id,
      currentBirthInputHash,
      SOUL_PATH_SCHEMA_VERSION,
      PROMPT_VERSION,
      targetLanguage
    );

    if (cachedNarrative) {
      console.log(`[BirthChart] ✓ Cache hit for Soul Print narrative (user: ${user.id}, prompt v${PROMPT_VERSION}, lang: ${targetLanguage})`);

      // Track cache hit (no tokens consumed)
      void trackAiUsage({
        featureLabel: "Soul Print • Narrative",
        route: "/api/birth-chart",
        model: OPENAI_MODELS.insights,
        promptVersion: PROMPT_VERSION,
        cacheStatus: "hit",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        userId: user.id,
        timeframe: null,
        periodKey: null,
        language: targetLanguage,
        timezone: profile.timezone || null,
      });

      // Return cached narrative with placements
      return NextResponse.json({
        placements: swissPlacements,
        insight: cachedNarrative,
      });
    }

    console.log(`[BirthChart] ✗ Cache miss for Soul Print narrative - generating fresh (user: ${user.id}, prompt v${PROMPT_VERSION}, lang: ${targetLanguage})`);

    // ========================================
    // STEP C: Generate fresh AI narrative
    // ========================================

    // Build NatalAIRequest for OpenAI
    const displayName = profile.preferred_name || profile.full_name;

    const aiPayload: NatalAIRequest = {
      mode: "natal_full_profile",
      language: targetLanguage,
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
          longitude: p.longitude ?? null,
          retrograde: p.retrograde ?? false,
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
        aspects: (swissPlacements.aspects ?? []).map((a) => ({
          between: `${a.between[0]}-${a.between[1]}`,
          type: a.type,
          orb: a.orb,
        })),
      },
    };

    // STEP B: Call OpenAI for Soul Path interpretation
    console.log("[BirthChart] Calling OpenAI for Soul Path interpretation...");

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODELS.insights,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SOUL_PATH_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(aiPayload) },
      ],
      temperature: 0.7,
    });

    const responseContent = completion.choices[0]?.message?.content;

    // Track AI usage (cache miss - fresh generation)
    void trackAiUsage({
      featureLabel: "Soul Print • Narrative",
      route: "/api/birth-chart",
      model: OPENAI_MODELS.insights,
      promptVersion: PROMPT_VERSION,
      cacheStatus: "miss",
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      totalTokens: completion.usage?.total_tokens || 0,
      userId: user.id,
      timeframe: null,
      periodKey: null,
      language: targetLanguage,
      timezone: profile.timezone || null,
    });

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

      // Store narrative in soul_paths for future requests (stone tablet caching)
      void storeCachedNarrative(
        user.id,
        insight,
        PROMPT_VERSION,
        targetLanguage,
        OPENAI_MODELS.insights
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
        message: "We couldn't generate your Soul Path. Please try again in a moment.",
      },
      { status: 500 }
    );
  }
}
