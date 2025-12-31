/**
 * Pinnacles and Challenges Calculations
 *
 * Pinnacles represent four major life periods with specific themes.
 * Challenges represent obstacles to overcome in each period.
 *
 * Test Case (Ayren): DOB 1992-05-04, Life Path 3
 * Expected Pinnacles: 9, 7, 7, 8
 * Expected Challenges: 1, 1, 0, 2
 *
 * Pinnacle Age Ranges (Life Path 3):
 * - First: 0 to 33 (36 - 3)
 * - Second: 33 to 42 (+9)
 * - Third: 42 to 51 (+9)
 * - Fourth: 51 onward
 */

import type { Pinnacles, Challenges } from "@/types/numerology";
import { reduceToSingleDigit, parseDate } from "./utils";

// ============================================================================
// PINNACLE CALCULATIONS
// ============================================================================

/**
 * Calculate the first pinnacle number
 * Formula: Month + Day, reduced
 *
 * @param month - Birth month (1-12)
 * @param day - Birth day (1-31)
 * @returns First pinnacle number
 */
function calculateFirstPinnacle(month: number, day: number): number {
  return reduceToSingleDigit(month + day, false);
}

/**
 * Calculate the second pinnacle number
 * Formula: Day + Year (reduced), reduced
 *
 * @param day - Birth day (1-31)
 * @param yearReduced - Birth year reduced to single digit
 * @returns Second pinnacle number
 */
function calculateSecondPinnacle(day: number, yearReduced: number): number {
  return reduceToSingleDigit(day + yearReduced, false);
}

/**
 * Calculate the third pinnacle number
 * Formula: First + Second pinnacle, reduced
 *
 * @param first - First pinnacle number
 * @param second - Second pinnacle number
 * @returns Third pinnacle number
 */
function calculateThirdPinnacle(first: number, second: number): number {
  return reduceToSingleDigit(first + second, false);
}

/**
 * Calculate the fourth pinnacle number
 * Formula: Month + Year (reduced), reduced
 *
 * @param month - Birth month (1-12)
 * @param yearReduced - Birth year reduced to single digit
 * @returns Fourth pinnacle number
 */
function calculateFourthPinnacle(month: number, yearReduced: number): number {
  return reduceToSingleDigit(month + yearReduced, false);
}

// ============================================================================
// CHALLENGE CALCULATIONS
// ============================================================================

/**
 * Calculate the first challenge number
 * Formula: |Month - Day|
 *
 * @param month - Birth month (1-12)
 * @param day - Birth day (1-31)
 * @returns First challenge number
 */
function calculateFirstChallenge(month: number, day: number): number {
  const monthReduced = reduceToSingleDigit(month, false);
  const dayReduced = reduceToSingleDigit(day, false);
  return Math.abs(monthReduced - dayReduced);
}

/**
 * Calculate the second challenge number
 * Formula: |Day - Year (reduced)|
 *
 * @param day - Birth day (1-31)
 * @param yearReduced - Birth year reduced to single digit
 * @returns Second challenge number
 */
function calculateSecondChallenge(day: number, yearReduced: number): number {
  const dayReduced = reduceToSingleDigit(day, false);
  return Math.abs(dayReduced - yearReduced);
}

/**
 * Calculate the third challenge number
 * Formula: |First - Second challenge|
 *
 * @param first - First challenge number
 * @param second - Second challenge number
 * @returns Third challenge number (can be 0)
 */
function calculateThirdChallenge(first: number, second: number): number {
  return Math.abs(first - second);
}

/**
 * Calculate the fourth (main) challenge number
 * Formula: |Month - Year (reduced)|
 *
 * @param month - Birth month (1-12)
 * @param yearReduced - Birth year reduced to single digit
 * @returns Fourth challenge number
 */
function calculateFourthChallenge(month: number, yearReduced: number): number {
  const monthReduced = reduceToSingleDigit(month, false);
  return Math.abs(monthReduced - yearReduced);
}

// ============================================================================
// PINNACLE AGE RANGES
// ============================================================================

/**
 * Calculate the end age for each pinnacle based on Life Path
 *
 * The first pinnacle ends at: 36 - Life Path
 * Each subsequent pinnacle lasts 9 years
 *
 * @param lifePathNumber - The Life Path number (1-9, 11, 22, 33)
 * @returns Object with end ages for first three pinnacles
 */
function calculatePinnacleAges(lifePathNumber: number): {
  first: number;
  second: number;
  third: number;
} {
  // Use the reduced value for master numbers in age calculation
  const lp = lifePathNumber > 9 ? reduceToSingleDigit(lifePathNumber, false) : lifePathNumber;

  const firstEnd = 36 - lp;
  const secondEnd = firstEnd + 9;
  const thirdEnd = secondEnd + 9;

  return {
    first: firstEnd,
    second: secondEnd,
    third: thirdEnd,
  };
}

// ============================================================================
// COMPUTE PINNACLES
// ============================================================================

/**
 * Compute all four pinnacles with their age ranges
 *
 * @param birthDate - ISO date string "YYYY-MM-DD"
 * @param lifePathNumber - Pre-calculated Life Path number
 * @returns Pinnacles object with numbers and age ranges
 *
 * @example
 * // DOB: 1992-05-04, Life Path: 3
 * // Month=5, Day=4, Year=3
 * // P1: 5+4=9, P2: 4+3=7, P3: 9+7=16->7, P4: 5+3=8
 * // Ages: 33, 42, 51
 */
export function computePinnacles(birthDate: string, lifePathNumber: number): Pinnacles {
  const { year, month, day } = parseDate(birthDate);
  const yearReduced = reduceToSingleDigit(year, false);

  // Calculate pinnacle numbers
  const first = calculateFirstPinnacle(month, day);
  const second = calculateSecondPinnacle(day, yearReduced);
  const third = calculateThirdPinnacle(first, second);
  const fourth = calculateFourthPinnacle(month, yearReduced);

  // Calculate age ranges
  const ages = calculatePinnacleAges(lifePathNumber);

  return {
    first: {
      number: first,
      startAge: 0,
      endAge: ages.first,
    },
    second: {
      number: second,
      startAge: ages.first,
      endAge: ages.second,
    },
    third: {
      number: third,
      startAge: ages.second,
      endAge: ages.third,
    },
    fourth: {
      number: fourth,
      startAge: ages.third,
      endAge: null,
    },
  };
}

// ============================================================================
// COMPUTE CHALLENGES
// ============================================================================

/**
 * Compute all four challenge numbers
 *
 * @param birthDate - ISO date string "YYYY-MM-DD"
 * @returns Challenges object with four challenge numbers
 *
 * @example
 * // DOB: 1992-05-04
 * // Month=5, Day=4, Year=3
 * // C1: |5-4|=1, C2: |4-3|=1, C3: |1-1|=0, C4: |5-3|=2
 */
export function computeChallenges(birthDate: string): Challenges {
  const { year, month, day } = parseDate(birthDate);
  const yearReduced = reduceToSingleDigit(year, false);

  const first = calculateFirstChallenge(month, day);
  const second = calculateSecondChallenge(day, yearReduced);
  const third = calculateThirdChallenge(first, second);
  const fourth = calculateFourthChallenge(month, yearReduced);

  return {
    first,
    second,
    third,
    fourth,
  };
}

// ============================================================================
// PINNACLE/CHALLENGE MEANINGS
// ============================================================================

/**
 * Get the meaning for a pinnacle number
 */
export function getPinnacleMeaning(number: number): string {
  const meanings: Record<number, string> = {
    1: "Independence, leadership, and pioneering new paths",
    2: "Cooperation, relationships, and emotional sensitivity",
    3: "Creative expression, communication, and joy",
    4: "Building, structure, and laying solid foundations",
    5: "Change, freedom, and new experiences",
    6: "Family, responsibility, and nurturing others",
    7: "Introspection, spiritual growth, and wisdom",
    8: "Material achievement, power, and recognition",
    9: "Humanitarian service, completion, and wisdom",
  };
  return meanings[number] || "Universal lessons";
}

/**
 * Get the meaning for a challenge number
 */
export function getChallengeMeaning(number: number): string {
  const meanings: Record<number, string> = {
    0: "Choice of all challenges - freedom to choose your path",
    1: "Learning independence while avoiding domination",
    2: "Balancing sensitivity with strength",
    3: "Expressing yourself without scattering energy",
    4: "Building discipline without becoming rigid",
    5: "Embracing change without recklessness",
    6: "Giving without martyrdom or interference",
    7: "Trusting intuition while staying grounded",
    8: "Using power responsibly without materialism",
  };
  return meanings[number] || "Personal growth through challenges";
}

/**
 * Get the current pinnacle based on age
 */
export function getCurrentPinnacle(
  pinnacles: Pinnacles,
  currentAge: number
): { number: number; period: "first" | "second" | "third" | "fourth" } {
  if (currentAge < pinnacles.first.endAge) {
    return { number: pinnacles.first.number, period: "first" };
  } else if (currentAge < pinnacles.second.endAge) {
    return { number: pinnacles.second.number, period: "second" };
  } else if (currentAge < pinnacles.third.endAge) {
    return { number: pinnacles.third.number, period: "third" };
  } else {
    return { number: pinnacles.fourth.number, period: "fourth" };
  }
}
