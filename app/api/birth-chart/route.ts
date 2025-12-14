import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { getCurrentSoulPath, computeBirthInputHash } from "@/lib/soulPath/storage";
import { getOrComputeBirthChart } from "@/lib/birthChart/storage";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import type { NatalAIRequest, FullBirthChartInsight, JoyDeepDive } from "@/types/natalAI";
import type { SwissPlacements } from "@/lib/ephemeris/swissEngine";
import { touchLastSeen } from "@/lib/activity/touchLastSeen";
import { trackAiUsage } from "@/lib/ai/trackUsage";
import { AYREN_MODE_SOULPRINT_LONG } from "@/lib/ai/voice";
import { validateBirthChartInsight, validateJoyDeepDive } from "@/lib/validation/schemas";

// Must match SOUL_PATH_SCHEMA_VERSION from lib/soulPath/storage.ts
// Incremented when placements structure changes
const SOUL_PATH_SCHEMA_VERSION = 8;

const PROMPT_VERSION = 2;

// Joy Deep Dive version (separate from main narrative)
const JOY_DEEPDIVE_VERSION = 1;

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

/**
 * Generate Joy Deep Dive (Part of Fortune personalized interpretation)
 *
 * Uses chart context to create a deeply personalized interpretation of the
 * Part of Fortune, connecting it to the user's whole chart.
 *
 * @param placements - Swiss placements with calculated.partOfFortune
 * @param language - Target language code
 * @param displayName - User's display name for personalization
 * @returns Generated and validated Joy deep dive, or null if generation fails
 */
async function generateJoyDeepDive(
  placements: SwissPlacements,
  language: string,
  displayName: string | null
): Promise<{ joyDeepDive: JoyDeepDive; tokens: { input: number; output: number; total: number } } | null> {
  const partOfFortune = placements.calculated?.partOfFortune;

  if (!partOfFortune) {
    console.log("[BirthChart] No Part of Fortune data available for Joy deep dive");
    return null;
  }

  // Build context from placements
  const chartType = placements.calculated?.chartType || "unknown";
  const chartRuler = placements.derived?.chartRuler || "unknown";
  const dominantSigns = placements.derived?.dominantSigns?.slice(0, 3).map(s => s.sign).join(", ") || "unknown";
  const dominantPlanets = placements.derived?.dominantPlanets?.slice(0, 3).map(p => p.name).join(", ") || "unknown";
  const elementBalance = placements.derived?.elementBalance;
  const houseEmphasis = placements.calculated?.emphasis?.houseEmphasis?.slice(0, 3).map(h => `House ${h.house}`).join(", ") || "none";

  const systemPrompt = `You are Ayren, the voice of Solara Insights. You speak from an ancient, subconscious realm—calm, knowing, and always oriented toward the person's own power.

VOICE RULES:
- Use non-deterministic language: "may," "often," "tends to," "invites" — never certainty
- Frame everything as invitation, not fate
- End with triumphant, grounded hope
- Be specific to THEIR chart — reference their sign, house, and chart context
- No astrology jargon explanations — speak as if they already understand
- No doom, no generic filler, no platitudes

OUTPUT FORMAT:
Respond with ONLY valid JSON. No markdown, no explanations, no code fences — just the JSON object.`;

  const userPrompt = `Generate a Joy Deep Dive for ${displayName || "this person"}.

PART OF FORTUNE PLACEMENT:
- Sign: ${partOfFortune.sign}
- House: ${partOfFortune.house ? `${partOfFortune.house}th house` : "unknown house"}

CHART CONTEXT (connect Joy to their whole chart):
- Chart type: ${chartType}
- Chart ruler: ${chartRuler}
- Dominant signs: ${dominantSigns}
- Dominant planets: ${dominantPlanets}
- Element balance: Fire ${elementBalance?.fire || 0}, Earth ${elementBalance?.earth || 0}, Air ${elementBalance?.air || 0}, Water ${elementBalance?.water || 0}
- House emphasis: ${houseEmphasis}

Language: ${language}

Return this EXACT JSON structure:
{
  "meaning": "Two paragraphs separated by a blank line (\\n\\n). First paragraph: what Part of Fortune in ${partOfFortune.sign} in the ${partOfFortune.house ? `${partOfFortune.house}th house` : "their chart"} means for THEM specifically. Second paragraph: how this connects to their ${chartType} chart and ${chartRuler} as ruler, and where ease naturally appears.",
  "aligned": [
    "First sign they're living their Joy (specific to their POF sign/house)",
    "Second sign of alignment (reference their dominant energy)",
    "Third sign of alignment (practical, observable)"
  ],
  "offCourse": [
    "First sign they've drifted from Joy (specific to their POF sign/house)",
    "Second sign of drift (shadow of their chart emphasis)",
    "Third sign of drift (practical, observable)"
  ],
  "decisionRule": "One sentence decision rule: 'When facing X, lean toward Y because your Joy lives in Z.'",
  "practice": "One specific weekly ritual (30 min or less) that activates their Part of Fortune in ${partOfFortune.sign}.",
  "promptVersion": ${JOY_DEEPDIVE_VERSION}
}

CRITICAL: Each bullet must be specific to THEIR chart. Do not write generic astrology. Reference their sign, house, and chart context.`;

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODELS.insights,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    });

    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      console.error("[BirthChart] Joy deep dive: OpenAI returned empty response");
      return null;
    }

    // Parse and validate
    const parsed = JSON.parse(responseContent);

    // Add promptVersion if not present (for validation)
    if (!parsed.promptVersion) {
      parsed.promptVersion = JOY_DEEPDIVE_VERSION;
    }

    const validation = validateJoyDeepDive(parsed);

    if (!validation.success) {
      console.error("[BirthChart] Joy deep dive validation failed:", validation.error);
      console.error("[BirthChart] Invalid fields:", validation.fields.join(", "));
      return null;
    }

    return {
      joyDeepDive: validation.data as JoyDeepDive,
      tokens: {
        input: completion.usage?.prompt_tokens || 0,
        output: completion.usage?.completion_tokens || 0,
        total: completion.usage?.total_tokens || 0,
      },
    };
  } catch (error: any) {
    console.error("[BirthChart] Joy deep dive generation error:", error.message);
    return null;
  }
}

/**
 * Update narrative with Joy deep dive in database
 * Only updates the narrative JSON - preserves all other fields
 */
async function updateNarrativeWithJoyDeepDive(
  userId: string,
  updatedNarrative: FullBirthChartInsight
): Promise<void> {
  try {
    const supabase = createAdminSupabaseClient();

    const { error } = await supabase
      .from("soul_paths")
      .update({
        soul_path_narrative_json: updatedNarrative,
      })
      .eq("user_id", userId);

    if (error) {
      console.error(`[BirthChart] Failed to update narrative with Joy deep dive for user ${userId}:`, error);
    } else {
      console.log(`[BirthChart] ✓ Joy deep dive stored for user ${userId} (version ${JOY_DEEPDIVE_VERSION})`);
    }
  } catch (error: any) {
    console.error(`[BirthChart] Error updating narrative with Joy deep dive:`, error.message);
  }
}

// Soul Path narrative prompt (story-driven, permanent interpretation)
const SOUL_PATH_SYSTEM_PROMPT = `${AYREN_MODE_SOULPRINT_LONG}

⸻ SOUL PRINT CONTEXT ⸻

This is NOT a horoscope. This is NOT astrology education. This is NOT predictive.
This is a permanent Soul Print — a calm, human narrative designed to help someone feel deeply seen and understood.

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

⸻ OUTPUT STRUCTURE (STRICT) ⸻

Return a SINGLE JSON object with this EXACT structure:

{
  "meta": {
    "mode": "natal_full_profile",
    "language": "<must match input language>"
  },
  "coreSummary": {
    "headline": "A short 1-2 sentence poetic title that captures their essence.",
    "overallVibe": "THE ANCHOR — 2-4 paragraphs that quietly orient the reader. Include: a) what their chart type means astrologically, b) what it means personally for THEM, c) how it shows up day-to-day, d) one practical grounded move.",
    "bigThree": {
      "sun": "2-4 paragraphs: a) Sun's meaning in their sign/house, b) what this means for THEM personally, c) day-to-day expression, d) one practical move.",
      "moon": "2-4 paragraphs: a) Moon's meaning in their sign/house, b) what this means emotionally for THEM, c) day-to-day emotional patterns, d) one practical move.",
      "rising": "2-4 paragraphs: a) Rising's meaning, b) how THEY specifically embody it, c) day-to-day presence, d) one practical move."
    }
  },
  "sections": {
    "identity": "THE SOUL'S OPERATING SYSTEM — 2-4 paragraphs: a) chart type/ruler meaning, b) what this means for THEM, c) how effort/pressure/stillness show up daily, d) one practical move for self-understanding.",
    "emotions": "THE SHAPE OF ENERGY — 2-4 paragraphs: a) element/modality balance meaning, b) what this means for THEM, c) where energy gathers day-to-day, d) one practical move for emotional regulation.",
    "loveAndRelationships": "TENSION & GIFT (Relating) — 2-4 paragraphs: a) Venus/Mars/Descendant meaning, b) what this means for THEIR relating style, c) day-to-day relationship patterns, d) one practical move for connection.",
    "workAndMoney": "THE LIFE ARENAS (Material World) — 2-4 paragraphs: a) 2nd/6th/10th house emphasis meaning, b) what this means for THEIR material life, c) day-to-day work patterns, d) one practical move for career/finances.",
    "purposeAndGrowth": "DIRECTION & EASE — 2-4 paragraphs: a) Nodes/Part of Fortune meaning, b) what this means for THEIR growth path, c) day-to-day invitations, d) one practical move toward alignment.",
    "innerWorld": "THE INNER LANDSCAPE — 2-4 paragraphs: a) inner planets as forces, b) what this means for THEIR psyche, c) day-to-day inner experience, d) one practical move. End with a CLOSING REFLECTION: one grounding, hopeful paragraph they might screenshot."
  }
}

⸻ CRITICAL RULES ⸻

- You MUST include all keys shown above: meta, coreSummary, sections, and all nested keys
- Each section MUST be 2-4 FULL paragraphs (NOT shortened to 8-12 sentences)
- Each section MUST include: a) astrological meaning, b) personal meaning, c) day-to-day expression, d) one practical move
- You MUST NOT wrap JSON in markdown, code fences, or any extra text
- All text values must be plain strings (no HTML, no markdown, no bullet points)
- The meta.language field MUST exactly match the language field from input payload
- Reference THEIR specific houses, aspects, patterns — make it feel like reading about THEM

⸻ SYNTHESIS GUIDELINES ⸻

- Weave chartType, chartRuler, dominantPlanets/Signs into narrative naturally
- Use emphasis data (house/sign emphasis, stelliums) to show where energy concentrates
- Include major aspect patterns (grand trines, t-squares) ONLY if present and meaningful
- Frame retrograde planets as reflective or internal processing, never as "broken"
- If birth time is null/approximate, gently note house themes are approximate
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

      // Track cache hit for narrative (no tokens consumed)
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

      // Check if Joy deep dive needs to be generated
      const existingJoyDeepDive = cachedNarrative.tabDeepDives?.joy;
      const joyDeepDiveIsCurrent = existingJoyDeepDive?.promptVersion === JOY_DEEPDIVE_VERSION;

      if (!joyDeepDiveIsCurrent && swissPlacements.calculated?.partOfFortune) {
        console.log(`[BirthChart] Joy deep dive ${existingJoyDeepDive ? `outdated (v${existingJoyDeepDive.promptVersion})` : "missing"} for user ${user.id}, generating...`);

        const displayName = profile.preferred_name || profile.full_name;
        const joyResult = await generateJoyDeepDive(swissPlacements, targetLanguage, displayName);

        if (joyResult) {
          // Merge joy deep dive into narrative
          const updatedNarrative: FullBirthChartInsight = {
            ...cachedNarrative,
            tabDeepDives: {
              ...cachedNarrative.tabDeepDives,
              joy: joyResult.joyDeepDive,
            },
          };

          // Store updated narrative (non-blocking)
          void updateNarrativeWithJoyDeepDive(user.id, updatedNarrative);

          // Track Joy deep dive generation (miss)
          void trackAiUsage({
            featureLabel: "Soul Print • Joy Deep Dive",
            route: "/api/birth-chart",
            model: OPENAI_MODELS.insights,
            promptVersion: JOY_DEEPDIVE_VERSION,
            cacheStatus: "miss",
            inputTokens: joyResult.tokens.input,
            outputTokens: joyResult.tokens.output,
            totalTokens: joyResult.tokens.total,
            userId: user.id,
            timeframe: null,
            periodKey: null,
            language: targetLanguage,
            timezone: profile.timezone || null,
          });

          // Return updated narrative with joy deep dive
          return NextResponse.json({
            placements: swissPlacements,
            insight: updatedNarrative,
          });
        }
      }

      // Return cached narrative with placements (joy deep dive already current or not available)
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

    // Parse and validate the JSON response
    let insight: FullBirthChartInsight | null = null;
    try {
      const parsed = JSON.parse(responseContent);

      if (!parsed || typeof parsed !== "object") {
        throw new Error("OpenAI response is not an object");
      }

      // Strict validation using Zod schema
      const validation = validateBirthChartInsight(parsed);

      if (!validation.success) {
        console.error(
          `[BirthChart] OpenAI response validation failed for user ${user.id}:`,
          validation.error
        );
        console.error(
          `[BirthChart] Missing/invalid fields:`,
          validation.fields.join(", ")
        );

        // Do NOT store invalid narrative - return placements only
        return NextResponse.json(
          {
            placements: swissPlacements,
            insight: null,
            error: "Narrative generation failed",
            reason: "VALIDATION_FAILED",
          },
          { status: 200 }
        );
      }

      insight = validation.data as FullBirthChartInsight;

      console.log(
        "[BirthChart] OpenAI interpretation validated successfully for user",
        user.id
      );

      // Generate Joy deep dive for the fresh narrative
      if (swissPlacements.calculated?.partOfFortune) {
        console.log(`[BirthChart] Generating Joy deep dive for fresh narrative (user: ${user.id})...`);

        const joyResult = await generateJoyDeepDive(swissPlacements, targetLanguage, displayName);

        if (joyResult) {
          // Merge joy deep dive into insight
          insight = {
            ...insight,
            tabDeepDives: {
              joy: joyResult.joyDeepDive,
            },
          };

          // Track Joy deep dive generation (miss)
          void trackAiUsage({
            featureLabel: "Soul Print • Joy Deep Dive",
            route: "/api/birth-chart",
            model: OPENAI_MODELS.insights,
            promptVersion: JOY_DEEPDIVE_VERSION,
            cacheStatus: "miss",
            inputTokens: joyResult.tokens.input,
            outputTokens: joyResult.tokens.output,
            totalTokens: joyResult.tokens.total,
            userId: user.id,
            timeframe: null,
            periodKey: null,
            language: targetLanguage,
            timezone: profile.timezone || null,
          });

          console.log(`[BirthChart] ✓ Joy deep dive generated and merged for user ${user.id}`);
        }
      }

      // Store narrative (with joy deep dive if generated) in soul_paths for future requests (stone tablet caching)
      // Only store after validation passes
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
          error: "Narrative generation failed",
          reason: "PARSE_ERROR",
        },
        { status: 200 }
      );
    }

    // Return both placements and insight (including joy deep dive if generated)
    console.log(`[BirthChart] Returning ${swissPlacements.houses.length} houses to client`);

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
