/**
 * Derived Birth Chart Summary
 *
 * Computes high-level astrological insights from placements:
 * - Element balance (fire/earth/air/water)
 * - Modality balance (cardinal/fixed/mutable)
 * - Dominant signs (top 3 by weighted score)
 * - Dominant planets (top 3 by weighted score)
 * - Chart ruler (traditional ruler of Ascendant)
 * - Top aspects (10 tightest by orb)
 */

import type { SwissPlacements } from "./swissEngine";
import type { AspectPlacement } from "./aspects";

// ============================================================================
// TYPES
// ============================================================================

export type DerivedSummary = {
  elementBalance: {
    fire: number;
    earth: number;
    air: number;
    water: number;
  };
  modalityBalance: {
    cardinal: number;
    fixed: number;
    mutable: number;
  };
  dominantSigns: Array<{ sign: string; score: number }>;
  dominantPlanets: Array<{ name: string; score: number }>;
  chartRuler: string;
  topAspects: AspectPlacement[];
};

// ============================================================================
// ELEMENT & MODALITY MAPPINGS
// ============================================================================

const ELEMENT_MAP: Record<string, "fire" | "earth" | "air" | "water"> = {
  Aries: "fire",
  Leo: "fire",
  Sagittarius: "fire",
  Taurus: "earth",
  Virgo: "earth",
  Capricorn: "earth",
  Gemini: "air",
  Libra: "air",
  Aquarius: "air",
  Cancer: "water",
  Scorpio: "water",
  Pisces: "water",
};

const MODALITY_MAP: Record<string, "cardinal" | "fixed" | "mutable"> = {
  Aries: "cardinal",
  Cancer: "cardinal",
  Libra: "cardinal",
  Capricorn: "cardinal",
  Taurus: "fixed",
  Leo: "fixed",
  Scorpio: "fixed",
  Aquarius: "fixed",
  Gemini: "mutable",
  Virgo: "mutable",
  Sagittarius: "mutable",
  Pisces: "mutable",
};

// ============================================================================
// TRADITIONAL CHART RULER MAPPING
// ============================================================================

const TRADITIONAL_RULER_MAP: Record<string, string> = {
  Aries: "Mars",
  Taurus: "Venus",
  Gemini: "Mercury",
  Cancer: "Moon",
  Leo: "Sun",
  Virgo: "Mercury",
  Libra: "Venus",
  Scorpio: "Mars",
  Sagittarius: "Jupiter",
  Capricorn: "Saturn",
  Aquarius: "Saturn",
  Pisces: "Jupiter",
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate element balance from planet placements
 */
function calculateElementBalance(
  placements: SwissPlacements
): DerivedSummary["elementBalance"] {
  const balance = { fire: 0, earth: 0, air: 0, water: 0 };

  for (const planet of placements.planets) {
    if (!planet.sign) continue;
    const element = ELEMENT_MAP[planet.sign];
    if (element) {
      balance[element]++;
    }
  }

  return balance;
}

/**
 * Calculate modality balance from planet placements
 */
function calculateModalityBalance(
  placements: SwissPlacements
): DerivedSummary["modalityBalance"] {
  const balance = { cardinal: 0, fixed: 0, mutable: 0 };

  for (const planet of placements.planets) {
    if (!planet.sign) continue;
    const modality = MODALITY_MAP[planet.sign];
    if (modality) {
      balance[modality]++;
    }
  }

  return balance;
}

/**
 * Get traditional chart ruler from Ascendant sign
 */
function getChartRuler(placements: SwissPlacements): string {
  const ascendantSign = placements.angles.ascendant.sign;
  return TRADITIONAL_RULER_MAP[ascendantSign] || "Unknown";
}

/**
 * Calculate dominant signs (top 3 by weighted score)
 *
 * Scoring:
 * - Base +1 for each planet in that sign (including Node + Chiron)
 * - +2 if Sun is in that sign
 * - +2 if Moon is in that sign
 * - +2 if Ascendant sign matches that sign
 * - Add aspect intensity bonus:
 *   For each aspect involving a planet in that sign:
 *     add (1 / max(orb, 0.25)) * 0.5 to that sign's score
 */
function calculateDominantSigns(
  placements: SwissPlacements
): Array<{ sign: string; score: number }> {
  const scores: Record<string, number> = {};

  // Initialize scores for all signs
  const allSigns = Object.keys(ELEMENT_MAP);
  for (const sign of allSigns) {
    scores[sign] = 0;
  }

  // Base +1 for each planet in that sign
  for (const planet of placements.planets) {
    if (!planet.sign) continue;
    scores[planet.sign] = (scores[planet.sign] || 0) + 1;
  }

  // +2 if Sun is in that sign
  const sun = placements.planets.find((p) => p.name === "Sun");
  if (sun?.sign) {
    scores[sun.sign] += 2;
  }

  // +2 if Moon is in that sign
  const moon = placements.planets.find((p) => p.name === "Moon");
  if (moon?.sign) {
    scores[moon.sign] += 2;
  }

  // +2 if Ascendant sign matches that sign
  const ascendantSign = placements.angles.ascendant.sign;
  if (ascendantSign) {
    scores[ascendantSign] = (scores[ascendantSign] || 0) + 2;
  }

  // Add aspect intensity bonus
  if (placements.aspects) {
    for (const aspect of placements.aspects) {
      const [planet1Name, planet2Name] = aspect.between;

      // Find both planets
      const planet1 = placements.planets.find((p) => p.name === planet1Name);
      const planet2 = placements.planets.find((p) => p.name === planet2Name);

      const intensityBonus = (1 / Math.max(aspect.orb, 0.25)) * 0.5;

      if (planet1?.sign) {
        scores[planet1.sign] = (scores[planet1.sign] || 0) + intensityBonus;
      }
      if (planet2?.sign) {
        scores[planet2.sign] = (scores[planet2.sign] || 0) + intensityBonus;
      }
    }
  }

  // Convert to array and sort by score descending
  const signScores = Object.entries(scores).map(([sign, score]) => ({
    sign,
    score: Math.round(score * 100) / 100, // Round to 2 decimals
  }));

  signScores.sort((a, b) => b.score - a.score);

  // Return top 3
  return signScores.slice(0, 3);
}

/**
 * Calculate dominant planets (top 3 by weighted score)
 *
 * Scoring:
 * - base = 0
 * - +2 if planet.name === "Sun"
 * - +2 if planet.name === "Moon"
 * - +2 if planet.name === chartRuler
 * - +1 if planet.house is 1/4/7/10
 * - +0.5 for each aspect involving that planet
 * - + (1 / max(orb, 0.25)) for each aspect involving that planet
 */
function calculateDominantPlanets(
  placements: SwissPlacements,
  chartRuler: string
): Array<{ name: string; score: number }> {
  const scores: Record<string, number> = {};

  for (const planet of placements.planets) {
    let score = 0;

    // +2 if Sun
    if (planet.name === "Sun") {
      score += 2;
    }

    // +2 if Moon
    if (planet.name === "Moon") {
      score += 2;
    }

    // +2 if chart ruler
    if (planet.name === chartRuler) {
      score += 2;
    }

    // +1 if in angular house (1/4/7/10)
    if (planet.house !== null && [1, 4, 7, 10].includes(planet.house)) {
      score += 1;
    }

    scores[planet.name] = score;
  }

  // Add aspect bonuses
  if (placements.aspects) {
    for (const aspect of placements.aspects) {
      const [planet1Name, planet2Name] = aspect.between;

      // +0.5 for each aspect involving that planet
      scores[planet1Name] = (scores[planet1Name] || 0) + 0.5;
      scores[planet2Name] = (scores[planet2Name] || 0) + 0.5;

      // + (1 / max(orb, 0.25)) for each aspect
      const intensityBonus = 1 / Math.max(aspect.orb, 0.25);
      scores[planet1Name] = (scores[planet1Name] || 0) + intensityBonus;
      scores[planet2Name] = (scores[planet2Name] || 0) + intensityBonus;
    }
  }

  // Convert to array and sort by score descending
  const planetScores = Object.entries(scores).map(([name, score]) => ({
    name,
    score: Math.round(score * 100) / 100, // Round to 2 decimals
  }));

  planetScores.sort((a, b) => b.score - a.score);

  // Return top 3
  return planetScores.slice(0, 3);
}

/**
 * Get top 10 tightest aspects sorted by orb ascending
 */
function getTopAspects(placements: SwissPlacements): AspectPlacement[] {
  if (!placements.aspects || placements.aspects.length === 0) {
    return [];
  }

  // Sort by orb ascending
  const sorted = [...placements.aspects].sort((a, b) => a.orb - b.orb);

  // Return first 10
  return sorted.slice(0, 10);
}

// ============================================================================
// MAIN COMPUTE FUNCTION
// ============================================================================

/**
 * Compute derived summary from birth chart placements
 *
 * @param placements - Swiss Ephemeris placements (planets, houses, angles, aspects)
 * @returns Derived summary with element/modality balance, dominant signs/planets, chart ruler, and top aspects
 */
export function computeDerived(placements: SwissPlacements): DerivedSummary {
  const chartRuler = getChartRuler(placements);

  return {
    elementBalance: calculateElementBalance(placements),
    modalityBalance: calculateModalityBalance(placements),
    dominantSigns: calculateDominantSigns(placements),
    dominantPlanets: calculateDominantPlanets(placements, chartRuler),
    chartRuler,
    topAspects: getTopAspects(placements),
  };
}
