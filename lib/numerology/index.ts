/**
 * Numerology Engine
 *
 * Main entry point for all numerology calculations.
 * Computes a complete numerology profile from birth date and name.
 *
 * Test Case (Ayren): Aaron Dean Burlar, DOB 1992-05-04
 * Expected Pythagorean Results:
 * - Life Path: 3
 * - Birthday: 4
 * - Expression: 1
 * - Soul Urge: 9
 * - Personality: 1
 * - Maturity: 4
 * - Pinnacles: 9, 7, 7, 8
 * - Challenges: 1, 1, 0, 2
 */

import type {
  NumerologySystem,
  NumerologyInput,
  NumerologyProfile,
  CycleNumbers,
  CoreNumbers,
  Pinnacles,
  Challenges,
  LuckyNumbers,
  KarmicDebt,
} from "@/types/numerology";

// Import calculation modules
import { computeCoreNumbers, type CoreNumbersInput } from "./coreNumbers";
import { computeCycles } from "./cycles";
import { computePinnacles, computeChallenges } from "./pinnacles";
import { computeLuckyNumbers } from "./luckyNumbers";
import { computeKarmicDebt } from "./karmicDebt";
import { NUMEROLOGY_PROMPT_VERSION } from "./constants";

// ============================================================================
// MAIN COMPUTATION
// ============================================================================

/**
 * Result of computing a full numerology profile
 */
export interface NumerologyComputeResult {
  coreNumbers: CoreNumbers;
  pinnacles: Pinnacles;
  challenges: Challenges;
  luckyNumbers: LuckyNumbers;
  karmicDebt: KarmicDebt;
}

/**
 * Compute a complete numerology profile from birth data
 *
 * This computes all "stone tablet" values that don't change:
 * - Core numbers (Life Path, Expression, Soul Urge, etc.)
 * - Pinnacles and Challenges (life period themes)
 * - Lucky numbers (derived from core numbers)
 * - Karmic debt indicators
 *
 * NOTE: Cycles (Personal Year/Month/Day) are NOT included here
 * because they depend on the current date. Use computeCycles()
 * separately with the current date.
 *
 * @param input - Birth date and name information
 * @returns Complete numerology computation result
 *
 * @example
 * const result = computeNumerologyProfile({
 *   birthDate: "1992-05-04",
 *   birthFirstName: "Aaron",
 *   birthMiddleName: "Dean",
 *   birthLastName: "Burlar",
 *   system: "pythagorean"
 * });
 */
export function computeNumerologyProfile(input: NumerologyInput): NumerologyComputeResult {
  const {
    birthDate,
    birthFirstName,
    birthMiddleName,
    birthLastName,
    system = "pythagorean",
  } = input;

  // Compute core numbers
  const coreInput: CoreNumbersInput = {
    birthDate,
    birthFirstName,
    birthMiddleName,
    birthLastName,
    system,
  };
  const coreNumbers = computeCoreNumbers(coreInput);

  // Compute pinnacles (need Life Path for age ranges)
  const pinnacles = computePinnacles(birthDate, coreNumbers.lifePath.value);

  // Compute challenges
  const challenges = computeChallenges(birthDate);

  // Compute lucky numbers from core numbers
  const luckyNumbers = computeLuckyNumbers(coreNumbers);

  // Compute karmic debt
  const karmicDebt = computeKarmicDebt(
    birthDate,
    birthFirstName,
    birthMiddleName,
    birthLastName,
    system
  );

  return {
    coreNumbers,
    pinnacles,
    challenges,
    luckyNumbers,
    karmicDebt,
  };
}

// ============================================================================
// FULL PROFILE CONSTRUCTION
// ============================================================================

/**
 * Construct a complete NumerologyProfile object for database storage
 *
 * @param userId - User's ID
 * @param input - Birth data input
 * @param result - Computed numerology result
 * @returns NumerologyProfile ready for storage
 */
export function constructNumerologyProfile(
  userId: string,
  input: NumerologyInput,
  result: NumerologyComputeResult
): Omit<NumerologyProfile, "id" | "createdAt" | "updatedAt"> {
  const { birthDate, birthFirstName, birthMiddleName, birthLastName, system = "pythagorean" } =
    input;

  return {
    userId,
    system,
    input: {
      birthDate,
      birthFirstName,
      birthMiddleName,
      birthLastName,
    },
    coreNumbers: result.coreNumbers,
    pinnacles: result.pinnacles,
    challenges: result.challenges,
    luckyNumbers: result.luckyNumbers,
    karmicDebt: result.karmicDebt,
    promptVersion: NUMEROLOGY_PROMPT_VERSION,
  };
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

// Constants
export {
  PYTHAGOREAN_VALUES,
  CHALDEAN_VALUES,
  VOWELS,
  CONSONANTS,
  MASTER_NUMBERS,
  KARMIC_DEBT_NUMBERS,
  isMasterNumber,
  isKarmicDebtNumber,
  isVowel,
  isConsonant,
  NUMEROLOGY_PROMPT_VERSION,
} from "./constants";

// Utils
export {
  reduceToSingleDigit,
  reduceWithMaster,
  sumDigits,
  nameToNumber,
  vowelsToNumber,
  consonantsToNumber,
  getFullBirthName,
  parseDate,
  dateToLifePathSum,
  isValidName,
  isValidDateString,
} from "./utils";

// Core Numbers
export {
  calculateLifePath,
  calculateBirthday,
  calculateExpression,
  calculateSoulUrge,
  calculatePersonality,
  calculateMaturity,
  computeCoreNumbers,
} from "./coreNumbers";

// Cycles
export {
  calculatePersonalYear,
  calculatePersonalMonth,
  calculatePersonalDay,
  computeCycles,
  getPersonalYearMeaning,
  getPersonalYearKeyword,
} from "./cycles";

// Pinnacles & Challenges
export {
  computePinnacles,
  computeChallenges,
  getPinnacleMeaning,
  getChallengeMeaning,
  getCurrentPinnacle,
} from "./pinnacles";

// Lucky Numbers
export {
  computeLuckyNumbers,
  getLuckyNumberMeaning,
  getLuckyNumberLabel,
  formatLuckyNumbersForUI,
} from "./luckyNumbers";

// Karmic Debt
export {
  computeKarmicDebt,
  getKarmicDebtMeaning,
  getKarmicDebtLabel,
  getKarmicDebtLesson,
} from "./karmicDebt";
