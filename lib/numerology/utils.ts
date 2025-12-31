/**
 * Numerology Utility Functions
 *
 * Core utilities for digit reduction, name-to-number conversion,
 * and date parsing used throughout the numerology engine.
 */

import type { NumerologySystem, NumerologyNumber, MasterNumber } from "@/types/numerology";
import {
  getLetterValues,
  isMasterNumber,
  isVowel,
  isConsonant,
  VOWELS,
  CONSONANTS,
} from "./constants";

// ============================================================================
// DIGIT REDUCTION
// ============================================================================

/**
 * Reduce a number to a single digit (1-9) or master number (11, 22, 33)
 *
 * Algorithm:
 * 1. If the number is a master number (11, 22, 33), preserve it
 * 2. Otherwise, sum all digits and repeat until single digit
 *
 * @param n - The number to reduce
 * @param preserveMaster - Whether to preserve master numbers (default: true)
 * @returns The reduced number
 *
 * @example
 * reduceToSingleDigit(29) // 2 + 9 = 11 (master, preserved)
 * reduceToSingleDigit(38) // 3 + 8 = 11 (master, preserved)
 * reduceToSingleDigit(47) // 4 + 7 = 11 (master, preserved)
 * reduceToSingleDigit(28) // 2 + 8 = 10 -> 1 + 0 = 1
 * reduceToSingleDigit(11, false) // 1 + 1 = 2 (master NOT preserved)
 */
export function reduceToSingleDigit(n: number, preserveMaster: boolean = true): number {
  // Handle negative numbers
  n = Math.abs(n);

  while (n > 9) {
    // Check for master numbers before reducing
    if (preserveMaster && isMasterNumber(n)) {
      return n;
    }

    // Sum the digits
    let sum = 0;
    while (n > 0) {
      sum += n % 10;
      n = Math.floor(n / 10);
    }
    n = sum;
  }

  return n;
}

/**
 * Reduce a number and track if it was a master number
 * Returns both the final value and the original master number if applicable
 *
 * @param n - The number to reduce
 * @returns NumerologyNumber with value and optional master
 *
 * @example
 * reduceWithMaster(29) // { value: 11, master: undefined } (11 is preserved)
 * reduceWithMaster(47) // { value: 11, master: undefined }
 * reduceWithMaster(65) // { value: 2, master: 11 } (65->11->2, shows 11 was passed through)
 */
export function reduceWithMaster(n: number): NumerologyNumber {
  n = Math.abs(n);

  // Track if we pass through a master number during reduction
  let encounteredMaster: MasterNumber | undefined;

  while (n > 9) {
    // Check for master numbers
    if (isMasterNumber(n)) {
      // This IS a master number - preserve it as the final value
      return { value: n };
    }

    // Sum the digits
    let sum = 0;
    let temp = n;
    while (temp > 0) {
      sum += temp % 10;
      temp = Math.floor(temp / 10);
    }

    // Check if the sum is a master number
    if (isMasterNumber(sum)) {
      encounteredMaster = sum as MasterNumber;
    }

    n = sum;
  }

  // If we ended at a master number, it's preserved in value
  if (isMasterNumber(n)) {
    return { value: n };
  }

  // Return with master if we passed through one
  return encounteredMaster ? { value: n, master: encounteredMaster } : { value: n };
}

/**
 * Sum the digits of a number without reducing to single digit
 * Useful for intermediate calculations
 *
 * @param n - The number to sum digits of
 * @returns Sum of all digits
 *
 * @example
 * sumDigits(1992) // 1 + 9 + 9 + 2 = 21
 * sumDigits(123) // 1 + 2 + 3 = 6
 */
export function sumDigits(n: number): number {
  n = Math.abs(n);
  let sum = 0;
  while (n > 0) {
    sum += n % 10;
    n = Math.floor(n / 10);
  }
  return sum;
}

// ============================================================================
// NAME CONVERSION
// ============================================================================

/**
 * Convert a name to its numerological value
 *
 * @param name - The name to convert (any case)
 * @param system - Which numerology system to use
 * @returns Sum of all letter values (not reduced)
 *
 * @example
 * // Pythagorean: A=1, A=1, R=9, O=6, N=5 = 22
 * nameToNumber("Aaron", "pythagorean") // 22
 */
export function nameToNumber(name: string, system: NumerologySystem): number {
  const values = getLetterValues(system);
  let sum = 0;

  for (const char of name.toUpperCase()) {
    if (values[char] !== undefined) {
      sum += values[char];
    }
    // Non-letters (spaces, hyphens, etc.) are ignored
  }

  return sum;
}

/**
 * Convert only the vowels in a name to a number (for Soul Urge)
 *
 * @param name - The name to convert
 * @param system - Which numerology system to use
 * @returns Sum of vowel values only (not reduced)
 */
export function vowelsToNumber(name: string, system: NumerologySystem): number {
  const values = getLetterValues(system);
  let sum = 0;

  for (const char of name.toUpperCase()) {
    if (isVowel(char) && values[char] !== undefined) {
      sum += values[char];
    }
  }

  return sum;
}

/**
 * Convert only the consonants in a name to a number (for Personality)
 *
 * @param name - The name to convert
 * @param system - Which numerology system to use
 * @returns Sum of consonant values only (not reduced)
 */
export function consonantsToNumber(name: string, system: NumerologySystem): number {
  const values = getLetterValues(system);
  let sum = 0;

  for (const char of name.toUpperCase()) {
    if (isConsonant(char) && values[char] !== undefined) {
      sum += values[char];
    }
  }

  return sum;
}

/**
 * Get the full birth name string from parts
 *
 * @param firstName - First name
 * @param middleName - Middle name (optional)
 * @param lastName - Last name
 * @returns Combined name with spaces
 */
export function getFullBirthName(
  firstName: string,
  middleName: string | undefined,
  lastName: string
): string {
  const parts = [firstName];
  if (middleName && middleName.trim()) {
    parts.push(middleName.trim());
  }
  parts.push(lastName);
  return parts.join(" ");
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Parse an ISO date string into year, month, day
 *
 * @param dateStr - ISO date string "YYYY-MM-DD"
 * @returns Object with year, month, day as numbers
 */
export function parseDate(dateStr: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateStr.split("-").map(Number);
  return { year, month, day };
}

/**
 * Get the sum of a date's components (for Life Path)
 * Reduces each component (month, day, year) separately first
 *
 * @param dateStr - ISO date string "YYYY-MM-DD"
 * @returns Sum of reduced month + reduced day + reduced year
 *
 * @example
 * // May 4, 1992:
 * // Month: 5 (already single digit)
 * // Day: 4 (already single digit)
 * // Year: 1+9+9+2 = 21 -> 2+1 = 3
 * // Total: 5 + 4 + 3 = 12 -> 1+2 = 3
 * dateToLifePathSum("1992-05-04") // Returns 12 (before final reduction)
 */
export function dateToLifePathSum(dateStr: string): number {
  const { year, month, day } = parseDate(dateStr);

  // Reduce each component separately (standard Life Path method)
  const reducedMonth = reduceToSingleDigit(month, false);
  const reducedDay = reduceToSingleDigit(day, false);
  const reducedYear = reduceToSingleDigit(year, false);

  return reducedMonth + reducedDay + reducedYear;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that a name contains at least one letter
 */
export function isValidName(name: string): boolean {
  if (!name || typeof name !== "string") return false;
  return /[A-Za-z]/.test(name);
}

/**
 * Validate an ISO date string format
 */
export function isValidDateString(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== "string") return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;

  const { year, month, day } = parseDate(dateStr);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  );
}
