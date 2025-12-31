/**
 * Numerology Constants
 *
 * Letter-to-number mappings for Pythagorean and Chaldean systems,
 * vowel/consonant definitions, and master/karmic number sets.
 */

import type { NumerologySystem, MasterNumber, KarmicDebtNumber } from "@/types/numerology";

// ============================================================================
// PYTHAGOREAN SYSTEM (Modern Western)
// ============================================================================

/**
 * Pythagorean letter values (1-9 sequential mapping)
 *
 * 1: A, J, S
 * 2: B, K, T
 * 3: C, L, U
 * 4: D, M, V
 * 5: E, N, W
 * 6: F, O, X
 * 7: G, P, Y
 * 8: H, Q, Z
 * 9: I, R
 */
export const PYTHAGOREAN_VALUES: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  I: 9,
  J: 1,
  K: 2,
  L: 3,
  M: 4,
  N: 5,
  O: 6,
  P: 7,
  Q: 8,
  R: 9,
  S: 1,
  T: 2,
  U: 3,
  V: 4,
  W: 5,
  X: 6,
  Y: 7,
  Z: 8,
};

// ============================================================================
// CHALDEAN SYSTEM (Ancient Babylonian)
// ============================================================================

/**
 * Chaldean letter values (1-8, no 9 as it's sacred)
 *
 * Note: Chaldean system assigns values based on sound vibration,
 * not alphabetical order. The number 9 is considered sacred and
 * is not assigned to any letter.
 *
 * 1: A, I, J, Q, Y
 * 2: B, K, R
 * 3: C, G, L, S
 * 4: D, M, T
 * 5: E, H, N, X
 * 6: U, V, W
 * 7: O, Z
 * 8: F, P
 */
export const CHALDEAN_VALUES: Record<string, number> = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 8,
  G: 3,
  H: 5,
  I: 1,
  J: 1,
  K: 2,
  L: 3,
  M: 4,
  N: 5,
  O: 7,
  P: 8,
  Q: 1,
  R: 2,
  S: 3,
  T: 4,
  U: 6,
  V: 6,
  W: 6,
  X: 5,
  Y: 1,
  Z: 7,
};

// ============================================================================
// VOWELS AND CONSONANTS
// ============================================================================

/**
 * Vowels for Soul Urge calculation
 * Note: Y is treated as a consonant in standard numerology
 */
export const VOWELS = new Set(["A", "E", "I", "O", "U"]);

/**
 * Consonants for Personality calculation
 */
export const CONSONANTS = new Set([
  "B",
  "C",
  "D",
  "F",
  "G",
  "H",
  "J",
  "K",
  "L",
  "M",
  "N",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "V",
  "W",
  "X",
  "Y",
  "Z",
]);

// ============================================================================
// SPECIAL NUMBERS
// ============================================================================

/**
 * Master numbers that are NOT reduced
 * These carry higher spiritual significance
 */
export const MASTER_NUMBERS: Set<MasterNumber> = new Set([11, 22, 33]);

/**
 * Karmic debt numbers that indicate karmic lessons
 * These are intermediate values (before final reduction) that signal challenges
 */
export const KARMIC_DEBT_NUMBERS: Set<KarmicDebtNumber> = new Set([13, 14, 16, 19]);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the letter values map for a given system
 */
export function getLetterValues(system: NumerologySystem): Record<string, number> {
  return system === "chaldean" ? CHALDEAN_VALUES : PYTHAGOREAN_VALUES;
}

/**
 * Check if a number is a master number
 */
export function isMasterNumber(n: number): n is MasterNumber {
  return MASTER_NUMBERS.has(n as MasterNumber);
}

/**
 * Check if a number is a karmic debt number
 */
export function isKarmicDebtNumber(n: number): n is KarmicDebtNumber {
  return KARMIC_DEBT_NUMBERS.has(n as KarmicDebtNumber);
}

/**
 * Check if a character is a vowel
 */
export function isVowel(char: string): boolean {
  return VOWELS.has(char.toUpperCase());
}

/**
 * Check if a character is a consonant
 */
export function isConsonant(char: string): boolean {
  return CONSONANTS.has(char.toUpperCase());
}

// ============================================================================
// VERSION TRACKING
// ============================================================================

/**
 * Current prompt/calculation version
 * Increment this when calculation logic changes to invalidate cached profiles
 */
export const NUMEROLOGY_PROMPT_VERSION = 1;
