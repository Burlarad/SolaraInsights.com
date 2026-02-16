/**
 * Numerology Narrative Generator
 *
 * Generates AI narratives for numerology profiles stored in the global library.
 * Mirrors the astrology narrative pipeline (lib/library/narrativeGenerator.ts).
 *
 * Key principles:
 * - Book = Math + Narrative stored together in numerology_library
 * - Math comes from the deterministic compute engine (lib/numerology/)
 * - Narrative comes from AI (this file)
 * - Solara tone: warm, poetic, grounded, clear
 * - NO prescriptive advice ("you should", "try doing")
 * - Only reflective observations, metaphors, themes, patterns
 */

import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { checkBudget, incrementBudget } from "@/lib/ai/costControl";
import { logTokenAudit } from "@/lib/ai/tokenAudit";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { NumerologyComputeResult } from "@/lib/numerology/index";
import type { NumerologyInput as KeyNormInput } from "./keyNormalization";

// ============================================================================
// TYPES
// ============================================================================

export type NumerologyNarrativeSection = {
  heading: string;
  body: string;
};

export type NumerologyNarrative = {
  sections: NumerologyNarrativeSection[];
};

export type NumerologyNarrativeResult = {
  narrative: NumerologyNarrative;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
};

// Current narrative prompt version — increment when prompt changes
export const NUMEROLOGY_NARRATIVE_PROMPT_VERSION = 1;

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const NUMEROLOGY_NARRATIVE_SYSTEM_PROMPT = `You are Ayren, the voice of Solara — a warm, poetic, grounded numerology narrator.

TASK: Given a person's computed numerology profile (core numbers, pinnacles, challenges, lucky numbers, karmic debt), write a flowing narrative that weaves these numbers into a cohesive story of who this person is and the patterns that shape their life.

VOICE RULES (CRITICAL — violations cause rejection):
1. Warm, poetic, grounded, and clear. Like a wise friend reflecting on someone's nature.
2. NEVER give direct recommendations or advice:
   - No "you should…"
   - No "try doing…"
   - No prescriptions, calls to action, or personal guidance
   - No imperative sentences directed at the person
3. You MAY describe themes, tendencies, metaphors, patterns, and reflective observations.
   - "There is a quiet magnetism in this combination…"
   - "The 7 here tends to draw the inner world into sharper focus…"
   - "A life path of 3 often carries the echo of creative expression…"
4. Use non-deterministic language: "may", "often", "tends to", "invites", "can"
5. Refer to the person in third person ("this person", "they") or use the provided name if given.
6. Each section body should be 2-4 rich paragraphs.

OUTPUT FORMAT (strict JSON, no markdown):
{
  "sections": [
    { "heading": "Section Title", "body": "Paragraph text here..." },
    ...
  ]
}

REQUIRED SECTIONS (4-7 total):
1. "Overview" — A poetic opening that weaves the core numbers into a portrait
2. "The Inner Landscape" — Soul Urge and Personality: inner motivations vs outer expression
3. "Life's Unfolding Path" — Life Path + Pinnacles: the arc and seasons of life
4. "Challenges & Growth" — Challenges and Karmic Debt: the tensions that shape growth
5-7. Additional thematic sections as the numbers inspire (e.g., "Creative Expression", "The Maturity Horizon", "Lucky Currents")

IMPORTANT:
- ALL numeric results come from the provided data. Do NOT compute or invent numbers.
- The narrative interprets meaning — it does not calculate.
- Output ONLY valid JSON. No markdown, no code fences, no commentary.`;

// ============================================================================
// NARRATIVE GENERATION
// ============================================================================

/**
 * Build the user message content from computed numerology data
 */
function buildNumerologyContext(
  numerology: NumerologyComputeResult,
  input: KeyNormInput,
  system: string,
  displayName: string | null,
  language: string
): string {
  const { coreNumbers, pinnacles, challenges, luckyNumbers, karmicDebt } = numerology;

  return JSON.stringify({
    language,
    system,
    name: displayName || undefined,
    birthDate: input.birth_date,
    coreNumbers: {
      lifePath: coreNumbers.lifePath,
      expression: coreNumbers.expression,
      soulUrge: coreNumbers.soulUrge,
      personality: coreNumbers.personality,
      birthday: coreNumbers.birthday,
      maturity: coreNumbers.maturity,
    },
    pinnacles: {
      first: pinnacles.first,
      second: pinnacles.second,
      third: pinnacles.third,
      fourth: pinnacles.fourth,
    },
    challenges: {
      first: challenges.first,
      second: challenges.second,
      third: challenges.third,
      fourth: challenges.fourth,
    },
    luckyNumbers: luckyNumbers.all,
    karmicDebt: {
      hasKarmicDebt: karmicDebt.hasKarmicDebt,
      numbers: karmicDebt.numbers,
    },
  });
}

/**
 * Generate a numerology narrative from computed profile data
 *
 * @returns Narrative with token usage, or null if budget exceeded / generation failed
 */
export async function generateNumerologyNarrative(
  numerology: NumerologyComputeResult,
  input: KeyNormInput,
  system: string,
  language: string,
  displayName: string | null
): Promise<NumerologyNarrativeResult | null> {
  // Budget check before OpenAI call
  const budgetCheck = await checkBudget();
  if (!budgetCheck.allowed) {
    console.warn("[NumerologyNarrative] Budget exceeded, skipping narrative generation");
    return null;
  }

  const userContent = buildNumerologyContext(numerology, input, system, displayName, language);

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODELS.birthChart, // Same premium model as astrology narratives
      messages: [
        { role: "system", content: NUMEROLOGY_NARRATIVE_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const inputTokens = completion.usage?.prompt_tokens || 0;
    const outputTokens = completion.usage?.completion_tokens || 0;

    // Increment budget
    void incrementBudget(OPENAI_MODELS.birthChart, inputTokens, outputTokens);

    // Log token audit
    logTokenAudit({
      route: "/api/numerology-library",
      featureLabel: "Numerology • Narrative (Library)",
      model: OPENAI_MODELS.birthChart,
      cacheStatus: "miss",
      promptVersion: NUMEROLOGY_NARRATIVE_PROMPT_VERSION,
      inputTokens,
      outputTokens,
      language,
    });

    // Parse response
    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      console.error("[NumerologyNarrative] Empty response from OpenAI");
      return null;
    }

    const parsed = JSON.parse(raw) as NumerologyNarrative;

    // Validate structure
    if (!parsed.sections || !Array.isArray(parsed.sections) || parsed.sections.length < 4) {
      console.error("[NumerologyNarrative] Invalid narrative structure: expected 4+ sections, got", parsed.sections?.length);
      return null;
    }

    for (const section of parsed.sections) {
      if (!section.heading || !section.body || section.body.length < 50) {
        console.error("[NumerologyNarrative] Invalid section:", section.heading);
        return null;
      }
    }

    return {
      narrative: parsed,
      tokens: {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
      },
    };
  } catch (error: any) {
    console.error("[NumerologyNarrative] Generation failed:", error.message);
    return null;
  }
}

// ============================================================================
// ENSURE NARRATIVE (cache check + generate if missing)
// ============================================================================

/**
 * Ensure a numerology book has a narrative, generating one if missing or outdated.
 *
 * Mirrors ensureNarrative() from lib/library/charts.ts.
 *
 * @param numerologyKey - The book's deterministic key
 * @param numerology - Computed numerology data (the math)
 * @param input - Normalized input data
 * @param system - "pythagorean" or "chaldean"
 * @param language - Target language
 * @param displayName - Person's name for personalization
 * @param existingNarrative - Existing narrative_json from library (if any)
 * @param existingPromptVersion - Existing prompt version (if any)
 * @param existingLanguage - Existing narrative language (if any)
 * @returns The narrative (from cache or freshly generated), or null if generation failed
 */
export async function ensureNumerologyNarrative(
  numerologyKey: string,
  numerology: NumerologyComputeResult,
  input: KeyNormInput,
  system: string,
  language: string,
  displayName: string | null,
  existingNarrative: NumerologyNarrative | null,
  existingPromptVersion: number | null,
  existingLanguage: string | null
): Promise<NumerologyNarrative | null> {
  // Check if existing narrative is valid
  if (
    existingNarrative &&
    existingPromptVersion === NUMEROLOGY_NARRATIVE_PROMPT_VERSION &&
    existingLanguage === language
  ) {
    logTokenAudit({
      route: "/api/numerology-library",
      featureLabel: "Numerology • Narrative (Library)",
      model: OPENAI_MODELS.birthChart,
      cacheStatus: "hit",
      inputTokens: 0,
      outputTokens: 0,
    });
    return existingNarrative;
  }

  // Generate fresh narrative
  console.log(`[NumerologyNarrative] Generating narrative for ${numerologyKey} (lang: ${language})`);
  const result = await generateNumerologyNarrative(numerology, input, system, language, displayName);

  if (!result) {
    console.warn(`[NumerologyNarrative] Failed to generate narrative for ${numerologyKey}`);
    return existingNarrative; // Return existing (even if stale) rather than null
  }

  // Store narrative in numerology_library
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("numerology_library")
    .update({
      narrative_json: result.narrative,
      narrative_prompt_version: NUMEROLOGY_NARRATIVE_PROMPT_VERSION,
      narrative_language: language,
      narrative_generated_at: new Date().toISOString(),
    })
    .eq("numerology_key", numerologyKey);

  if (error) {
    console.error(`[NumerologyNarrative] Failed to store narrative for ${numerologyKey}:`, error);
    // Still return the generated narrative even if storage failed
  } else {
    console.log(`[NumerologyNarrative] Narrative stored for ${numerologyKey}`);
  }

  return result.narrative;
}
