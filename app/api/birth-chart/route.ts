import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { getCurrentSoulPath, computeBirthInputHash } from "@/lib/soulPath/storage";
import { getOrComputeBirthChart } from "@/lib/birthChart/storage";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import type { NatalAIRequest, FullBirthChartInsight, TabDeepDive, TabDeepDives, TabDeepDiveKey } from "@/types/natalAI";
import type { SwissPlacements } from "@/lib/ephemeris/swissEngine";
import { touchLastSeen } from "@/lib/activity/touchLastSeen";
import { trackAiUsage } from "@/lib/ai/trackUsage";
import { checkBudget, incrementBudget, BUDGET_EXCEEDED_RESPONSE } from "@/lib/ai/costControl";
import { isRedisAvailable, REDIS_UNAVAILABLE_RESPONSE, getCache, setCache } from "@/lib/cache/redis";
import { checkRateLimit, checkBurstLimit, createRateLimitResponse } from "@/lib/cache/rateLimit";
import { AYREN_MODE_SOULPRINT_LONG } from "@/lib/ai/voice";
import { validateBirthChartInsight, validateBatchedTabDeepDives, TAB_DEEP_DIVE_KEYS } from "@/lib/validation/schemas";
import { isValidBirthTimezone } from "@/lib/location/detection";
import { logTokenAudit } from "@/lib/ai/tokenAudit";
import { resolveLocaleAuth, getCriticalLanguageBlock } from "@/lib/i18n/resolveLocale";
import { localeNames } from "@/i18n";

// Must match SOUL_PATH_SCHEMA_VERSION from lib/soulPath/storage.ts
// Incremented when placements structure changes
const SOUL_PATH_SCHEMA_VERSION = 8;

// Human-friendly rate limits for birth chart (only on cache miss)
// Birth charts are generated once and cached forever, so limits are generous
const USER_RATE_LIMIT = 20; // 20 generations per hour (rarely hit)
const USER_RATE_WINDOW = 3600; // 1 hour
const COOLDOWN_SECONDS = 10; // 10 second cooldown (human-friendly)
const BURST_LIMIT = 10; // Max 10 requests in 10 seconds (bot defense)
const BURST_WINDOW = 10; // 10 second burst window

const PROMPT_VERSION = 2;

// Tab Deep Dive version (separate from main narrative)
// Increment this to regenerate all tab deep dives
const TAB_DEEPDIVE_VERSION = 1;

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
 * Build chart context string for deep dive prompts
 */
function buildChartContext(placements: SwissPlacements): string {
  const chartType = placements.calculated?.chartType || "unknown";
  const chartRuler = placements.derived?.chartRuler || "unknown";
  const dominantSigns = placements.derived?.dominantSigns?.slice(0, 3).map(s => s.sign).join(", ") || "unknown";
  const dominantPlanets = placements.derived?.dominantPlanets?.slice(0, 3).map(p => p.name).join(", ") || "unknown";
  const elementBalance = placements.derived?.elementBalance;
  const houseEmphasis = placements.calculated?.emphasis?.houseEmphasis?.slice(0, 3).map(h => `House ${h.house}`).join(", ") || "none";
  const patterns = placements.calculated?.patterns || [];
  const topAspects = placements.derived?.topAspects?.slice(0, 5).map(a => `${a.between[0]} ${a.type} ${a.between[1]}`).join(", ") || "none";

  return `- Chart type: ${chartType}
- Chart ruler: ${chartRuler}
- Dominant signs: ${dominantSigns}
- Dominant planets: ${dominantPlanets}
- Element balance: Fire ${elementBalance?.fire || 0}, Earth ${elementBalance?.earth || 0}, Air ${elementBalance?.air || 0}, Water ${elementBalance?.water || 0}
- House emphasis: ${houseEmphasis}
- Key patterns: ${patterns.length > 0 ? patterns.map(p => p.type === "grand_trine" ? "Grand Trine" : "T-Square").join(", ") : "none"}
- Top aspects: ${topAspects}`;
}

/**
 * Build planets summary for prompts
 */
function buildPlanetsSummary(placements: SwissPlacements): string {
  return placements.planets.map(p => {
    const retro = p.retrograde ? " (R)" : "";
    return `${p.name}: ${p.sign} in House ${p.house || "?"}${retro}`;
  }).join("\n");
}

/**
 * Build houses summary for prompts
 */
function buildHousesSummary(placements: SwissPlacements): string {
  return placements.houses.map(h => `House ${h.house}: ${h.signOnCusp}`).join("\n");
}

/**
 * Build aspects summary for prompts
 */
function buildAspectsSummary(placements: SwissPlacements): string {
  const aspects = placements.aspects || [];
  if (aspects.length === 0) return "No major aspects calculated";
  return aspects.slice(0, 10).map(a => `${a.between[0]} ${a.type} ${a.between[1]} (orb: ${a.orb.toFixed(1)}°)`).join("\n");
}

/**
 * Generate ALL Tab Deep Dives in a single batched OpenAI call
 *
 * Uses chart context to create deeply personalized interpretations for each tab.
 * Validates each tab individually and returns only valid tabs.
 *
 * @param placements - Swiss placements with all calculated data
 * @param language - Target language code
 * @param displayName - User's display name for personalization
 * @param tabsToGenerate - Specific tabs to generate (defaults to all)
 * @returns Object with valid tab deep dives and token usage
 */
async function generateAllTabDeepDives(
  placements: SwissPlacements,
  language: string,
  displayName: string | null,
  tabsToGenerate?: TabDeepDiveKey[]
): Promise<{ tabDeepDives: Partial<TabDeepDives>; tokens: { input: number; output: number; total: number } } | null> {
  const tabs = tabsToGenerate || [...TAB_DEEP_DIVE_KEYS];
  const chartContext = buildChartContext(placements);
  const planetsSummary = buildPlanetsSummary(placements);
  const housesSummary = buildHousesSummary(placements);
  const aspectsSummary = buildAspectsSummary(placements);
  const partOfFortune = placements.calculated?.partOfFortune;
  const northNode = placements.planets.find(p => p.name === "North Node");
  const southNode = placements.calculated?.southNode;
  const patterns = placements.calculated?.patterns || [];

  const systemPrompt = `You are Ayren, the voice of Solara Insights. You speak from an ancient, subconscious realm—calm, knowing, and always oriented toward the person's own power.

VOICE RULES:
- Use non-deterministic language: "may," "often," "tends to," "invites" — never certainty
- Frame everything as invitation, not fate
- End with triumphant, grounded hope
- Be specific to THEIR chart — reference their signs, houses, and chart context
- No astrology jargon explanations — speak as if they already understand
- No doom, no generic filler, no platitudes

OUTPUT FORMAT:
Respond with ONLY valid JSON. No markdown, no explanations, no code fences — just the JSON object.`;

  const tabDescriptions: Record<TabDeepDiveKey, string> = {
    planetaryPlacements: `PLANETARY PLACEMENTS: Their planets in signs and houses.
Focus on: How their unique planetary arrangement creates their personality signature.
Key data:
${planetsSummary}`,

    houses: `HOUSES: The 12 life areas and where their energy flows.
Focus on: Which houses are emphasized and what that means for their daily life.
Key data:
${housesSummary}`,

    aspects: `ASPECTS: The conversations between their planets.
Focus on: The major aspects and how they create internal dynamics.
Key data:
${aspectsSummary}`,

    patterns: `PATTERNS: Grand trines, T-squares, stelliums, and other configurations.
Focus on: ${patterns.length > 0 ? `Their ${patterns.map(p => p.type === "grand_trine" ? "Grand Trine" : "T-Square").join(", ")} and what these patterns reveal.` : "How their planets work together even without major patterns."}
Key data: ${patterns.length > 0 ? patterns.map(p => `${p.type === "grand_trine" ? "Grand Trine" : "T-Square"}: ${p.planets.join(", ")}`).join("; ") : "No major patterns - focus on planetary distribution"}`,

    energyShape: `ENERGY SHAPE: Element and modality balance.
Focus on: Their elemental makeup (fire/earth/air/water) and how it shapes their approach to life.
Key data:
- Elements: Fire ${placements.derived?.elementBalance?.fire || 0}, Earth ${placements.derived?.elementBalance?.earth || 0}, Air ${placements.derived?.elementBalance?.air || 0}, Water ${placements.derived?.elementBalance?.water || 0}
- Modalities: Cardinal ${placements.derived?.modalityBalance?.cardinal || 0}, Fixed ${placements.derived?.modalityBalance?.fixed || 0}, Mutable ${placements.derived?.modalityBalance?.mutable || 0}`,

    intensityZones: `INTENSITY ZONES: Where energy clusters in their chart.
Focus on: House emphasis, stelliums, and where life feels most concentrated.
Key data:
- House emphasis: ${placements.calculated?.emphasis?.houseEmphasis?.slice(0, 5).map(h => `House ${h.house} (${h.count})`).join(", ") || "evenly distributed"}
- Sign emphasis: ${placements.calculated?.emphasis?.signEmphasis?.slice(0, 5).map(s => `${s.sign} (${s.count})`).join(", ") || "evenly distributed"}`,

    direction: `DIRECTION: North Node, South Node, and life path.
Focus on: Where they're growing toward (North Node) vs. their comfort zone (South Node).
Key data:
- North Node: ${northNode ? `${northNode.sign} in House ${northNode.house || "?"}` : "unknown"}
- South Node: ${southNode ? `${southNode.sign} in House ${southNode.house || "?"}` : "unknown"}`,

    joy: `JOY: Part of Fortune and where ease naturally appears.
Focus on: Their Part of Fortune placement and how to access their natural joy.
Key data:
- Part of Fortune: ${partOfFortune ? `${partOfFortune.sign} in House ${partOfFortune.house || "?"}` : "unknown"}`
  };

  // Build the tabs section of the prompt
  const tabsPrompt = tabs.map(tab => `
"${tab}": {
  ${tabDescriptions[tab]}

  Return:
  "meaning": "Two paragraphs separated by \\n\\n. What this means for THEM specifically.",
  "aligned": ["3 specific signs they're living this energy well"],
  "offCourse": ["3 specific signs they've drifted from this energy"],
  "decisionRule": "One sentence: 'When X, lean toward Y because Z.'",
  "promptVersion": ${TAB_DEEPDIVE_VERSION}
}`).join(",\n");

  const userPrompt = `Generate personalized deep dives for ${displayName || "this person"}'s Soul Print.

CHART CONTEXT:
${chartContext}

Return this EXACT JSON structure with all requested tabs:
{
${tabsPrompt}
}

CRITICAL RULES:
- Each tab MUST have all 4 fields: meaning, aligned, offCourse, decisionRule
- meaning MUST have 2 paragraphs separated by \\n\\n (at least 100 characters total)
- aligned and offCourse MUST each have exactly 3 items (each at least 10 characters)
- Each bullet must be specific to THEIR chart. Reference their signs, houses, planets.
- Do not write generic astrology. Make it feel like reading about THEM.

Language: ${language}`;

  try {
    // P0: Budget check before OpenAI call
    const budgetCheck = await checkBudget();
    if (!budgetCheck.allowed) {
      console.warn("[BirthChart] Budget exceeded, skipping tab deep dives generation");
      return null;
    }

    console.log(`[BirthChart] Generating ${tabs.length} tab deep dives...`);

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODELS.birthChart,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    });

    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      console.error("[BirthChart] Tab deep dives: OpenAI returned empty response");
      return null;
    }

    // Parse the response
    const parsed = JSON.parse(responseContent);

    // P0: Increment daily budget counter
    void incrementBudget(
      OPENAI_MODELS.birthChart,
      completion.usage?.prompt_tokens || 0,
      completion.usage?.completion_tokens || 0
    );

    // Token audit logging (tab deep dives)
    logTokenAudit({
      route: "/api/birth-chart",
      featureLabel: "Soul Print • Tab Deep Dives",
      model: OPENAI_MODELS.birthChart,
      cacheStatus: "miss",
      promptVersion: TAB_DEEPDIVE_VERSION,
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
    });

    // Add promptVersion to each tab if not present
    for (const key of tabs) {
      if (parsed[key] && !parsed[key].promptVersion) {
        parsed[key].promptVersion = TAB_DEEPDIVE_VERSION;
      }
    }

    // Validate each tab individually
    const validation = validateBatchedTabDeepDives(parsed);

    if (validation.invalid.length > 0) {
      console.warn(`[BirthChart] Some tab deep dives failed validation:`);
      for (const invalid of validation.invalid) {
        console.warn(`  - ${invalid.key}: ${invalid.error}`);
      }
    }

    const validCount = Object.keys(validation.valid).length;
    console.log(`[BirthChart] ✓ ${validCount}/${tabs.length} tab deep dives validated successfully`);

    if (validCount === 0) {
      console.error("[BirthChart] All tab deep dives failed validation");
      return null;
    }

    return {
      tabDeepDives: validation.valid as Partial<TabDeepDives>,
      tokens: {
        input: completion.usage?.prompt_tokens || 0,
        output: completion.usage?.completion_tokens || 0,
        total: completion.usage?.total_tokens || 0,
      },
    };
  } catch (error: any) {
    console.error("[BirthChart] Tab deep dives generation error:", error.message);
    return null;
  }
}

/**
 * Check which tab deep dives need to be generated/regenerated
 */
function getTabsNeedingGeneration(
  existingDeepDives: TabDeepDives | undefined
): TabDeepDiveKey[] {
  const needsGeneration: TabDeepDiveKey[] = [];

  for (const key of TAB_DEEP_DIVE_KEYS) {
    const existing = existingDeepDives?.[key];
    if (!existing || existing.promptVersion !== TAB_DEEPDIVE_VERSION) {
      needsGeneration.push(key);
    }
  }

  return needsGeneration;
}

/**
 * Update narrative with tab deep dives in database
 * Only updates the narrative JSON - preserves all other fields
 */
async function updateNarrativeWithTabDeepDives(
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
      console.error(`[BirthChart] Failed to update narrative with tab deep dives for user ${userId}:`, error);
    } else {
      const tabCount = Object.keys(updatedNarrative.tabDeepDives || {}).length;
      console.log(`[BirthChart] ✓ ${tabCount} tab deep dives stored for user ${userId} (version ${TAB_DEEPDIVE_VERSION})`);
    }
  } catch (error: any) {
    console.error(`[BirthChart] Error updating narrative with tab deep dives:`, error.message);
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

export async function POST(req: NextRequest) {
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

    // ========================================
    // PROFILE VALIDATION (before cache check)
    // ========================================

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

    // PR2 Guardrail: Reject UTC timezone (likely from fallback poisoning)
    // Birth charts require accurate timezone for correct planetary positions
    if (!isValidBirthTimezone(profile.timezone)) {
      console.log(
        `[BirthChart] Invalid timezone for user ${user.id}: "${profile.timezone}" (UTC fallback detected)`
      );
      return NextResponse.json(
        {
          error: "Invalid timezone",
          message:
            "Your birth timezone appears to be incorrectly set to UTC. Please update your birth location in Settings to get accurate chart calculations.",
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

    // Get user's language preference with fallback chain (profile → cookie → Accept-Language → cf-ipcountry → "en")
    const targetLanguage = resolveLocaleAuth(req, profile.language);
    const languageName = localeNames[targetLanguage] || "English";

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
        model: OPENAI_MODELS.birthChart,
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

      // Check which tab deep dives need to be generated/regenerated
      const tabsNeeded = getTabsNeedingGeneration(cachedNarrative.tabDeepDives);

      if (tabsNeeded.length > 0) {
        console.log(`[BirthChart] ${tabsNeeded.length} tab deep dives need generation for user ${user.id}: ${tabsNeeded.join(", ")}`);

        const displayName = profile.preferred_name || profile.full_name;
        const deepDiveResult = await generateAllTabDeepDives(
          swissPlacements,
          targetLanguage,
          displayName,
          tabsNeeded
        );

        if (deepDiveResult) {
          // Merge new deep dives with existing ones (preserving any that didn't need regeneration)
          const updatedNarrative: FullBirthChartInsight = {
            ...cachedNarrative,
            tabDeepDives: {
              ...cachedNarrative.tabDeepDives,
              ...deepDiveResult.tabDeepDives,
            },
          };

          // Store updated narrative (non-blocking)
          void updateNarrativeWithTabDeepDives(user.id, updatedNarrative);

          // Track tab deep dive generation (miss)
          void trackAiUsage({
            featureLabel: "Soul Print • Tab Deep Dives",
            route: "/api/birth-chart",
            model: OPENAI_MODELS.birthChart,
            promptVersion: TAB_DEEPDIVE_VERSION,
            cacheStatus: "miss",
            inputTokens: deepDiveResult.tokens.input,
            outputTokens: deepDiveResult.tokens.output,
            totalTokens: deepDiveResult.tokens.total,
            userId: user.id,
            timeframe: null,
            periodKey: null,
            language: targetLanguage,
            timezone: profile.timezone || null,
          });

          // Return updated narrative with new deep dives
          return NextResponse.json({
            placements: swissPlacements,
            insight: updatedNarrative,
          });
        }
      }

      // Return cached narrative with placements (all deep dives current or generation failed)
      return NextResponse.json({
        placements: swissPlacements,
        insight: cachedNarrative,
      });
    }

    console.log(`[BirthChart] ✗ Cache miss for Soul Print narrative - generating fresh (user: ${user.id}, prompt v${PROMPT_VERSION}, lang: ${targetLanguage})`);

    // ========================================
    // CACHE MISS - Apply rate limiting now
    // Only generation attempts count toward limits
    // ========================================

    // Burst check first (bot defense - 10 requests in 10 seconds)
    const burstResult = await checkBurstLimit(`birthchart:${user.id}`, BURST_LIMIT, BURST_WINDOW);
    if (!burstResult.success) {
      const retryAfter = Math.ceil((burstResult.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        createRateLimitResponse(retryAfter, "Slow down — your Soul Print is already being generated."),
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    // Cooldown check (only for generation attempts)
    const cooldownKey = `birthchart:cooldown:${user.id}`;
    const lastRequestTime = await getCache<number>(cooldownKey);
    if (lastRequestTime) {
      const elapsed = Math.floor((Date.now() - lastRequestTime) / 1000);
      const remaining = COOLDOWN_SECONDS - elapsed;
      if (remaining > 0) {
        return NextResponse.json(
          createRateLimitResponse(remaining, "Just a moment — your Soul Print is still loading."),
          { status: 429, headers: { "Retry-After": String(remaining) } }
        );
      }
    }

    // Sustained rate limit check (20 generations per hour)
    const rateLimitResult = await checkRateLimit(
      `birthchart:rate:${user.id}`,
      USER_RATE_LIMIT,
      USER_RATE_WINDOW
    );
    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        createRateLimitResponse(retryAfter, `You've reached your hourly limit. Try again in ${Math.ceil(retryAfter / 60)} minutes.`),
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    // Set cooldown NOW (we're about to generate)
    await setCache(cooldownKey, Date.now(), COOLDOWN_SECONDS);

    // ========================================
    // STEP C: Generate fresh AI narrative
    // ========================================

    // P0: Redis availability check (fail-closed for expensive operations)
    if (!isRedisAvailable()) {
      console.warn("[BirthChart] Redis unavailable, failing closed");
      return NextResponse.json(REDIS_UNAVAILABLE_RESPONSE, { status: 503 });
    }

    // P0: Budget check before OpenAI call
    const budgetCheck = await checkBudget();
    if (!budgetCheck.allowed) {
      console.warn("[BirthChart] Budget exceeded, rejecting request");
      return NextResponse.json(BUDGET_EXCEEDED_RESPONSE, { status: 503 });
    }

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
      model: OPENAI_MODELS.birthChart,
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
      model: OPENAI_MODELS.birthChart,
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

    // P0: Increment daily budget counter
    void incrementBudget(
      OPENAI_MODELS.birthChart,
      completion.usage?.prompt_tokens || 0,
      completion.usage?.completion_tokens || 0
    );

    // Token audit logging (main narrative)
    logTokenAudit({
      route: "/api/birth-chart",
      featureLabel: "Soul Print • Narrative",
      model: OPENAI_MODELS.birthChart,
      cacheStatus: "miss",
      promptVersion: PROMPT_VERSION,
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      language: targetLanguage,
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

      // Generate all tab deep dives for the fresh narrative
      console.log(`[BirthChart] Generating all tab deep dives for fresh narrative (user: ${user.id})...`);

      const deepDiveResult = await generateAllTabDeepDives(
        swissPlacements,
        targetLanguage,
        displayName
      );

      if (deepDiveResult) {
        // Merge all tab deep dives into insight
        insight = {
          ...insight,
          tabDeepDives: deepDiveResult.tabDeepDives,
        };

        // Track tab deep dive generation (miss)
        void trackAiUsage({
          featureLabel: "Soul Print • Tab Deep Dives",
          route: "/api/birth-chart",
          model: OPENAI_MODELS.birthChart,
          promptVersion: TAB_DEEPDIVE_VERSION,
          cacheStatus: "miss",
          inputTokens: deepDiveResult.tokens.input,
          outputTokens: deepDiveResult.tokens.output,
          totalTokens: deepDiveResult.tokens.total,
          userId: user.id,
          timeframe: null,
          periodKey: null,
          language: targetLanguage,
          timezone: profile.timezone || null,
        });

        const tabCount = Object.keys(deepDiveResult.tabDeepDives).length;
        console.log(`[BirthChart] ✓ ${tabCount} tab deep dives generated and merged for user ${user.id}`);
      }

      // Store narrative (with tab deep dives if generated) in soul_paths for future requests (stone tablet caching)
      // Only store after validation passes
      void storeCachedNarrative(
        user.id,
        insight,
        PROMPT_VERSION,
        targetLanguage,
        OPENAI_MODELS.birthChart
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
