/**
 * Karmic Debt Detection
 *
 * Karmic Debt numbers (13, 14, 16, 19) appear in the intermediate
 * calculations before final reduction and indicate karmic lessons
 * that need to be addressed in this lifetime.
 *
 * These are found in:
 * - Life Path (before final reduction)
 * - Expression (before final reduction)
 * - Soul Urge (before final reduction)
 * - Personality (before final reduction)
 * - Birthday (day of birth)
 */

import type {
  KarmicDebt,
  KarmicDebtNumber,
  NumerologySystem,
  CoreNumbers,
} from "@/types/numerology";
import { isKarmicDebtNumber } from "./constants";
import {
  parseDate,
  nameToNumber,
  vowelsToNumber,
  consonantsToNumber,
  getFullBirthName,
  sumDigits,
} from "./utils";

// ============================================================================
// KARMIC DEBT DETECTION
// ============================================================================

type KarmicSource = "lifePath" | "expression" | "soulUrge" | "personality" | "birthday";

interface KarmicDebtEntry {
  number: KarmicDebtNumber;
  source: KarmicSource;
}

/**
 * Check if a number or its intermediate sum is a karmic debt number
 *
 * @param n - Number to check (can be multi-digit)
 * @returns Karmic debt number if found, undefined otherwise
 */
function findKarmicDebt(n: number): KarmicDebtNumber | undefined {
  // Check the number itself
  if (isKarmicDebtNumber(n)) {
    return n as KarmicDebtNumber;
  }

  // For larger numbers, check if it reduces through a karmic debt
  // e.g., 31 -> 3+1=4, but also 13 -> 1+3=4 (karmic debt 13)
  // We need to check intermediate sums during reduction
  while (n > 31) {
    // 31 is max that can reduce to karmic debt
    n = sumDigits(n);
    if (isKarmicDebtNumber(n)) {
      return n as KarmicDebtNumber;
    }
  }

  return undefined;
}

/**
 * Get the intermediate sum for Life Path calculation
 * (before final reduction to single digit)
 */
function getLifePathIntermediate(birthDate: string): number {
  const { year, month, day } = parseDate(birthDate);

  // Reduce each component separately
  let monthReduced = month;
  while (monthReduced > 9) monthReduced = sumDigits(monthReduced);

  let dayReduced = day;
  while (dayReduced > 9) dayReduced = sumDigits(dayReduced);

  let yearReduced = year;
  while (yearReduced > 9) yearReduced = sumDigits(yearReduced);

  return monthReduced + dayReduced + yearReduced;
}

/**
 * Compute karmic debt from birth data
 *
 * @param birthDate - ISO date string "YYYY-MM-DD"
 * @param birthFirstName - Legal first name at birth
 * @param birthMiddleName - Legal middle name(s) at birth (optional)
 * @param birthLastName - Legal last name at birth
 * @param system - Numerology system
 * @returns KarmicDebt object with found karmic debts
 */
export function computeKarmicDebt(
  birthDate: string,
  birthFirstName: string,
  birthMiddleName: string | undefined,
  birthLastName: string,
  system: NumerologySystem
): KarmicDebt {
  const entries: KarmicDebtEntry[] = [];
  const fullName = getFullBirthName(birthFirstName, birthMiddleName, birthLastName);

  // Check Life Path intermediate
  const lifePathIntermediate = getLifePathIntermediate(birthDate);
  const lifePathKarmic = findKarmicDebt(lifePathIntermediate);
  if (lifePathKarmic) {
    entries.push({ number: lifePathKarmic, source: "lifePath" });
  }

  // Check Expression (full name sum)
  const expressionSum = nameToNumber(fullName, system);
  const expressionKarmic = findKarmicDebt(expressionSum);
  if (expressionKarmic) {
    entries.push({ number: expressionKarmic, source: "expression" });
  }

  // Check Soul Urge (vowels sum)
  const soulUrgeSum = vowelsToNumber(fullName, system);
  const soulUrgeKarmic = findKarmicDebt(soulUrgeSum);
  if (soulUrgeKarmic) {
    entries.push({ number: soulUrgeKarmic, source: "soulUrge" });
  }

  // Check Personality (consonants sum)
  const personalitySum = consonantsToNumber(fullName, system);
  const personalityKarmic = findKarmicDebt(personalitySum);
  if (personalityKarmic) {
    entries.push({ number: personalityKarmic, source: "personality" });
  }

  // Check Birthday (day of birth)
  const { day } = parseDate(birthDate);
  if (isKarmicDebtNumber(day)) {
    entries.push({ number: day as KarmicDebtNumber, source: "birthday" });
  }

  // Deduplicate numbers (but keep all sources)
  const uniqueNumbers = [...new Set(entries.map((e) => e.number))];

  return {
    hasKarmicDebt: entries.length > 0,
    numbers: uniqueNumbers,
    sources: entries,
  };
}

// ============================================================================
// KARMIC DEBT MEANINGS
// ============================================================================

/**
 * Get the meaning of a karmic debt number
 */
export function getKarmicDebtMeaning(number: KarmicDebtNumber): string {
  const meanings: Record<KarmicDebtNumber, string> = {
    13: "Learning perseverance and focus. Past laziness or taking shortcuts requires extra effort to build solid foundations.",
    14: "Learning moderation and commitment. Past abuse of freedom requires developing self-control and responsibility.",
    16: "Learning humility and authentic connection. Past ego-driven actions require rebuilding trust and integrity.",
    19: "Learning independence with compassion. Past selfishness requires balancing personal power with service to others.",
  };
  return meanings[number];
}

/**
 * Get a brief label for a karmic debt number
 */
export function getKarmicDebtLabel(number: KarmicDebtNumber): string {
  const labels: Record<KarmicDebtNumber, string> = {
    13: "Perseverance",
    14: "Moderation",
    16: "Humility",
    19: "Independence",
  };
  return labels[number];
}

/**
 * Get the lesson associated with a karmic debt
 */
export function getKarmicDebtLesson(number: KarmicDebtNumber): string {
  const lessons: Record<KarmicDebtNumber, string> = {
    13: "Build through steady, honest work rather than shortcuts",
    14: "Embrace healthy boundaries while honoring commitments",
    16: "Cultivate genuine humility and rebuild from within",
    19: "Balance self-reliance with openness to others",
  };
  return lessons[number];
}
