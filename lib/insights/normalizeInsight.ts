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
};

const DEFAULT_DAILY_WISDOM = {
  quote: "",
  author: "",
  context: "",
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
      coreThemes: [],
      focusForPeriod: "",
      tarot: { ...DEFAULT_TAROT },
      rune: { ...DEFAULT_RUNE },
      luckyCompass: {
        numbers: [],
        powerWords: [],
      },
      dailyWisdom: { ...DEFAULT_DAILY_WISDOM },
    };
  }

  return {
    // String fields - default to empty string
    personalNarrative: insight.personalNarrative ?? "",
    focusForPeriod: insight.focusForPeriod ?? "",

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
    },

    // Daily wisdom - personalized quote from historical figure
    dailyWisdom: {
      quote: insight.dailyWisdom?.quote ?? DEFAULT_DAILY_WISDOM.quote,
      author: insight.dailyWisdom?.author ?? DEFAULT_DAILY_WISDOM.author,
      context: insight.dailyWisdom?.context ?? DEFAULT_DAILY_WISDOM.context,
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
    Array.isArray(obj.coreThemes) &&
    typeof obj.focusForPeriod === "string" &&
    obj.tarot !== undefined &&
    obj.rune !== undefined &&
    obj.luckyCompass !== undefined &&
    obj.dailyWisdom !== undefined
  );
}
