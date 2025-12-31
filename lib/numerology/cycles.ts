/**
 * Cycle Numbers Calculations
 *
 * Computes the personal cycles based on current date:
 * - Personal Year: 9-year cycle of growth
 * - Personal Month: Monthly energy within the year
 * - Personal Day: Daily energy within the month
 *
 * These are dynamic numbers that change with time, unlike
 * the core numbers which are fixed at birth.
 */

import type { CycleNumbers, CycleInput } from "@/types/numerology";
import { reduceToSingleDigit, parseDate } from "./utils";

// ============================================================================
// PERSONAL YEAR
// ============================================================================

/**
 * Calculate Personal Year Number
 *
 * The Personal Year represents the overall theme and energy for the year.
 * It's calculated as: birth month + birth day + current year, reduced.
 *
 * The 9-year cycle:
 * 1: New beginnings, fresh starts
 * 2: Partnerships, patience
 * 3: Creativity, self-expression
 * 4: Building foundations, hard work
 * 5: Change, freedom, adventure
 * 6: Responsibility, family, home
 * 7: Reflection, spirituality, rest
 * 8: Achievement, power, material success
 * 9: Completion, letting go, endings
 *
 * @param birthDate - ISO date string "YYYY-MM-DD"
 * @param currentYear - Current calendar year
 * @returns Personal Year number (1-9)
 *
 * @example
 * // Birth: May 4 (5 + 4 = 9), Year: 2024 (2+0+2+4=8)
 * // Total: 9 + 8 = 17 -> 1+7 = 8
 * calculatePersonalYear("1992-05-04", 2024) // 8
 */
export function calculatePersonalYear(birthDate: string, currentYear: number): number {
  const { month, day } = parseDate(birthDate);

  // Reduce each component
  const reducedMonth = reduceToSingleDigit(month, false);
  const reducedDay = reduceToSingleDigit(day, false);
  const reducedYear = reduceToSingleDigit(currentYear, false);

  // Sum and reduce (don't preserve master numbers for cycles)
  const sum = reducedMonth + reducedDay + reducedYear;
  return reduceToSingleDigit(sum, false);
}

// ============================================================================
// PERSONAL MONTH
// ============================================================================

/**
 * Calculate Personal Month Number
 *
 * The Personal Month represents the monthly energy within the Personal Year.
 * It's calculated as: Personal Year + current calendar month, reduced.
 *
 * @param personalYear - Already calculated Personal Year
 * @param currentMonth - Current calendar month (1-12)
 * @returns Personal Month number (1-9)
 *
 * @example
 * // Personal Year 8, Current Month December (12)
 * // 8 + 12 = 20 -> 2+0 = 2
 * calculatePersonalMonth(8, 12) // 2
 */
export function calculatePersonalMonth(personalYear: number, currentMonth: number): number {
  const sum = personalYear + currentMonth;
  return reduceToSingleDigit(sum, false);
}

// ============================================================================
// PERSONAL DAY
// ============================================================================

/**
 * Calculate Personal Day Number
 *
 * The Personal Day represents the daily energy within the Personal Month.
 * It's calculated as: Personal Month + current calendar day, reduced.
 *
 * @param personalMonth - Already calculated Personal Month
 * @param currentDay - Current calendar day (1-31)
 * @returns Personal Day number (1-9)
 *
 * @example
 * // Personal Month 2, Current Day 31
 * // 2 + 31 = 33 -> 3+3 = 6
 * calculatePersonalDay(2, 31) // 6
 */
export function calculatePersonalDay(personalMonth: number, currentDay: number): number {
  const sum = personalMonth + currentDay;
  return reduceToSingleDigit(sum, false);
}

// ============================================================================
// COMPUTE ALL CYCLES
// ============================================================================

/**
 * Compute all cycle numbers for a given date
 *
 * @param input - Birth date and current date
 * @returns CycleNumbers object with year, month, and day
 *
 * @example
 * const cycles = computeCycles({
 *   birthDate: "1992-05-04",
 *   currentDate: "2024-12-31",
 *   lifePathNumber: 3 // Not used for cycles, but included for consistency
 * });
 * // cycles.personalYear, cycles.personalMonth, cycles.personalDay
 */
export function computeCycles(input: CycleInput): CycleNumbers {
  const { birthDate, currentDate } = input;
  const { year: currentYear, month: currentMonth, day: currentDay } = parseDate(currentDate);

  const personalYear = calculatePersonalYear(birthDate, currentYear);
  const personalMonth = calculatePersonalMonth(personalYear, currentMonth);
  const personalDay = calculatePersonalDay(personalMonth, currentDay);

  return {
    personalYear,
    personalMonth,
    personalDay,
  };
}

// ============================================================================
// CYCLE MEANINGS (for UI display)
// ============================================================================

/**
 * Get the meaning/theme for a Personal Year number
 */
export function getPersonalYearMeaning(year: number): string {
  const meanings: Record<number, string> = {
    1: "New beginnings, independence, and fresh starts",
    2: "Partnerships, patience, and diplomacy",
    3: "Creativity, self-expression, and social connections",
    4: "Building foundations, discipline, and hard work",
    5: "Change, freedom, and adventure",
    6: "Responsibility, family, and domestic matters",
    7: "Reflection, spirituality, and inner growth",
    8: "Achievement, power, and material success",
    9: "Completion, release, and transformation",
  };
  return meanings[year] || "Unknown cycle";
}

/**
 * Get brief keyword for Personal Year
 */
export function getPersonalYearKeyword(year: number): string {
  const keywords: Record<number, string> = {
    1: "New Beginnings",
    2: "Partnerships",
    3: "Creativity",
    4: "Foundation",
    5: "Change",
    6: "Responsibility",
    7: "Reflection",
    8: "Achievement",
    9: "Completion",
  };
  return keywords[year] || "Unknown";
}
