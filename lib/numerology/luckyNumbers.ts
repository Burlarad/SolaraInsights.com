/**
 * Lucky Numbers Calculation
 *
 * Derives lucky numbers from core numerology numbers.
 * These are NOT random - they're mathematically derived from
 * the user's Life Path, Expression, and other core numbers.
 *
 * The lucky numbers represent energies that resonate with
 * the person's numerological blueprint.
 */

import type { LuckyNumbers, CoreNumbers } from "@/types/numerology";

// ============================================================================
// LUCKY NUMBER DERIVATION
// ============================================================================

/**
 * Compute lucky numbers from core numerology numbers
 *
 * Derivation logic:
 * - Primary: Life Path number (most important)
 * - Secondary: Expression, Soul Urge, Birthday (unique values only)
 * - All: Combined and deduplicated
 *
 * @param coreNumbers - Pre-calculated core numbers
 * @returns LuckyNumbers object with primary, secondary, and all numbers
 *
 * @example
 * // Core: LP=3, Birthday=4, Expression=1, SoulUrge=9, Personality=1
 * // Primary: 3
 * // Secondary: [1, 9, 4] (unique, excluding primary)
 * // All: [3, 1, 9, 4]
 */
export function computeLuckyNumbers(coreNumbers: CoreNumbers): LuckyNumbers {
  const primary = coreNumbers.lifePath.value;

  // Collect candidate numbers from other core numbers
  const candidates = [
    coreNumbers.expression.value,
    coreNumbers.soulUrge.value,
    coreNumbers.birthday.value,
    coreNumbers.personality.value,
  ];

  // Filter to unique values that aren't the primary
  const seen = new Set<number>([primary]);
  const secondary: number[] = [];

  for (const num of candidates) {
    if (!seen.has(num)) {
      seen.add(num);
      secondary.push(num);
    }
  }

  // Limit secondary to 3 numbers max for cleaner display
  const limitedSecondary = secondary.slice(0, 3);

  // Combine all unique numbers
  const all = [primary, ...limitedSecondary];

  return {
    primary,
    secondary: limitedSecondary,
    all,
  };
}

// ============================================================================
// LUCKY NUMBER MEANINGS
// ============================================================================

/**
 * Get the meaning/significance of a lucky number
 */
export function getLuckyNumberMeaning(number: number): string {
  const meanings: Record<number, string> = {
    1: "Leadership, new beginnings, and independent action",
    2: "Harmony, partnerships, and balanced relationships",
    3: "Creativity, joy, and self-expression",
    4: "Stability, structure, and solid foundations",
    5: "Freedom, adventure, and positive change",
    6: "Love, nurturing, and domestic harmony",
    7: "Wisdom, intuition, and spiritual insight",
    8: "Abundance, success, and material achievement",
    9: "Compassion, completion, and universal love",
    11: "Spiritual insight and intuitive mastery",
    22: "Master builder energy and grand visions",
    33: "Master teacher and healing energy",
  };
  return meanings[number] || "Personal significance";
}

/**
 * Get a brief label for a lucky number
 */
export function getLuckyNumberLabel(number: number): string {
  const labels: Record<number, string> = {
    1: "Initiative",
    2: "Balance",
    3: "Expression",
    4: "Foundation",
    5: "Freedom",
    6: "Harmony",
    7: "Wisdom",
    8: "Success",
    9: "Compassion",
    11: "Intuition",
    22: "Vision",
    33: "Healing",
  };
  return labels[number] || "Power";
}

// ============================================================================
// LUCKY NUMBERS FOR INSIGHTS TAB
// ============================================================================

/**
 * Format lucky numbers for the Insights tab's Lucky Compass
 * This provides the data structure expected by the existing UI
 *
 * @param luckyNumbers - Computed lucky numbers
 * @returns Array of { value, label, meaning } for UI display
 */
export function formatLuckyNumbersForUI(
  luckyNumbers: LuckyNumbers
): { value: number; label: string; meaning: string }[] {
  return luckyNumbers.all.map((num) => ({
    value: num,
    label: getLuckyNumberLabel(num),
    meaning: getLuckyNumberMeaning(num),
  }));
}
