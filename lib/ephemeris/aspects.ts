/**
 * Aspect Calculation for Birth Charts
 *
 * Computes major aspects between planets based on ecliptic longitude.
 * Uses traditional orbs for each aspect type.
 */

import type { SwissPlanetPlacement } from "./swissEngine";

// ============================================================================
// TYPES
// ============================================================================

export type AspectType = "conjunction" | "sextile" | "square" | "trine" | "opposition";

export type AspectPlacement = {
  between: [string, string]; // ["Sun", "Moon"]
  type: AspectType;
  orb: number; // Deviation from exact aspect in degrees
  exactAngle: number; // Actual angular separation (0-180)
};

// ============================================================================
// ASPECT DEFINITIONS
// ============================================================================

type AspectDefinition = {
  type: AspectType;
  angle: number; // Target angle in degrees
  orb: number; // Maximum orb tolerance in degrees
};

const MAJOR_ASPECTS: AspectDefinition[] = [
  { type: "conjunction", angle: 0, orb: 8 },
  { type: "sextile", angle: 60, orb: 6 },
  { type: "square", angle: 90, orb: 6 },
  { type: "trine", angle: 120, orb: 7 },
  { type: "opposition", angle: 180, orb: 8 },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate the shortest angular separation between two longitudes (0-180°)
 */
function calculateSeparation(lon1: number, lon2: number): number {
  let diff = Math.abs(lon1 - lon2);
  // Take the shortest path around the circle
  if (diff > 180) {
    diff = 360 - diff;
  }
  return diff;
}

/**
 * Check if an angular separation matches an aspect within orb tolerance
 */
function matchesAspect(
  separation: number,
  aspectDef: AspectDefinition
): { matches: boolean; orb: number } {
  const orb = Math.abs(separation - aspectDef.angle);
  return {
    matches: orb <= aspectDef.orb,
    orb,
  };
}

// ============================================================================
// MAIN ASPECT CALCULATION FUNCTION
// ============================================================================

/**
 * Calculate all major aspects between planets in a birth chart
 *
 * @param planets - Array of planet placements with longitudes
 * @returns Array of aspects found between planets
 */
export function calculateAspects(planets: SwissPlanetPlacement[]): AspectPlacement[] {
  const aspects: AspectPlacement[] = [];

  // Filter planets that have valid longitude values
  const planetsWithLongitude = planets.filter(
    (p) => p.longitude !== null && typeof p.longitude === "number"
  );

  // Compare each planet with every other planet (avoid duplicates)
  for (let i = 0; i < planetsWithLongitude.length; i++) {
    for (let j = i + 1; j < planetsWithLongitude.length; j++) {
      const planet1 = planetsWithLongitude[i];
      const planet2 = planetsWithLongitude[j];

      const separation = calculateSeparation(planet1.longitude!, planet2.longitude!);

      // Check against each major aspect
      for (const aspectDef of MAJOR_ASPECTS) {
        const { matches, orb } = matchesAspect(separation, aspectDef);

        if (matches) {
          aspects.push({
            between: [planet1.name, planet2.name],
            type: aspectDef.type,
            orb,
            exactAngle: separation,
          });
          // Found an aspect for this pair, don't check other aspect types
          break;
        }
      }
    }
  }

  return aspects;
}
