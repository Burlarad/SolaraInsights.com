/**
 * Year Tab Context Builder
 *
 * Builds the astrological context for yearly insights by:
 * 1. Loading global astrology events for the year
 * 2. Computing user-specific transit aspects
 * 3. Formatting as context for the AI prompt
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { generateUserTransitsForYear, ExactAspectEvent } from "@/lib/ephemeris/solvers";

// ============================================================================
// TYPES
// ============================================================================

export type GlobalEvent = {
  id: string;
  year: number;
  event_type: string;
  planet: string;
  sign: string | null;
  event_time: string;
  julian_day: number;
  longitude: number;
  season_name: string | null;
};

export type YearContext = {
  globalEvents: GlobalEvent[];
  seasonIngresses: GlobalEvent[];
  majorIngresses: GlobalEvent[];
  stations: GlobalEvent[];
  userTransits: ExactAspectEvent[];
  formattedContext: string;
};

// ============================================================================
// GLOBAL EVENTS LOADER
// ============================================================================

/**
 * Load global astrology events for a year from the database.
 */
export async function loadGlobalEvents(
  supabase: SupabaseClient,
  year: number
): Promise<GlobalEvent[]> {
  const { data, error } = await supabase
    .from("global_astrology_events")
    .select("*")
    .eq("year", year)
    .order("event_time", { ascending: true });

  if (error) {
    console.error(`[YearContext] Failed to load global events:`, error.message);
    return [];
  }

  return data || [];
}

// ============================================================================
// USER TRANSITS GENERATOR
// ============================================================================

/**
 * Generate user-specific transit aspects for a year.
 * Uses natal chart positions to find exact aspects from slow-moving transits.
 */
export function generateUserTransits(
  natalPlacements: Array<{ name: string; longitude: number | null }>,
  year: number
): ExactAspectEvent[] {
  // Filter out placements without longitude
  const validPlacements = natalPlacements
    .filter((p) => p.longitude !== null && p.longitude !== undefined)
    .map((p) => ({ name: p.name, longitude: p.longitude as number }));

  if (validPlacements.length === 0) {
    console.warn("[YearContext] No valid natal placements for transit calculation");
    return [];
  }

  return generateUserTransitsForYear(validPlacements, year);
}

// ============================================================================
// CONTEXT FORMATTER
// ============================================================================

/**
 * Format global events and user transits into AI prompt context.
 */
export function formatYearContext(
  globalEvents: GlobalEvent[],
  userTransits: ExactAspectEvent[],
  year: number
): string {
  const lines: string[] = [];

  // Header
  lines.push(`YEAR ${year} ASTROLOGICAL CONTEXT:`);
  lines.push("");

  // Season ingresses (equinoxes and solstices)
  const seasons = globalEvents.filter((e) => e.event_type === "season_ingress");
  if (seasons.length > 0) {
    lines.push("SEASONAL MARKERS:");
    for (const s of seasons) {
      const date = new Date(s.event_time).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      });
      const seasonLabel = s.season_name
        ? s.season_name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        : `Sun enters ${s.sign}`;
      lines.push(`  - ${date}: ${seasonLabel}`);
    }
    lines.push("");
  }

  // Major planet ingresses (Jupiter, Saturn, Uranus, Neptune, Pluto)
  const majorPlanets = ["Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"];
  const majorIngresses = globalEvents.filter(
    (e) => e.event_type === "sign_ingress" && majorPlanets.includes(e.planet)
  );
  if (majorIngresses.length > 0) {
    lines.push("MAJOR PLANETARY SHIFTS:");
    for (const i of majorIngresses) {
      const date = new Date(i.event_time).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      });
      lines.push(`  - ${date}: ${i.planet} enters ${i.sign}`);
    }
    lines.push("");
  }

  // Retrograde stations
  const stations = globalEvents.filter(
    (e) => e.event_type === "station_retrograde" || e.event_type === "station_direct"
  );
  if (stations.length > 0) {
    lines.push("RETROGRADE CYCLES:");
    // Group by planet
    const byPlanet: Record<string, GlobalEvent[]> = {};
    for (const s of stations) {
      if (!byPlanet[s.planet]) byPlanet[s.planet] = [];
      byPlanet[s.planet].push(s);
    }

    for (const planet of Object.keys(byPlanet).sort()) {
      const planetStations = byPlanet[planet].sort(
        (a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime()
      );

      const stationDescriptions = planetStations.map((s) => {
        const date = new Date(s.event_time).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        const type = s.event_type === "station_retrograde" ? "Rx" : "D";
        return `${date} (${type} in ${s.sign})`;
      });

      lines.push(`  - ${planet}: ${stationDescriptions.join(" → ")}`);
    }
    lines.push("");
  }

  // User-specific major transits
  if (userTransits.length > 0) {
    lines.push("PERSONAL TRANSITS (exact aspects to your natal chart):");

    // Group by transit planet and aspect
    const grouped: Record<string, ExactAspectEvent[]> = {};
    for (const t of userTransits) {
      const key = `${t.transitPlanet} ${t.aspectType} natal ${t.natalPlanet}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(t);
    }

    // Show most significant transits (limit to 10 for prompt size)
    const sortedKeys = Object.keys(grouped)
      .sort((a, b) => {
        // Prioritize slower planets
        const planetOrder: Record<string, number> = {
          Pluto: 1,
          Neptune: 2,
          Uranus: 3,
          Saturn: 4,
          Jupiter: 5,
          Chiron: 6,
        };
        const planetA = a.split(" ")[0];
        const planetB = b.split(" ")[0];
        return (planetOrder[planetA] || 10) - (planetOrder[planetB] || 10);
      })
      .slice(0, 10);

    for (const key of sortedKeys) {
      const events = grouped[key];
      const dates = events.map((e) => {
        const date = e.timestamp.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        const retroLabel = e.isRetrograde ? " (Rx)" : "";
        return `${date}${retroLabel}`;
      });

      lines.push(`  - ${key}: ${dates.join(", ")}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ============================================================================
// MAIN CONTEXT BUILDER
// ============================================================================

/**
 * Build the complete year context for AI prompt generation.
 *
 * @param supabase - Supabase client for database access
 * @param year - Year to generate context for
 * @param natalPlacements - User's natal chart placements (optional, for personal transits)
 * @returns YearContext with formatted string for AI prompt
 */
export async function buildYearContext(
  supabase: SupabaseClient,
  year: number,
  natalPlacements?: Array<{ name: string; longitude: number | null }>
): Promise<YearContext> {
  console.log(`[YearContext] Building context for year ${year}`);

  // Load global events
  const globalEvents = await loadGlobalEvents(supabase, year);
  console.log(`[YearContext] Loaded ${globalEvents.length} global events`);

  // Categorize events
  const seasonIngresses = globalEvents.filter((e) => e.event_type === "season_ingress");
  const majorIngresses = globalEvents.filter(
    (e) =>
      e.event_type === "sign_ingress" &&
      ["Jupiter", "Saturn", "Uranus", "Neptune", "Pluto"].includes(e.planet)
  );
  const stations = globalEvents.filter(
    (e) => e.event_type === "station_retrograde" || e.event_type === "station_direct"
  );

  // Generate user transits if natal placements provided
  let userTransits: ExactAspectEvent[] = [];
  if (natalPlacements && natalPlacements.length > 0) {
    try {
      userTransits = generateUserTransits(natalPlacements, year);
      console.log(`[YearContext] Generated ${userTransits.length} user transit aspects`);
    } catch (transitError) {
      console.error("[YearContext] Failed to generate user transits:", transitError);
      // Continue without user transits
    }
  }

  // Format context for AI prompt
  const formattedContext = formatYearContext(globalEvents, userTransits, year);

  return {
    globalEvents,
    seasonIngresses,
    majorIngresses,
    stations,
    userTransits,
    formattedContext,
  };
}

/**
 * Check if global events exist for a year.
 * Returns true if events are available, false if cron hasn't run yet.
 */
export async function hasGlobalEventsForYear(
  supabase: SupabaseClient,
  year: number
): Promise<boolean> {
  const { count, error } = await supabase
    .from("global_astrology_events")
    .select("*", { count: "exact", head: true })
    .eq("year", year);

  if (error) {
    console.error(`[YearContext] Failed to check global events:`, error.message);
    return false;
  }

  return (count || 0) > 0;
}
