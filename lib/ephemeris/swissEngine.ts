/**
 * Swiss Ephemeris Engine for Solara Birth Charts
 *
 * Uses the Swiss Ephemeris library to compute accurate astronomical positions
 * for natal chart calculations using Western tropical zodiac + Placidus houses.
 *
 * This module provides raw placements (planets, houses, angles) without interpretations.
 */

import path from "path";
import swisseph from "swisseph";
import { calculateAspects, type AspectPlacement } from "./aspects";
import { computeDerived, type DerivedSummary } from "./derived";
import { computeCalculated, type CalculatedSummary } from "./calculated";

// ============================================================================
// TYPES
// ============================================================================

export type SwissBirthInput = {
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  timezone: string; // IANA, e.g. "America/New_York"
  lat: number; // latitude in decimal degrees
  lon: number; // longitude in decimal degrees
};

export type SwissPlanetPlacement = {
  name: string; // "Sun", "Moon", etc.
  sign: string; // "Taurus", "Gemini", etc.
  house: number | null; // 1-12 or null if cannot be determined
  longitude: number | null; // Ecliptic longitude in degrees (0-360)
  retrograde?: boolean; // True if planet is moving backwards (longitudeSpeed < 0)
};

export type SwissHousePlacement = {
  house: number; // 1-12
  signOnCusp: string; // "Capricorn", etc.
  cuspLongitude: number; // Exact cusp longitude in degrees (0-360)
};

export type SwissAngles = {
  ascendant: { sign: string; longitude: number | null };
  midheaven: { sign: string; longitude: number | null };
  descendant: { sign: string; longitude: number | null };
  ic: { sign: string; longitude: number | null };
};

export type SwissPlacements = {
  system: "western_tropical_placidus";
  planets: SwissPlanetPlacement[];
  houses: SwissHousePlacement[];
  angles: SwissAngles;
  aspects?: AspectPlacement[]; // Major aspects between planets
  derived?: DerivedSummary; // Derived summary (element balance, dominant signs/planets, etc.)
  calculated?: CalculatedSummary; // Calculated features (South Node, Part of Fortune, etc.)
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

// Swiss Ephemeris planet constants
const PLANETS = {
  SUN: swisseph.SE_SUN,
  MOON: swisseph.SE_MOON,
  MERCURY: swisseph.SE_MERCURY,
  VENUS: swisseph.SE_VENUS,
  MARS: swisseph.SE_MARS,
  JUPITER: swisseph.SE_JUPITER,
  SATURN: swisseph.SE_SATURN,
  URANUS: swisseph.SE_URANUS,
  NEPTUNE: swisseph.SE_NEPTUNE,
  PLUTO: swisseph.SE_PLUTO,
  NORTH_NODE: swisseph.SE_TRUE_NODE,
  CHIRON: swisseph.SE_CHIRON,
};

const PLANET_NAMES: Record<number, string> = {
  [swisseph.SE_SUN]: "Sun",
  [swisseph.SE_MOON]: "Moon",
  [swisseph.SE_MERCURY]: "Mercury",
  [swisseph.SE_VENUS]: "Venus",
  [swisseph.SE_MARS]: "Mars",
  [swisseph.SE_JUPITER]: "Jupiter",
  [swisseph.SE_SATURN]: "Saturn",
  [swisseph.SE_URANUS]: "Uranus",
  [swisseph.SE_NEPTUNE]: "Neptune",
  [swisseph.SE_PLUTO]: "Pluto",
  [swisseph.SE_TRUE_NODE]: "North Node",
  [swisseph.SE_CHIRON]: "Chiron",
};

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
 * Convert local date/time + timezone to UTC Julian Day
 */
function localToJulianDay(date: string, time: string, timezone: string): number {
  // Parse the date and time components
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  // Build a date string in ISO format (this will be interpreted as local system time)
  const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;

  // We need to interpret this date/time as being in the specified timezone
  // and convert it to UTC. We'll use a workaround with Intl.DateTimeFormat.

  // Step 1: Create a dummy UTC date with the same numbers
  const utcDummy = new Date(`${dateStr}Z`);

  // Step 2: Format this UTC time as it would appear in the target timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(utcDummy);
  const tzYear = parseInt(parts.find((p) => p.type === "year")!.value);
  const tzMonth = parseInt(parts.find((p) => p.type === "month")!.value);
  const tzDay = parseInt(parts.find((p) => p.type === "day")!.value);
  const tzHour = parseInt(parts.find((p) => p.type === "hour")!.value);
  const tzMinute = parseInt(parts.find((p) => p.type === "minute")!.value);
  const tzSecond = parseInt(parts.find((p) => p.type === "second")!.value);

  // Step 3: Calculate the offset in milliseconds
  // The offset is: (what we want - what we got)
  const wantedTime = new Date(Date.UTC(year, month - 1, day, hour, minute, 0)).getTime();
  const gotTime = new Date(Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMinute, tzSecond)).getTime();
  const offsetMs = wantedTime - gotTime;

  // Step 4: Apply the offset to get the correct UTC time
  const correctUTC = new Date(utcDummy.getTime() + offsetMs);

  // Extract UTC components
  const utcYear = correctUTC.getUTCFullYear();
  const utcMonth = correctUTC.getUTCMonth() + 1;
  const utcDay = correctUTC.getUTCDate();
  const utcHour = correctUTC.getUTCHours();
  const utcMinute = correctUTC.getUTCMinutes();
  const utcSecond = correctUTC.getUTCSeconds();

  // Convert to decimal hours
  const utcTime = utcHour + utcMinute / 60 + utcSecond / 3600;

  // Calculate Julian Day using Swiss Ephemeris
  const julday = swisseph.swe_julday(
    utcYear,
    utcMonth,
    utcDay,
    utcTime,
    swisseph.SE_GREG_CAL
  );

  console.log(
    `[Swiss] Local: ${date} ${time} (${timezone}) → UTC: ${utcYear}-${String(utcMonth).padStart(2, "0")}-${String(utcDay).padStart(2, "0")} ${utcTime.toFixed(4)}h → JD: ${julday}`
  );

  return julday;
}

/**
 * Determine which house a planet is in based on house cusps
 */
function determinePlanetHouse(planetLongitude: number, houseCusps: number[]): number {
  // Normalize planet longitude to 0-360
  const normLon = ((planetLongitude % 360) + 360) % 360;

  // houseCusps is 0-indexed (0 = house 1 cusp)
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
// MAIN ENGINE FUNCTION
// ============================================================================

/**
 * Compute natal chart placements using Swiss Ephemeris
 *
 * @param input - Birth date, time, timezone, and geographic coordinates
 * @returns Placements for planets, houses, and angles
 */
export async function computeSwissPlacements(
  input: SwissBirthInput
): Promise<SwissPlacements> {
  console.log(
    `[Swiss] Computing placements for ${input.date} ${input.time} at (${input.lat}, ${input.lon}) in ${input.timezone}`
  );

  try {
    // Set ephemeris path to use Swiss Ephemeris data files
    // This enables calculation of asteroids like Chiron, Ceres, etc.
    // Data files are included in node_modules/swisseph/ephe
    const ephePath = path.join(process.cwd(), "node_modules", "swisseph", "ephe");
    swisseph.swe_set_ephe_path(ephePath);

    // Calculate Julian Day for the birth moment
    const julianDay = localToJulianDay(input.date, input.time, input.timezone);

    // Check if we have valid geographic coordinates
    // If lat/lon are 0,0 or invalid, we'll skip house calculations
    const hasValidLocation =
      typeof input.lat === "number" &&
      typeof input.lon === "number" &&
      !Number.isNaN(input.lat) &&
      !Number.isNaN(input.lon) &&
      !(input.lat === 0 && input.lon === 0);

    let houses: SwissHousePlacement[] = [];
    let angles: SwissAngles;
    let houseCusps: number[] = [];

    if (hasValidLocation) {
      // Calculate houses using Placidus system
      // swe_houses returns { house: number[], ascmc: number[] } or { error: string }
      // house[1..12] = house cusps in degrees
      // ascmc[0] = Ascendant, ascmc[1] = MC, ascmc[2] = ARMC, etc.
      const housesResult = swisseph.swe_houses(
        julianDay,
        input.lat,
        input.lon,
        "P" // 'P' = Placidus
      );

      if ("error" in housesResult) {
        console.warn(`[Swiss] House calculation failed: ${housesResult.error}. Proceeding without houses.`);
        // Proceed without houses
        angles = {
          ascendant: { sign: "Unknown", longitude: null },
          midheaven: { sign: "Unknown", longitude: null },
          descendant: { sign: "Unknown", longitude: null },
          ic: { sign: "Unknown", longitude: null },
        };
      } else {
        houseCusps = housesResult.house; // Array: [cusp1, cusp2, ..., cusp12] (0-indexed)
        console.log(`[Swiss] Raw housesResult.house type:`, typeof housesResult.house);
        console.log(`[Swiss] Raw housesResult.house:`, housesResult.house);
        console.log(`[Swiss] housesResult.house array length:`, housesResult.house?.length);

        // Validate shape
        if (!Array.isArray(houseCusps) || houseCusps.length !== 12) {
          console.error(`[Swiss] Unexpected housesResult.house shape:`, houseCusps);
          throw new Error("Swiss houses array did not contain 12 cusps");
        }

        const ascendantDegrees = housesResult.ascendant;
        const midheavenDegrees = housesResult.mc;
        const descendantDegrees = (ascendantDegrees + 180) % 360;
        const icDegrees = (midheavenDegrees + 180) % 360;

        console.log(
          `[Swiss] Houses calculated: Asc=${ascendantDegrees.toFixed(2)}°, MC=${midheavenDegrees.toFixed(2)}°`
        );

        // Build angles
        angles = {
          ascendant: { sign: degreesToSign(ascendantDegrees), longitude: ascendantDegrees },
          midheaven: { sign: degreesToSign(midheavenDegrees), longitude: midheavenDegrees },
          descendant: { sign: degreesToSign(descendantDegrees), longitude: descendantDegrees },
          ic: { sign: degreesToSign(icDegrees), longitude: icDegrees },
        };

        // Build house placements
        console.log(`[Swiss] houseCusps array length: ${houseCusps.length}`);

        // Build house placements using 0-based cusps
        for (let i = 0; i < 12; i++) {
          const cusp = houseCusps[i];
          const sign = degreesToSign(cusp);
          console.log(`[Swiss] House ${i + 1}: cusp=${cusp.toFixed(2)}° → ${sign}`);
          houses.push({
            house: i + 1,
            signOnCusp: sign,
            cuspLongitude: cusp,
          });
        }
        console.log(`[Swiss] Total houses built: ${houses.length}`);
      }
    } else {
      console.log(
        `[Swiss] No valid location coordinates; generating sign-based chart without houses/angles`
      );
      // Return placeholder angles when location is unknown
      angles = {
        ascendant: { sign: "Unknown", longitude: null },
        midheaven: { sign: "Unknown", longitude: null },
        descendant: { sign: "Unknown", longitude: null },
        ic: { sign: "Unknown", longitude: null },
      };
    }

    // Calculate planet positions (these don't require lat/lon)
    const planets: SwissPlanetPlacement[] = [];

    for (const [, planetId] of Object.entries(PLANETS)) {
      const result = swisseph.swe_calc_ut(
        julianDay,
        planetId,
        swisseph.SEFLG_SWIEPH | swisseph.SEFLG_SPEED
      );

      // Check if result is an error
      if ("error" in result) {
        console.error(`[Swiss] Error calculating ${PLANET_NAMES[planetId]}:`, result.error);
        continue;
      }

      // Result is a successful calculation with longitude, latitude, distance, etc.
      // We use SEFLG_SWIEPH which returns ecliptic coordinates
      if (!("longitude" in result)) {
        console.error(`[Swiss] Unexpected result format for ${PLANET_NAMES[planetId]}`);
        continue;
      }

      const longitude = result.longitude; // Ecliptic longitude in degrees
      const longitudeSpeed = result.longitudeSpeed; // Degrees per day
      const sign = degreesToSign(longitude);

      // Only determine house if we have valid house cusps
      const house = hasValidLocation && houseCusps.length > 0
        ? determinePlanetHouse(longitude, houseCusps)
        : null;

      // Determine if planet is retrograde (moving backwards)
      // longitudeSpeed < 0 means retrograde motion
      const retrograde = typeof longitudeSpeed === "number" && longitudeSpeed < 0;

      planets.push({
        name: PLANET_NAMES[planetId],
        sign,
        house,
        longitude,
        retrograde,
      });

      const retrogradeLabel = retrograde ? " ℞" : "";
      if (hasValidLocation && house !== null) {
        console.log(
          `[Swiss] ${PLANET_NAMES[planetId]}: ${longitude.toFixed(2)}° → ${sign}${retrogradeLabel} in house ${house}`
        );
      } else {
        console.log(
          `[Swiss] ${PLANET_NAMES[planetId]}: ${longitude.toFixed(2)}° → ${sign}${retrogradeLabel}`
        );
      }
    }

    // Calculate aspects between planets
    const aspects = calculateAspects(planets);
    console.log(`[Swiss] Computed ${aspects.length} aspects between planets`);

    // Build initial placements object (needed for derived computation)
    const placements: SwissPlacements = {
      system: "western_tropical_placidus",
      planets,
      houses,
      angles,
      aspects,
    };

    // Compute derived summary (element balance, dominant signs/planets, etc.)
    const derived = computeDerived(placements);
    console.log(`[Swiss] Derived summary computed:`, {
      chartRuler: derived.chartRuler,
      dominantSigns: derived.dominantSigns.map(s => s.sign),
      dominantPlanets: derived.dominantPlanets.map(p => p.name),
    });

    // Add derived summary to placements
    placements.derived = derived;

    // Compute calculated features (South Node, Part of Fortune, etc.)
    const calculated = computeCalculated(placements);
    console.log(`[Swiss] Calculated features computed:`, {
      chartType: calculated.chartType,
      southNode: {
        sign: calculated.southNode.sign,
        house: calculated.southNode.house,
        longitude: calculated.southNode.longitude.toFixed(2),
      },
      partOfFortune: calculated.partOfFortune
        ? {
            sign: calculated.partOfFortune.sign,
            house: calculated.partOfFortune.house,
            longitude: calculated.partOfFortune.longitude.toFixed(2),
          }
        : null,
      emphasis: {
        topSigns: calculated.emphasis.signEmphasis.slice(0, 3).map(s => `${s.sign} (${s.count})`),
        topHouses: calculated.emphasis.houseEmphasis.slice(0, 3).map(h => `House ${h.house} (${h.count})`),
        stelliums: calculated.emphasis.stelliums.map(s =>
          s.type === "sign"
            ? `${s.planets.length} in ${s.name}`
            : `${s.planets.length} in House ${s.name}`
        ),
      },
      patterns: calculated.patterns.map(p => `${p.type}: ${p.planets.join(", ")}`),
    });

    // Add calculated features to placements
    placements.calculated = calculated;

    // Close Swiss Ephemeris (cleanup)
    swisseph.swe_close();

    console.log(`[Swiss] Placements computed successfully`);

    return placements;
  } catch (error: any) {
    console.error("[Swiss] Error computing placements:", error);
    swisseph.swe_close();
    throw new Error(`Swiss Ephemeris calculation failed: ${error.message}`);
  }
}
