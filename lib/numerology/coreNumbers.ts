/**
 * Core Numbers Calculations
 *
 * Computes the six core numerology numbers:
 * - Life Path: From birth date (most important)
 * - Birthday: From day of birth
 * - Expression: From full birth name
 * - Soul Urge: From vowels in birth name
 * - Personality: From consonants in birth name
 * - Maturity: Life Path + Expression
 *
 * Test Case (Ayren): Aaron Dean Burlar, DOB 1992-05-04
 * Expected Pythagorean: Life Path 3, Birthday 4, Expression 1,
 *                       Soul Urge 9, Personality 1, Maturity 4
 */

import type { NumerologySystem, CoreNumbers, NumerologyNumber } from "@/types/numerology";
import {
  reduceToSingleDigit,
  reduceWithMaster,
  nameToNumber,
  vowelsToNumber,
  consonantsToNumber,
  getFullBirthName,
  parseDate,
  dateToLifePathSum,
} from "./utils";

// ============================================================================
// LIFE PATH NUMBER
// ============================================================================

/**
 * Calculate Life Path Number from birth date
 *
 * The Life Path is the most important number in numerology.
 * It's calculated by reducing each date component separately,
 * then summing and reducing again.
 *
 * Method:
 * 1. Reduce month to single digit
 * 2. Reduce day to single digit
 * 3. Reduce year to single digit
 * 4. Sum all three and reduce (preserving master numbers)
 *
 * @param birthDate - ISO date string "YYYY-MM-DD"
 * @returns NumerologyNumber with Life Path value
 *
 * @example
 * // 1992-05-04: Month=5, Day=4, Year=3 (1+9+9+2=21->3)
 * // Total: 5+4+3=12 -> 1+2=3
 * calculateLifePath("1992-05-04") // { value: 3 }
 */
export function calculateLifePath(birthDate: string): NumerologyNumber {
  const sum = dateToLifePathSum(birthDate);
  return reduceWithMaster(sum);
}

// ============================================================================
// BIRTHDAY NUMBER
// ============================================================================

/**
 * Calculate Birthday Number from day of birth
 *
 * The Birthday number represents natural talents and abilities.
 * It's simply the day of birth, reduced if greater than 9.
 *
 * @param birthDate - ISO date string "YYYY-MM-DD"
 * @returns NumerologyNumber with Birthday value
 *
 * @example
 * calculateBirthday("1992-05-04") // { value: 4 }
 * calculateBirthday("1992-05-22") // { value: 22 } (master number)
 * calculateBirthday("1992-05-29") // { value: 11 } (2+9=11, master)
 */
export function calculateBirthday(birthDate: string): NumerologyNumber {
  const { day } = parseDate(birthDate);
  return reduceWithMaster(day);
}

// ============================================================================
// EXPRESSION NUMBER (DESTINY)
// ============================================================================

/**
 * Calculate Expression Number from full birth name
 *
 * The Expression number (also called Destiny) represents natural abilities,
 * personal goals, and what you're meant to accomplish in life.
 * It's calculated from ALL letters in the full birth name.
 *
 * @param firstName - Legal first name at birth
 * @param middleName - Legal middle name(s) at birth (optional)
 * @param lastName - Legal last name at birth
 * @param system - Numerology system (pythagorean or chaldean)
 * @returns NumerologyNumber with Expression value
 *
 * @example
 * // Pythagorean: AARON(22) + DEAN(15) + BURLAR(27) = 64 -> 10 -> 1
 * calculateExpression("Aaron", "Dean", "Burlar", "pythagorean") // { value: 1 }
 */
export function calculateExpression(
  firstName: string,
  middleName: string | undefined,
  lastName: string,
  system: NumerologySystem
): NumerologyNumber {
  const fullName = getFullBirthName(firstName, middleName, lastName);
  const sum = nameToNumber(fullName, system);
  return reduceWithMaster(sum);
}

// ============================================================================
// SOUL URGE NUMBER (HEART'S DESIRE)
// ============================================================================

/**
 * Calculate Soul Urge Number from vowels in birth name
 *
 * The Soul Urge (also called Heart's Desire) represents inner motivations,
 * what truly drives you, and your deepest desires.
 * It's calculated from ONLY the vowels (A, E, I, O, U) in the full birth name.
 *
 * @param firstName - Legal first name at birth
 * @param middleName - Legal middle name(s) at birth (optional)
 * @param lastName - Legal last name at birth
 * @param system - Numerology system
 * @returns NumerologyNumber with Soul Urge value
 *
 * @example
 * // Pythagorean vowels: AAO(8) + EA(6) + UA(4) = 18 -> 9
 * calculateSoulUrge("Aaron", "Dean", "Burlar", "pythagorean") // { value: 9 }
 */
export function calculateSoulUrge(
  firstName: string,
  middleName: string | undefined,
  lastName: string,
  system: NumerologySystem
): NumerologyNumber {
  const fullName = getFullBirthName(firstName, middleName, lastName);
  const sum = vowelsToNumber(fullName, system);
  return reduceWithMaster(sum);
}

// ============================================================================
// PERSONALITY NUMBER
// ============================================================================

/**
 * Calculate Personality Number from consonants in birth name
 *
 * The Personality number represents how others perceive you,
 * your outer personality and the face you show the world.
 * It's calculated from ONLY the consonants in the full birth name.
 *
 * @param firstName - Legal first name at birth
 * @param middleName - Legal middle name(s) at birth (optional)
 * @param lastName - Legal last name at birth
 * @param system - Numerology system
 * @returns NumerologyNumber with Personality value
 *
 * @example
 * // Pythagorean consonants: RN(14) + DN(9) + BRLR(23) = 46 -> 10 -> 1
 * calculatePersonality("Aaron", "Dean", "Burlar", "pythagorean") // { value: 1 }
 */
export function calculatePersonality(
  firstName: string,
  middleName: string | undefined,
  lastName: string,
  system: NumerologySystem
): NumerologyNumber {
  const fullName = getFullBirthName(firstName, middleName, lastName);
  const sum = consonantsToNumber(fullName, system);
  return reduceWithMaster(sum);
}

// ============================================================================
// MATURITY NUMBER
// ============================================================================

/**
 * Calculate Maturity Number from Life Path + Expression
 *
 * The Maturity number represents who you're becoming and typically
 * becomes more prominent around age 35-40. It's the sum of
 * Life Path and Expression numbers, reduced.
 *
 * @param lifePath - Already calculated Life Path number
 * @param expression - Already calculated Expression number
 * @returns NumerologyNumber with Maturity value
 *
 * @example
 * // Life Path 3 + Expression 1 = 4
 * calculateMaturity({ value: 3 }, { value: 1 }) // { value: 4 }
 */
export function calculateMaturity(
  lifePath: NumerologyNumber,
  expression: NumerologyNumber
): NumerologyNumber {
  const sum = lifePath.value + expression.value;
  return reduceWithMaster(sum);
}

// ============================================================================
// COMPUTE ALL CORE NUMBERS
// ============================================================================

/**
 * Input for computing all core numbers
 */
export interface CoreNumbersInput {
  birthDate: string;
  birthFirstName: string;
  birthMiddleName?: string;
  birthLastName: string;
  system: NumerologySystem;
}

/**
 * Compute all six core numerology numbers
 *
 * @param input - Birth date and full legal birth name
 * @returns CoreNumbers object with all six numbers
 *
 * @example
 * const core = computeCoreNumbers({
 *   birthDate: "1992-05-04",
 *   birthFirstName: "Aaron",
 *   birthMiddleName: "Dean",
 *   birthLastName: "Burlar",
 *   system: "pythagorean"
 * });
 * // core.lifePath.value === 3
 * // core.birthday.value === 4
 * // core.expression.value === 1
 * // core.soulUrge.value === 9
 * // core.personality.value === 1
 * // core.maturity.value === 4
 */
export function computeCoreNumbers(input: CoreNumbersInput): CoreNumbers {
  const { birthDate, birthFirstName, birthMiddleName, birthLastName, system } = input;

  // Calculate each core number
  const lifePath = calculateLifePath(birthDate);
  const birthday = calculateBirthday(birthDate);
  const expression = calculateExpression(birthFirstName, birthMiddleName, birthLastName, system);
  const soulUrge = calculateSoulUrge(birthFirstName, birthMiddleName, birthLastName, system);
  const personality = calculatePersonality(
    birthFirstName,
    birthMiddleName,
    birthLastName,
    system
  );
  const maturity = calculateMaturity(lifePath, expression);

  return {
    lifePath,
    birthday,
    expression,
    soulUrge,
    personality,
    maturity,
  };
}
