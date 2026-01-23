/**
 * Insight Normalizer
 *
 * Ensures SanctuaryInsight objects always have a consistent shape,
 * even if loaded from legacy cache or generated with missing fields.
 *
 * This prevents client-side crashes from undefined property access.
 */

import { SanctuaryInsight } from "@/types";

/**
 * Default values for a normalized insight
 */
const DEFAULT_EMOTIONAL_CADENCE = {
  dawn: "hopeful",
  midday: "focused",
  dusk: "reflective",
  evening: "peaceful",
  midnight: "restful",
  morning: "stirring",
};

const DEFAULT_TAROT = {
  cardName: "",
  arcanaType: "",
  summary: "",
  symbolism: "",
  guidance: "",
};

const DEFAULT_RUNE = {
  name: "",
  keyword: "",
  meaning: "",
  affirmation: "",
};

const DEFAULT_LUCKY_COMPASS = {
  numbers: [] as { value: number; label: string; meaning: string }[],
  powerWords: [] as string[],
  handwrittenNote: "",
};

/**
 * Normalize a SanctuaryInsight object to ensure all required fields exist.
 *
 * This function:
 * - Fills in missing nested objects with sensible defaults
 * - Ensures arrays are always arrays (never undefined)
 * - Ensures string fields are always strings (never undefined)
 *
 * @param insight - The raw insight object (may have missing fields)
 * @returns A fully normalized SanctuaryInsight object
 */
export function normalizeInsight(insight: Partial<SanctuaryInsight> | null | undefined): SanctuaryInsight {
  if (!insight) {
    // Return a completely empty but valid structure
    return {
      personalNarrative: "",
      emotionalCadence: {
        dawn: DEFAULT_EMOTIONAL_CADENCE.dawn,
        midday: DEFAULT_EMOTIONAL_CADENCE.midday,
        dusk: DEFAULT_EMOTIONAL_CADENCE.dusk,
        evening: DEFAULT_EMOTIONAL_CADENCE.evening,
        midnight: DEFAULT_EMOTIONAL_CADENCE.midnight,
        morning: DEFAULT_EMOTIONAL_CADENCE.morning,
      },
      coreThemes: [],
      focusForPeriod: "",
      tarot: { ...DEFAULT_TAROT },
      rune: { ...DEFAULT_RUNE },
      luckyCompass: {
        numbers: [],
        powerWords: [],
        handwrittenNote: "",
      },
    };
  }

  return {
    // String fields - default to empty string
    personalNarrative: insight.personalNarrative ?? "",
    focusForPeriod: insight.focusForPeriod ?? "",

    // Emotional cadence - ensure all six time slots exist (day + night)
    emotionalCadence: {
      dawn: insight.emotionalCadence?.dawn ?? DEFAULT_EMOTIONAL_CADENCE.dawn,
      midday: insight.emotionalCadence?.midday ?? DEFAULT_EMOTIONAL_CADENCE.midday,
      dusk: insight.emotionalCadence?.dusk ?? DEFAULT_EMOTIONAL_CADENCE.dusk,
      evening: insight.emotionalCadence?.evening ?? DEFAULT_EMOTIONAL_CADENCE.evening,
      midnight: insight.emotionalCadence?.midnight ?? DEFAULT_EMOTIONAL_CADENCE.midnight,
      morning: insight.emotionalCadence?.morning ?? DEFAULT_EMOTIONAL_CADENCE.morning,
    },

    // Arrays - ensure they're always arrays
    coreThemes: Array.isArray(insight.coreThemes) ? insight.coreThemes : [],

    // Tarot - ensure all fields exist
    tarot: {
      cardName: insight.tarot?.cardName ?? DEFAULT_TAROT.cardName,
      arcanaType: insight.tarot?.arcanaType ?? DEFAULT_TAROT.arcanaType,
      summary: insight.tarot?.summary ?? DEFAULT_TAROT.summary,
      symbolism: insight.tarot?.symbolism ?? DEFAULT_TAROT.symbolism,
      guidance: insight.tarot?.guidance ?? DEFAULT_TAROT.guidance,
    },

    // Rune - ensure all fields exist
    rune: {
      name: insight.rune?.name ?? DEFAULT_RUNE.name,
      keyword: insight.rune?.keyword ?? DEFAULT_RUNE.keyword,
      meaning: insight.rune?.meaning ?? DEFAULT_RUNE.meaning,
      affirmation: insight.rune?.affirmation ?? DEFAULT_RUNE.affirmation,
    },

    // Lucky compass - ensure all fields exist and arrays are arrays
    luckyCompass: {
      numbers: Array.isArray(insight.luckyCompass?.numbers)
        ? insight.luckyCompass.numbers.map((n) => ({
            value: n?.value ?? 0,
            label: n?.label ?? "",
            meaning: n?.meaning ?? "",
          }))
        : [],
      powerWords: Array.isArray(insight.luckyCompass?.powerWords)
        ? insight.luckyCompass.powerWords
        : [],
      handwrittenNote: insight.luckyCompass?.handwrittenNote ?? DEFAULT_LUCKY_COMPASS.handwrittenNote,
    },
  };
}

/**
 * Check if an insight appears to be valid (has all required top-level fields).
 * This is a quick sanity check, not a full validation.
 */
export function isInsightValid(insight: unknown): insight is SanctuaryInsight {
  if (!insight || typeof insight !== "object") return false;

  const obj = insight as Record<string, unknown>;

  // Check required top-level fields exist
  return (
    typeof obj.personalNarrative === "string" &&
    obj.emotionalCadence !== undefined &&
    Array.isArray(obj.coreThemes) &&
    typeof obj.focusForPeriod === "string" &&
    obj.tarot !== undefined &&
    obj.rune !== undefined &&
    obj.luckyCompass !== undefined
  );
}
