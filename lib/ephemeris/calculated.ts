/**
 * Calculated Birth Chart Features
 *
 * Computes additional astrological points and patterns derived from raw placements:
 * - South Node (opposite of North Node)
 * - Chart type (day/night sect)
 * - Part of Fortune
 * - Stelliums and emphasis
 * - Aspect patterns
 *
 * These are deterministic calculations that don't require Swiss Ephemeris calls.
 */

import type { SwissPlacements } from "./swissEngine";

// ============================================================================
// TYPES
// ============================================================================

export type CalculatedNode = {
  longitude: number; // Ecliptic longitude in degrees (0-360)
  sign: string; // Zodiac sign
  house: number | null; // House placement (1-12 or null)
};

export type CalculatedPoint = {
  longitude: number; // Ecliptic longitude in degrees (0-360)
  sign: string; // Zodiac sign
  house: number | null; // House placement (1-12 or null)
};

export type Emphasis = {
  houseEmphasis: Array<{ house: number; count: number }>;
  signEmphasis: Array<{ sign: string; count: number }>;
  stelliums: Array<{
    type: "house" | "sign";
    name: number | string; // house number or sign name
    planets: string[]; // planet names (sorted alphabetically)
  }>;
};

export type AspectPattern = {
  type: "grand_trine" | "t_square";
  planets: string[]; // 3 planet names (sorted alphabetically)
};

export type CalculatedSummary = {
  southNode: CalculatedNode;
  chartType: "day" | "night"; // Chart sect based on Sun house position
  partOfFortune: CalculatedPoint | null; // Part of Fortune (null if insufficient data)
  emphasis: Emphasis; // House/sign emphasis and stelliums
  patterns: AspectPattern[]; // Aspect patterns (Grand Trine, T-Square, etc.)
};

// ============================================================================
// CONSTANTS
// ============================================================================

const ZODIAC_SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert degrees (0-360) to zodiac sign name
 */
function degreesToSign(degrees: number): string {
  const normalizedDegrees = ((degrees % 360) + 360) % 360;
  const signIndex = Math.floor(normalizedDegrees / 30);
  return ZODIAC_SIGNS[signIndex];
}

/**
 * Normalize longitude to 0-360 range
 */
function normalizeLongitude(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/**
 * Determine which house a longitude is in based on house cusps
 */
function determinePlanetHouse(planetLongitude: number, houseCusps: number[]): number | null {
  if (houseCusps.length !== 12) return null;

  // Normalize planet longitude to 0-360
  const normLon = normalizeLongitude(planetLongitude);

  // houseCusps is array of cusp longitudes [cusp1, cusp2, ..., cusp12]
  for (let i = 0; i < 12; i++) {
    const start = houseCusps[i];
    const end = i === 11 ? houseCusps[0] + 360 : houseCusps[i + 1];

    // Adjust longitude into the same rotation as start/end
    const lon = normLon < start ? normLon + 360 : normLon;

    if (lon >= start && lon < end) {
      return i + 1; // house numbers are 1-based
    }
  }

  // Fallback (should not reach here)
  return 1;
}

// ============================================================================
// COMPUTED FEATURES
// ============================================================================

/**
 * Compute South Node from North Node
 * South Node is always exactly opposite (180°) from North Node
 */
function computeSouthNode(placements: SwissPlacements): CalculatedNode {
  // Find North Node in planets
  const northNode = placements.planets.find((p) => p.name === "North Node");

  if (!northNode || northNode.longitude === null) {
    throw new Error("North Node not found or missing longitude");
  }

  // South Node is 180° opposite
  const southLongitude = normalizeLongitude(northNode.longitude + 180);
  const southSign = degreesToSign(southLongitude);

  // Determine house placement
  const houseCusps = placements.houses.map((h) => h.cuspLongitude);
  const southHouse = houseCusps.length === 12
    ? determinePlanetHouse(southLongitude, houseCusps)
    : null;

  return {
    longitude: southLongitude,
    sign: southSign,
    house: southHouse,
  };
}

/**
 * Compute chart type (day or night sect)
 * Based on Sun's house position:
 * - Sun in houses 7-12 = day chart
 * - Sun in houses 1-6 = night chart
 */
function computeChartType(placements: SwissPlacements): "day" | "night" {
  const sun = placements.planets.find((p) => p.name === "Sun");

  if (!sun || sun.house === null) {
    // Default to night if Sun house cannot be determined
    return "night";
  }

  // Day chart: Sun in houses 7-12 (above the horizon)
  // Night chart: Sun in houses 1-6 (below the horizon)
  return sun.house >= 7 && sun.house <= 12 ? "day" : "night";
}

/**
 * Compute Part of Fortune
 * Formula depends on chart type:
 * - Day chart: Ascendant + Moon - Sun
 * - Night chart: Ascendant + Sun - Moon
 *
 * Returns null if required data (Ascendant, Sun, Moon longitudes) is unavailable
 */
function computePartOfFortune(
  placements: SwissPlacements,
  chartType: "day" | "night"
): CalculatedPoint | null {
  // Get required longitudes
  const ascendantLon = placements.angles.ascendant.longitude;
  const sun = placements.planets.find((p) => p.name === "Sun");
  const moon = placements.planets.find((p) => p.name === "Moon");

  // Validate we have all required data
  if (
    ascendantLon === null ||
    !sun ||
    sun.longitude === null ||
    !moon ||
    moon.longitude === null
  ) {
    return null;
  }

  // Compute Part of Fortune longitude based on chart type
  let pofLongitude: number;
  if (chartType === "day") {
    // Day chart: Asc + Moon - Sun
    pofLongitude = ascendantLon + moon.longitude - sun.longitude;
  } else {
    // Night chart: Asc + Sun - Moon
    pofLongitude = ascendantLon + sun.longitude - moon.longitude;
  }

  // Normalize to 0-360 range
  pofLongitude = normalizeLongitude(pofLongitude);

  // Determine sign and house
  const pofSign = degreesToSign(pofLongitude);
  const houseCusps = placements.houses.map((h) => h.cuspLongitude);
  const pofHouse =
    houseCusps.length === 12 ? determinePlanetHouse(pofLongitude, houseCusps) : null;

  return {
    longitude: pofLongitude,
    sign: pofSign,
    house: pofHouse,
  };
}

/**
 * Compute emphasis (house/sign distributions) and stelliums (3+ planets in same sign/house)
 *
 * Rules:
 * - signEmphasis and sign stelliums include ALL planets (including North Node + Chiron)
 * - houseEmphasis and house stelliums include only planets with valid house placement
 * - Stellium = 3+ planets in the same sign OR house
 * - Results are sorted by count descending
 * - Planet names in stelliums are sorted alphabetically for deterministic output
 */
function computeEmphasis(placements: SwissPlacements): Emphasis {
  // Count planets by sign (include ALL planets)
  const signCounts: Record<string, string[]> = {};
  for (const planet of placements.planets) {
    if (!planet.sign) continue;
    if (!signCounts[planet.sign]) {
      signCounts[planet.sign] = [];
    }
    signCounts[planet.sign].push(planet.name);
  }

  // Count planets by house (only planets with valid house)
  const houseCounts: Record<number, string[]> = {};
  for (const planet of placements.planets) {
    if (planet.house === null) continue;
    if (!houseCounts[planet.house]) {
      houseCounts[planet.house] = [];
    }
    houseCounts[planet.house].push(planet.name);
  }

  // Build sign emphasis (sorted by count desc)
  const signEmphasis = Object.entries(signCounts)
    .map(([sign, planets]) => ({ sign, count: planets.length }))
    .sort((a, b) => b.count - a.count);

  // Build house emphasis (sorted by count desc)
  const houseEmphasis = Object.entries(houseCounts)
    .map(([house, planets]) => ({ house: Number(house), count: planets.length }))
    .sort((a, b) => b.count - a.count);

  // Detect stelliums (3+ planets in same sign or house)
  const stelliums: Emphasis["stelliums"] = [];

  // Sign stelliums
  for (const [sign, planets] of Object.entries(signCounts)) {
    if (planets.length >= 3) {
      stelliums.push({
        type: "sign",
        name: sign,
        planets: planets.sort(), // Sort alphabetically for deterministic output
      });
    }
  }

  // House stelliums
  for (const [house, planets] of Object.entries(houseCounts)) {
    if (planets.length >= 3) {
      stelliums.push({
        type: "house",
        name: Number(house),
        planets: planets.sort(), // Sort alphabetically for deterministic output
      });
    }
  }

  return {
    houseEmphasis,
    signEmphasis,
    stelliums,
  };
}

/**
 * Compute aspect patterns (Grand Trine, T-Square, etc.)
 *
 * Grand Trine: 3 planets all trine each other (A-B trine, A-C trine, B-C trine)
 * T-Square: 3 planets where one opposition + two squares form a T shape
 *           (A-B opposition, A-C square, B-C square)
 *
 * Pattern vertices are limited to traditional planets only:
 * Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto
 *
 * Explicitly excluded: North Node, South Node, Chiron, and any calculated points
 *
 * Results are deduplicated by sorting planet names alphabetically
 */
function computePatterns(placements: SwissPlacements): AspectPattern[] {
  if (!placements.aspects || placements.aspects.length === 0) {
    return [];
  }

  // Allowed planets for pattern vertices (traditional planets only)
  const ALLOWED_PATTERN_PLANETS = new Set([
    "Sun",
    "Moon",
    "Mercury",
    "Venus",
    "Mars",
    "Jupiter",
    "Saturn",
    "Uranus",
    "Neptune",
    "Pluto",
  ]);

  const patterns: AspectPattern[] = [];
  const seen = new Set<string>(); // Dedupe key: "type:planetA|planetB|planetC"

  // Helper: check if two planets have a specific aspect type
  const hasAspect = (p1: string, p2: string, aspectType: string): boolean => {
    return placements.aspects!.some((aspect) => {
      const [a, b] = aspect.between;
      return (
        aspect.type === aspectType &&
        ((a === p1 && b === p2) || (a === p2 && b === p1))
      );
    });
  };

  // Get unique planet names from all aspects, filtered to allowed planets only
  const planetsInAspects = new Set<string>();
  for (const aspect of placements.aspects) {
    const [a, b] = aspect.between;
    if (ALLOWED_PATTERN_PLANETS.has(a)) {
      planetsInAspects.add(a);
    }
    if (ALLOWED_PATTERN_PLANETS.has(b)) {
      planetsInAspects.add(b);
    }
  }
  const planetList = Array.from(planetsInAspects);

  // Check all combinations of 3 planets
  for (let i = 0; i < planetList.length; i++) {
    for (let j = i + 1; j < planetList.length; j++) {
      for (let k = j + 1; k < planetList.length; k++) {
        const p1 = planetList[i];
        const p2 = planetList[j];
        const p3 = planetList[k];

        // Check for Grand Trine (all 3 pairs are trines)
        if (
          hasAspect(p1, p2, "trine") &&
          hasAspect(p1, p3, "trine") &&
          hasAspect(p2, p3, "trine")
        ) {
          const sorted = [p1, p2, p3].sort();
          const key = `grand_trine:${sorted.join("|")}`;
          if (!seen.has(key)) {
            seen.add(key);
            patterns.push({
              type: "grand_trine",
              planets: sorted,
            });
          }
        }

        // Check for T-Square (1 opposition + 2 squares)
        // Pattern 1: p1-p2 opposition, p1-p3 square, p2-p3 square
        if (
          hasAspect(p1, p2, "opposition") &&
          hasAspect(p1, p3, "square") &&
          hasAspect(p2, p3, "square")
        ) {
          const sorted = [p1, p2, p3].sort();
          const key = `t_square:${sorted.join("|")}`;
          if (!seen.has(key)) {
            seen.add(key);
            patterns.push({
              type: "t_square",
              planets: sorted,
            });
          }
        }

        // Pattern 2: p1-p3 opposition, p1-p2 square, p2-p3 square
        if (
          hasAspect(p1, p3, "opposition") &&
          hasAspect(p1, p2, "square") &&
          hasAspect(p2, p3, "square")
        ) {
          const sorted = [p1, p2, p3].sort();
          const key = `t_square:${sorted.join("|")}`;
          if (!seen.has(key)) {
            seen.add(key);
            patterns.push({
              type: "t_square",
              planets: sorted,
            });
          }
        }

        // Pattern 3: p2-p3 opposition, p1-p2 square, p1-p3 square
        if (
          hasAspect(p2, p3, "opposition") &&
          hasAspect(p1, p2, "square") &&
          hasAspect(p1, p3, "square")
        ) {
          const sorted = [p1, p2, p3].sort();
          const key = `t_square:${sorted.join("|")}`;
          if (!seen.has(key)) {
            seen.add(key);
            patterns.push({
              type: "t_square",
              planets: sorted,
            });
          }
        }
      }
    }
  }

  return patterns;
}

// ============================================================================
// MAIN COMPUTE FUNCTION
// ============================================================================

/**
 * Compute calculated features from birth chart placements
 *
 * @param placements - Swiss Ephemeris placements (planets, houses, angles, aspects)
 * @returns Calculated summary with South Node, chart type, Part of Fortune, emphasis, patterns, and other derived points
 */
export function computeCalculated(placements: SwissPlacements): CalculatedSummary {
  const southNode = computeSouthNode(placements);
  const chartType = computeChartType(placements);
  const partOfFortune = computePartOfFortune(placements, chartType);
  const emphasis = computeEmphasis(placements);
  const patterns = computePatterns(placements);

  return {
    southNode,
    chartType,
    partOfFortune,
    emphasis,
    patterns,
  };
}
