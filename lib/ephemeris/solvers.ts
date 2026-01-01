/**
 * Ephemeris Solvers for Global Astrology Events
 *
 * Provides algorithms to find exact moments of:
 * - Sign ingresses (planet entering a new zodiac sign)
 * - Season ingresses (Sun entering cardinal signs)
 * - Stations (planet going retrograde or direct)
 * - Exact transit-to-natal aspects
 *
 * Uses bracket + binary search for sub-second precision.
 */

import path from "path";
import swisseph from "swisseph";

// ============================================================================
// TYPES
// ============================================================================

export type SolverResult = {
  julianDay: number;
  timestamp: Date;
  longitude: number;
  longitudeSpeed?: number;
};

export type SignIngressEvent = SolverResult & {
  planet: string;
  sign: string;
  previousSign: string;
};

export type StationEvent = SolverResult & {
  planet: string;
  stationType: "retrograde" | "direct";
  sign: string;
};

export type SeasonIngressEvent = SolverResult & {
  season: "spring_equinox" | "summer_solstice" | "fall_equinox" | "winter_solstice";
  sign: string;
};

export type ExactAspectEvent = SolverResult & {
  transitPlanet: string;
  natalPlanet: string;
  natalLongitude: number;
  aspectType: string;
  aspectAngle: number;
  isRetrograde: boolean;
  passNumber: number;
};

// Value function type for generic solver
type ValueFunction = (jd: number) => number;

// ============================================================================
// CONSTANTS
// ============================================================================

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

// Cardinal sign boundaries (season ingresses)
const CARDINAL_BOUNDARIES = [0, 90, 180, 270]; // Aries, Cancer, Libra, Capricorn

const SEASON_NAMES: Record<number, "spring_equinox" | "summer_solstice" | "fall_equinox" | "winter_solstice"> = {
  0: "spring_equinox",    // Sun enters Aries
  90: "summer_solstice",  // Sun enters Cancer
  180: "fall_equinox",    // Sun enters Libra
  270: "winter_solstice", // Sun enters Capricorn
};

// Planet IDs and names
const PLANETS: Record<string, number> = {
  Sun: swisseph.SE_SUN,
  Moon: swisseph.SE_MOON,
  Mercury: swisseph.SE_MERCURY,
  Venus: swisseph.SE_VENUS,
  Mars: swisseph.SE_MARS,
  Jupiter: swisseph.SE_JUPITER,
  Saturn: swisseph.SE_SATURN,
  Uranus: swisseph.SE_URANUS,
  Neptune: swisseph.SE_NEPTUNE,
  Pluto: swisseph.SE_PLUTO,
  Chiron: swisseph.SE_CHIRON,
};

// Planets that can retrograde (everything except Sun and Moon)
const RETROGRADE_PLANETS = [
  "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "Chiron",
];

// Major aspect angles
const ASPECT_ANGLES: Record<string, number> = {
  conjunction: 0,
  sextile: 60,
  square: 90,
  trine: 120,
  opposition: 180,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize angle to 0-360 range
 */
function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/**
 * Calculate angular difference handling 0/360 wrap
 * Returns signed difference in range -180 to +180
 */
export function angDiff(a: number, b: number): number {
  let diff = ((b - a) % 360 + 540) % 360 - 180;
  return diff;
}

/**
 * Get zodiac sign from longitude
 */
function getSign(longitude: number): string {
  const normalized = normalizeAngle(longitude);
  const signIndex = Math.floor(normalized / 30);
  return ZODIAC_SIGNS[signIndex];
}

/**
 * Get planet position at a Julian Day
 */
function getPlanetPosition(planetId: number, jd: number): { longitude: number; speed: number } | null {
  const result = swisseph.swe_calc_ut(
    jd,
    planetId,
    swisseph.SEFLG_SWIEPH | swisseph.SEFLG_SPEED
  );

  if ("error" in result) {
    console.error(`[Solver] Error getting planet position:`, result.error);
    return null;
  }

  // Type guard: ensure we have ecliptic coordinates (longitude/latitude)
  if (!("longitude" in result)) {
    console.error(`[Solver] Unexpected result format (no longitude)`);
    return null;
  }

  return {
    longitude: result.longitude,
    speed: result.longitudeSpeed,
  };
}

/**
 * Convert Julian Day to JavaScript Date (UTC)
 */
function julianDayToDate(jd: number): Date {
  // JD 2440587.5 = Unix epoch (1970-01-01 00:00:00 UTC)
  const unixDays = jd - 2440587.5;
  const unixMs = unixDays * 86400000;
  return new Date(unixMs);
}

/**
 * Convert JavaScript Date to Julian Day
 */
function dateToJulianDay(date: Date): number {
  const unixMs = date.getTime();
  const unixDays = unixMs / 86400000;
  return unixDays + 2440587.5;
}

/**
 * Get Julian Day for start of year (Jan 1 00:00 UTC)
 */
function yearStartJD(year: number): number {
  return dateToJulianDay(new Date(Date.UTC(year, 0, 1, 0, 0, 0)));
}

/**
 * Get Julian Day for end of year (Dec 31 23:59:59 UTC)
 */
function yearEndJD(year: number): number {
  return dateToJulianDay(new Date(Date.UTC(year, 11, 31, 23, 59, 59)));
}

// ============================================================================
// GENERIC BRACKET + BINARY SEARCH SOLVER
// ============================================================================

/**
 * Generic solver using bracket detection + binary search refinement.
 *
 * @param valueFn - Function that returns a value at a given Julian Day
 * @param jdStart - Start of search range
 * @param jdEnd - End of search range
 * @param targetValue - Value we're looking for (e.g., 0 for sign boundary crossing)
 * @param precision - Desired precision in days (default: ~1 second)
 * @param maxIterations - Maximum binary search iterations
 * @returns Julian Day of the event, or null if not found
 */
export function bracketAndSolve(
  valueFn: ValueFunction,
  jdStart: number,
  jdEnd: number,
  targetValue: number = 0,
  precision: number = 0.00001, // ~0.86 seconds
  maxIterations: number = 100
): number | null {
  let low = jdStart;
  let high = jdEnd;

  let valueLow = valueFn(low) - targetValue;
  let valueHigh = valueFn(high) - targetValue;

  // Check if target is bracketed (signs are different)
  if (valueLow * valueHigh > 0) {
    // No zero crossing in this interval
    return null;
  }

  // Binary search to find the crossing
  for (let i = 0; i < maxIterations; i++) {
    const mid = (low + high) / 2;
    const valueMid = valueFn(mid) - targetValue;

    if (Math.abs(high - low) < precision) {
      return mid;
    }

    if (valueLow * valueMid <= 0) {
      high = mid;
      valueHigh = valueMid;
    } else {
      low = mid;
      valueLow = valueMid;
    }
  }

  return (low + high) / 2;
}

// ============================================================================
// SIGN INGRESS FINDER
// ============================================================================

/**
 * Find all sign ingresses for a planet during a year.
 *
 * @param planetName - Planet name (e.g., "Mars")
 * @param year - Year to search
 * @param stepDays - Step size for initial bracket detection (default: 1 day)
 * @returns Array of sign ingress events
 */
export function findSignIngresses(
  planetName: string,
  year: number,
  stepDays: number = 1
): SignIngressEvent[] {
  const planetId = PLANETS[planetName];
  if (planetId === undefined) {
    console.error(`[Solver] Unknown planet: ${planetName}`);
    return [];
  }

  const events: SignIngressEvent[] = [];
  const jdStart = yearStartJD(year);
  const jdEnd = yearEndJD(year);

  // Initialize ephemeris path
  const ephePath = path.join(process.cwd(), "node_modules", "swisseph", "ephe");
  swisseph.swe_set_ephe_path(ephePath);

  let currentJD = jdStart;
  let prevPos = getPlanetPosition(planetId, currentJD);
  if (!prevPos) return events;

  let prevSign = getSign(prevPos.longitude);

  while (currentJD < jdEnd) {
    const nextJD = currentJD + stepDays;
    const nextPos = getPlanetPosition(planetId, nextJD);
    if (!nextPos) {
      currentJD = nextJD;
      continue;
    }

    const nextSign = getSign(nextPos.longitude);

    // Check if sign changed
    if (nextSign !== prevSign) {
      // Find the sign boundary that was crossed
      const prevSignIndex = ZODIAC_SIGNS.indexOf(prevSign);
      const nextSignIndex = ZODIAC_SIGNS.indexOf(nextSign);

      // Handle retrograde (going backwards through signs)
      let boundaryDegree: number;
      if ((nextSignIndex - prevSignIndex + 12) % 12 === 1) {
        // Forward motion: crossing into next sign
        boundaryDegree = nextSignIndex * 30;
      } else {
        // Retrograde motion: crossing back into previous sign
        boundaryDegree = (prevSignIndex + 1) * 30;
        if (boundaryDegree >= 360) boundaryDegree = 0;
      }

      // Binary search for exact crossing
      const valueFn: ValueFunction = (jd) => {
        const pos = getPlanetPosition(planetId, jd);
        if (!pos) return 0;
        // Calculate distance from boundary, handling wrap
        return angDiff(boundaryDegree, pos.longitude);
      };

      const exactJD = bracketAndSolve(valueFn, currentJD, nextJD, 0);

      if (exactJD !== null) {
        const exactPos = getPlanetPosition(planetId, exactJD);
        if (exactPos) {
          events.push({
            julianDay: exactJD,
            timestamp: julianDayToDate(exactJD),
            longitude: exactPos.longitude,
            longitudeSpeed: exactPos.speed,
            planet: planetName,
            sign: nextSign,
            previousSign: prevSign,
          });
        }
      }
    }

    prevSign = nextSign;
    currentJD = nextJD;
  }

  return events;
}

// ============================================================================
// SEASON INGRESS FINDER (Sun entering cardinal signs)
// ============================================================================

/**
 * Find all season ingresses (equinoxes and solstices) for a year.
 *
 * @param year - Year to search
 * @returns Array of season ingress events (should be exactly 4)
 */
export function findSeasonIngresses(year: number): SeasonIngressEvent[] {
  const sunIngresses = findSignIngresses("Sun", year, 1);

  // Filter to only cardinal signs (Aries, Cancer, Libra, Capricorn)
  const cardinalSigns = ["Aries", "Cancer", "Libra", "Capricorn"];

  return sunIngresses
    .filter((e) => cardinalSigns.includes(e.sign))
    .map((e) => {
      const signIndex = ZODIAC_SIGNS.indexOf(e.sign);
      const boundaryDegree = signIndex * 30;

      return {
        julianDay: e.julianDay,
        timestamp: e.timestamp,
        longitude: e.longitude,
        longitudeSpeed: e.longitudeSpeed,
        season: SEASON_NAMES[boundaryDegree],
        sign: e.sign,
      };
    });
}

// ============================================================================
// STATION FINDER (Retrograde/Direct)
// ============================================================================

/**
 * Find all stations (retrograde and direct) for a planet during a year.
 *
 * A station occurs when the planet's longitudinal speed crosses zero.
 * - Speed goes from positive to negative = station retrograde
 * - Speed goes from negative to positive = station direct
 *
 * @param planetName - Planet name (must be a planet that can retrograde)
 * @param year - Year to search
 * @param stepDays - Step size for initial bracket detection
 * @returns Array of station events
 */
export function findStations(
  planetName: string,
  year: number,
  stepDays: number = 1
): StationEvent[] {
  if (!RETROGRADE_PLANETS.includes(planetName)) {
    console.warn(`[Solver] ${planetName} does not retrograde`);
    return [];
  }

  const planetId = PLANETS[planetName];
  if (planetId === undefined) {
    console.error(`[Solver] Unknown planet: ${planetName}`);
    return [];
  }

  const events: StationEvent[] = [];
  const jdStart = yearStartJD(year);
  const jdEnd = yearEndJD(year);

  // Initialize ephemeris path
  const ephePath = path.join(process.cwd(), "node_modules", "swisseph", "ephe");
  swisseph.swe_set_ephe_path(ephePath);

  let currentJD = jdStart;
  let prevPos = getPlanetPosition(planetId, currentJD);
  if (!prevPos) return events;

  while (currentJD < jdEnd) {
    const nextJD = currentJD + stepDays;
    const nextPos = getPlanetPosition(planetId, nextJD);
    if (!nextPos) {
      currentJD = nextJD;
      continue;
    }

    // Check for speed sign change (station)
    if (prevPos.speed * nextPos.speed < 0) {
      // Speed crossed zero - find exact moment
      const valueFn: ValueFunction = (jd) => {
        const pos = getPlanetPosition(planetId, jd);
        return pos ? pos.speed : 0;
      };

      const exactJD = bracketAndSolve(valueFn, currentJD, nextJD, 0);

      if (exactJD !== null) {
        const exactPos = getPlanetPosition(planetId, exactJD);
        if (exactPos) {
          // Determine station type based on speed transition
          const stationType: "retrograde" | "direct" =
            prevPos.speed > 0 && nextPos.speed < 0 ? "retrograde" : "direct";

          events.push({
            julianDay: exactJD,
            timestamp: julianDayToDate(exactJD),
            longitude: exactPos.longitude,
            longitudeSpeed: exactPos.speed,
            planet: planetName,
            stationType,
            sign: getSign(exactPos.longitude),
          });
        }
      }
    }

    prevPos = nextPos;
    currentJD = nextJD;
  }

  return events;
}

// ============================================================================
// EXACT ASPECT FINDER (Transit to Natal)
// ============================================================================

/**
 * Find all exact aspects between a transiting planet and a natal position.
 *
 * Handles retrograde multi-pass (a slow planet may make the same aspect 3 times).
 *
 * @param transitPlanetName - Transiting planet name
 * @param natalLongitude - Natal planet's longitude (fixed)
 * @param natalPlanetName - Natal planet name (for labeling)
 * @param aspectType - Type of aspect (conjunction, sextile, etc.)
 * @param year - Year to search
 * @param stepDays - Step size for bracket detection
 * @returns Array of exact aspect events
 */
export function findExactAspects(
  transitPlanetName: string,
  natalLongitude: number,
  natalPlanetName: string,
  aspectType: keyof typeof ASPECT_ANGLES,
  year: number,
  stepDays: number = 1
): ExactAspectEvent[] {
  const planetId = PLANETS[transitPlanetName];
  if (planetId === undefined) {
    console.error(`[Solver] Unknown planet: ${transitPlanetName}`);
    return [];
  }

  const aspectAngle = ASPECT_ANGLES[aspectType];
  if (aspectAngle === undefined) {
    console.error(`[Solver] Unknown aspect type: ${aspectType}`);
    return [];
  }

  const events: ExactAspectEvent[] = [];
  const jdStart = yearStartJD(year);
  const jdEnd = yearEndJD(year);

  // Initialize ephemeris path
  const ephePath = path.join(process.cwd(), "node_modules", "swisseph", "ephe");
  swisseph.swe_set_ephe_path(ephePath);

  // Calculate both target points for the aspect
  // E.g., for trine (120°): natal + 120° and natal - 120°
  const targets = aspectAngle === 0
    ? [normalizeAngle(natalLongitude)]
    : aspectAngle === 180
      ? [normalizeAngle(natalLongitude + 180)]
      : [
          normalizeAngle(natalLongitude + aspectAngle),
          normalizeAngle(natalLongitude - aspectAngle),
        ];

  let passNumber = 1;

  for (const targetLongitude of targets) {
    let currentJD = jdStart;
    let prevPos = getPlanetPosition(planetId, currentJD);
    if (!prevPos) continue;

    let lastCrossingJD: number | null = null;

    while (currentJD < jdEnd) {
      const nextJD = currentJD + stepDays;
      const nextPos = getPlanetPosition(planetId, nextJD);
      if (!nextPos) {
        currentJD = nextJD;
        continue;
      }

      // Calculate distance from target at both points
      const prevDiff = angDiff(targetLongitude, prevPos.longitude);
      const nextDiff = angDiff(targetLongitude, nextPos.longitude);

      // Check for crossing (sign change in difference)
      if (prevDiff * nextDiff < 0 && Math.abs(prevDiff) < 90 && Math.abs(nextDiff) < 90) {
        // Binary search for exact crossing
        const valueFn: ValueFunction = (jd) => {
          const pos = getPlanetPosition(planetId, jd);
          if (!pos) return 0;
          return angDiff(targetLongitude, pos.longitude);
        };

        const exactJD = bracketAndSolve(valueFn, currentJD, nextJD, 0);

        if (exactJD !== null) {
          // Avoid duplicate detections (within 1 day of last)
          if (lastCrossingJD === null || Math.abs(exactJD - lastCrossingJD) > 1) {
            const exactPos = getPlanetPosition(planetId, exactJD);
            if (exactPos) {
              const isRetrograde = exactPos.speed < 0;

              events.push({
                julianDay: exactJD,
                timestamp: julianDayToDate(exactJD),
                longitude: exactPos.longitude,
                longitudeSpeed: exactPos.speed,
                transitPlanet: transitPlanetName,
                natalPlanet: natalPlanetName,
                natalLongitude,
                aspectType,
                aspectAngle,
                isRetrograde,
                passNumber: passNumber++,
              });

              lastCrossingJD = exactJD;
            }
          }
        }
      }

      prevPos = nextPos;
      currentJD = nextJD;
    }
  }

  // Sort by date
  events.sort((a, b) => a.julianDay - b.julianDay);

  // Renumber passes sequentially
  events.forEach((e, i) => {
    e.passNumber = i + 1;
  });

  return events;
}

// ============================================================================
// BATCH FUNCTIONS FOR YEAR GENERATION
// ============================================================================

/**
 * Generate all global astrology events for a year.
 * Called by cron job to populate global_astrology_events table.
 */
export function generateGlobalEventsForYear(year: number): {
  seasonIngresses: SeasonIngressEvent[];
  signIngresses: SignIngressEvent[];
  stations: StationEvent[];
} {
  console.log(`[Solver] Generating global events for year ${year}`);

  // Initialize ephemeris
  const ephePath = path.join(process.cwd(), "node_modules", "swisseph", "ephe");
  swisseph.swe_set_ephe_path(ephePath);

  // 1. Season ingresses (4 per year)
  const seasonIngresses = findSeasonIngresses(year);
  console.log(`[Solver] Found ${seasonIngresses.length} season ingresses`);

  // 2. All planet sign ingresses
  const allPlanets = Object.keys(PLANETS);
  const signIngresses: SignIngressEvent[] = [];
  for (const planet of allPlanets) {
    const ingresses = findSignIngresses(planet, year, planet === "Moon" ? 0.5 : 1);
    signIngresses.push(...ingresses);
  }
  console.log(`[Solver] Found ${signIngresses.length} sign ingresses`);

  // 3. All retrograde stations
  const stations: StationEvent[] = [];
  for (const planet of RETROGRADE_PLANETS) {
    const planetStations = findStations(planet, year);
    stations.push(...planetStations);
  }
  console.log(`[Solver] Found ${stations.length} stations`);

  // Cleanup
  swisseph.swe_close();

  return {
    seasonIngresses,
    signIngresses,
    stations,
  };
}

/**
 * Generate user-specific transit aspects for a year.
 * Called when generating yearly insight for a user.
 *
 * @param natalPlacements - User's natal chart placements
 * @param year - Year to calculate transits for
 * @param aspectTypes - Which aspects to find (default: major aspects)
 */
export function generateUserTransitsForYear(
  natalPlacements: Array<{ name: string; longitude: number }>,
  year: number,
  aspectTypes: (keyof typeof ASPECT_ANGLES)[] = ["conjunction", "opposition", "square", "trine", "sextile"]
): ExactAspectEvent[] {
  console.log(`[Solver] Generating user transits for year ${year}`);

  // Initialize ephemeris
  const ephePath = path.join(process.cwd(), "node_modules", "swisseph", "ephe");
  swisseph.swe_set_ephe_path(ephePath);

  const allAspects: ExactAspectEvent[] = [];

  // Outer planets transiting to natal positions
  // Focus on slow-moving planets for yearly significance
  const transitPlanets = ["Jupiter", "Saturn", "Uranus", "Neptune", "Pluto", "Chiron"];

  // Key natal points to check
  const keyNatalPoints = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];

  for (const transitPlanet of transitPlanets) {
    for (const natal of natalPlacements) {
      if (!keyNatalPoints.includes(natal.name)) continue;
      if (natal.longitude === null || natal.longitude === undefined) continue;

      for (const aspectType of aspectTypes) {
        const aspects = findExactAspects(
          transitPlanet,
          natal.longitude,
          natal.name,
          aspectType,
          year,
          1
        );
        allAspects.push(...aspects);
      }
    }
  }

  // Sort by date
  allAspects.sort((a, b) => a.julianDay - b.julianDay);

  // Cleanup
  swisseph.swe_close();

  console.log(`[Solver] Found ${allAspects.length} user transit aspects`);

  return allAspects;
}
