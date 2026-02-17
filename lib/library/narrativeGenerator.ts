/**
 * Narrative Generator for Library Book Model
 *
 * Generates AI narratives for birth charts stored in the global library.
 * Extracted from app/api/birth-chart/route.ts for reuse.
 *
 * Key principle: Book = Math + Narrative stored together
 */

import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { checkBudget, incrementBudget } from "@/lib/ai/costControl";
import { logTokenAudit } from "@/lib/ai/tokenAudit";
import { validateBirthChartInsight, validateBatchedTabDeepDives, TAB_DEEP_DIVE_KEYS } from "@/lib/validation/schemas";
import type { SwissPlacements } from "@/lib/ephemeris/swissEngine";
import type { NatalAIRequest, FullBirthChartInsight, TabDeepDives, TabDeepDiveKey } from "@/types/natalAI";
import {
  SOUL_PATH_SYSTEM_PROMPT,
  TAB_DEEPDIVE_SYSTEM_PROMPT,
  NARRATIVE_PROMPT_VERSION,
  TAB_DEEPDIVE_VERSION,
  buildChartContext,
  getTabDescription,
} from "@/lib/ai/prompts/soulPath";

export type NarrativeGenerationResult = {
  narrative: FullBirthChartInsight;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
};

export type TabDeepDivesResult = {
  tabDeepDives: Partial<TabDeepDives>;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
};

/**
 * Generate Soul Print narrative from chart placements
 *
 * @param placements - Swiss Ephemeris placements (the math)
 * @param language - Target language code
 * @param displayName - User's display name for personalization
 * @param profile - Optional profile data for additional context
 * @returns Generated narrative with token usage
 */
export async function generateNarrative(
  placements: SwissPlacements,
  language: string,
  displayName: string | null,
  profile?: {
    birth_date?: string;
    birth_time?: string | null;
    birth_city?: string | null;
    birth_region?: string | null;
    birth_country?: string | null;
    timezone?: string;
    zodiac_sign?: string | null;
  }
): Promise<NarrativeGenerationResult | null> {
  // Budget check before OpenAI call
  const budgetCheck = await checkBudget();
  if (!budgetCheck.allowed) {
    console.warn("[NarrativeGenerator] Budget exceeded, skipping narrative generation");
    return null;
  }

  // Build NatalAIRequest for OpenAI
  const aiPayload: NatalAIRequest = {
    mode: "natal_full_profile",
    language,
    profile: {
      name: displayName || undefined,
      zodiacSign: profile?.zodiac_sign || undefined,
    },
    birth: {
      date: profile?.birth_date || "",
      time: profile?.birth_time || null,
      timezone: profile?.timezone || "",
      city: profile?.birth_city || null,
      region: profile?.birth_region || null,
      country: profile?.birth_country || null,
      lat: 0, // Not used in narrative generation
      lon: 0, // Not used in narrative generation
    },
    placements: {
      system: placements.system,
      planets: placements.planets.map((p) => ({
        name: p.name,
        sign: p.sign,
        house: p.house,
        longitude: p.longitude ?? null,
        retrograde: p.retrograde ?? false,
      })),
      houses: placements.houses.map((h) => ({
        house: h.house,
        signOnCusp: h.signOnCusp,
      })),
      angles: {
        ascendant: { sign: placements.angles.ascendant.sign },
        midheaven: { sign: placements.angles.midheaven.sign },
        descendant: { sign: placements.angles.descendant.sign },
        ic: { sign: placements.angles.ic.sign },
      },
      aspects: (placements.aspects ?? []).map((a) => ({
        between: `${a.between[0]}-${a.between[1]}`,
        type: a.type,
        orb: a.orb,
      })),
      // Derived summary from Swiss Ephemeris (chart ruler, dominants, balances)
      derived: placements.derived ? {
        chartRuler: placements.derived.chartRuler,
        dominantSigns: placements.derived.dominantSigns?.slice(0, 5) ?? [],
        dominantPlanets: placements.derived.dominantPlanets?.slice(0, 5) ?? [],
        elementBalance: placements.derived.elementBalance,
        modalityBalance: placements.derived.modalityBalance,
        topAspects: (placements.derived.topAspects ?? []).slice(0, 8).map((a) => ({
          between: `${a.between[0]}-${a.between[1]}`,
          type: a.type,
          orb: a.orb,
        })),
      } : undefined,
      // Calculated features from Swiss Ephemeris (chart type, nodes, emphasis, patterns)
      calculated: placements.calculated ? {
        chartType: placements.calculated.chartType,
        southNode: placements.calculated.southNode ? {
          sign: placements.calculated.southNode.sign,
          house: placements.calculated.southNode.house ?? null,
        } : null,
        partOfFortune: placements.calculated.partOfFortune ? {
          sign: placements.calculated.partOfFortune.sign,
          house: placements.calculated.partOfFortune.house ?? null,
        } : null,
        emphasis: placements.calculated.emphasis ? {
          houseEmphasis: placements.calculated.emphasis.houseEmphasis?.slice(0, 5) ?? [],
          signEmphasis: placements.calculated.emphasis.signEmphasis?.slice(0, 5) ?? [],
          stelliums: placements.calculated.emphasis.stelliums ?? [],
        } : null,
        patterns: placements.calculated.patterns ?? [],
      } : undefined,
    },
  };

  console.log("[NarrativeGenerator] Calling OpenAI for Soul Path narrative...");

  try {
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

    // Increment budget counter
    void incrementBudget(
      OPENAI_MODELS.birthChart,
      completion.usage?.prompt_tokens || 0,
      completion.usage?.completion_tokens || 0
    );

    // Token audit logging
    logTokenAudit({
      route: "/api/birth-chart-library",
      featureLabel: "Soul Print • Narrative (Library)",
      model: OPENAI_MODELS.birthChart,
      cacheStatus: "miss",
      promptVersion: NARRATIVE_PROMPT_VERSION,
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      language,
    });

    if (!responseContent) {
      console.error("[NarrativeGenerator] OpenAI returned empty response");
      return null;
    }

    // Parse and validate
    const parsed = JSON.parse(responseContent);
    const validation = validateBirthChartInsight(parsed);

    if (!validation.success) {
      console.error("[NarrativeGenerator] Validation failed:", validation.error);
      console.error("[NarrativeGenerator] Invalid fields:", validation.fields.join(", "));
      return null;
    }

    console.log("[NarrativeGenerator] Narrative generated and validated successfully");

    return {
      narrative: validation.data as FullBirthChartInsight,
      tokens: {
        input: completion.usage?.prompt_tokens || 0,
        output: completion.usage?.completion_tokens || 0,
        total: completion.usage?.total_tokens || 0,
      },
    };
  } catch (error: any) {
    console.error("[NarrativeGenerator] Generation error:", error.message);
    return null;
  }
}

/**
 * Generate ALL Tab Deep Dives in a single batched OpenAI call
 *
 * @param placements - Swiss placements with all calculated data
 * @param language - Target language code
 * @param displayName - User's display name for personalization
 * @param tabsToGenerate - Specific tabs to generate (defaults to all)
 * @returns Object with valid tab deep dives and token usage
 */
export async function generateTabDeepDives(
  placements: SwissPlacements,
  language: string,
  displayName: string | null,
  tabsToGenerate?: TabDeepDiveKey[]
): Promise<TabDeepDivesResult | null> {
  const tabs = tabsToGenerate || [...TAB_DEEP_DIVE_KEYS];
  const chartContext = buildChartContext(placements);

  // Build the tabs section of the prompt
  const tabsPrompt = tabs.map(tab => `
"${tab}": {
  ${getTabDescription(tab, placements)}

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
    // Budget check before OpenAI call
    const budgetCheck = await checkBudget();
    if (!budgetCheck.allowed) {
      console.warn("[NarrativeGenerator] Budget exceeded, skipping tab deep dives generation");
      return null;
    }

    console.log(`[NarrativeGenerator] Generating ${tabs.length} tab deep dives...`);

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODELS.birthChart,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: TAB_DEEPDIVE_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    });

    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      console.error("[NarrativeGenerator] Tab deep dives: OpenAI returned empty response");
      return null;
    }

    // Parse the response
    const parsed = JSON.parse(responseContent);

    // Increment budget counter
    void incrementBudget(
      OPENAI_MODELS.birthChart,
      completion.usage?.prompt_tokens || 0,
      completion.usage?.completion_tokens || 0
    );

    // Token audit logging
    logTokenAudit({
      route: "/api/birth-chart-library",
      featureLabel: "Soul Print • Tab Deep Dives (Library)",
      model: OPENAI_MODELS.birthChart,
      cacheStatus: "miss",
      promptVersion: TAB_DEEPDIVE_VERSION,
      inputTokens: completion.usage?.prompt_tokens || 0,
      outputTokens: completion.usage?.completion_tokens || 0,
      language,
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
      console.warn(`[NarrativeGenerator] Some tab deep dives failed validation:`);
      for (const invalid of validation.invalid) {
        console.warn(`  - ${invalid.key}: ${invalid.error}`);
      }
    }

    const validCount = Object.keys(validation.valid).length;
    console.log(`[NarrativeGenerator] ${validCount}/${tabs.length} tab deep dives validated successfully`);

    if (validCount === 0) {
      console.error("[NarrativeGenerator] All tab deep dives failed validation");
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
    console.error("[NarrativeGenerator] Tab deep dives generation error:", error.message);
    return null;
  }
}

/**
 * Generate complete narrative with tab deep dives
 *
 * @param placements - Swiss placements
 * @param language - Target language code
 * @param displayName - User's display name
 * @param profile - Optional profile data
 * @returns Complete narrative with tab deep dives
 */
export async function generateCompleteNarrative(
  placements: SwissPlacements,
  language: string,
  displayName: string | null,
  profile?: {
    birth_date?: string;
    birth_time?: string | null;
    birth_city?: string | null;
    birth_region?: string | null;
    birth_country?: string | null;
    timezone?: string;
    zodiac_sign?: string | null;
  }
): Promise<NarrativeGenerationResult | null> {
  // Generate main narrative
  const narrativeResult = await generateNarrative(placements, language, displayName, profile);
  if (!narrativeResult) {
    return null;
  }

  // Generate tab deep dives
  const tabResult = await generateTabDeepDives(placements, language, displayName);
  if (tabResult) {
    narrativeResult.narrative = {
      ...narrativeResult.narrative,
      tabDeepDives: tabResult.tabDeepDives,
    };
    narrativeResult.tokens.input += tabResult.tokens.input;
    narrativeResult.tokens.output += tabResult.tokens.output;
    narrativeResult.tokens.total += tabResult.tokens.total;
  }

  return narrativeResult;
}

// Re-export version constants
export { NARRATIVE_PROMPT_VERSION, TAB_DEEPDIVE_VERSION };
