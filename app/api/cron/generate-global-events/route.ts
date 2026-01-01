/**
 * Cron job to generate global astrology events for a year.
 *
 * Generates and stores:
 * - Season ingresses (equinoxes and solstices)
 * - Planet sign ingresses
 * - Retrograde stations
 *
 * Schedule: Run once per year (e.g., January 1st) or on-demand
 * Auth: x-cron-secret header must match CRON_SECRET env var
 *
 * Usage:
 *   # Generate for current year:
 *   curl -H "x-cron-secret: YOUR_SECRET" https://your-domain.com/api/cron/generate-global-events
 *
 *   # Generate for specific year:
 *   curl -H "x-cron-secret: YOUR_SECRET" https://your-domain.com/api/cron/generate-global-events?year=2026
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { generateGlobalEventsForYear } from "@/lib/ephemeris/solvers";

export async function GET(req: NextRequest) {
  // Auth: Check x-cron-secret header
  const cronSecret = req.headers.get("x-cron-secret");

  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    console.warn("[GlobalEvents] Unauthorized cron attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get year from query param or use current year
  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();

  if (isNaN(year) || year < 1900 || year > 2100) {
    return NextResponse.json(
      { error: "Invalid year parameter. Must be between 1900 and 2100." },
      { status: 400 }
    );
  }

  console.log(`[GlobalEvents] Starting generation for year ${year}...`);

  const stats = {
    year,
    seasonIngresses: 0,
    signIngresses: 0,
    stations: 0,
    inserted: 0,
    skippedDuplicate: 0,
    errors: 0,
  };

  try {
    const admin = createAdminSupabaseClient();

    // Check if events already exist for this year
    const { count: existingCount } = await admin
      .from("global_astrology_events")
      .select("*", { count: "exact", head: true })
      .eq("year", year);

    if (existingCount && existingCount > 0) {
      console.log(`[GlobalEvents] Year ${year} already has ${existingCount} events. Skipping generation.`);
      return NextResponse.json({
        message: `Year ${year} already has events generated`,
        existingCount,
        stats: { ...stats, skippedDuplicate: existingCount },
      });
    }

    // Generate all events using Swiss Ephemeris
    console.log(`[GlobalEvents] Generating events for year ${year}...`);
    const events = generateGlobalEventsForYear(year);

    stats.seasonIngresses = events.seasonIngresses.length;
    stats.signIngresses = events.signIngresses.length;
    stats.stations = events.stations.length;

    console.log(`[GlobalEvents] Found: ${stats.seasonIngresses} season ingresses, ${stats.signIngresses} sign ingresses, ${stats.stations} stations`);

    // Prepare rows for insertion
    const rows: Array<{
      year: number;
      event_type: string;
      planet: string;
      sign: string | null;
      event_time: string;
      julian_day: number;
      longitude: number;
      season_name: string | null;
    }> = [];

    // Season ingresses
    for (const event of events.seasonIngresses) {
      rows.push({
        year,
        event_type: "season_ingress",
        planet: "Sun",
        sign: event.sign,
        event_time: event.timestamp.toISOString(),
        julian_day: event.julianDay,
        longitude: event.longitude,
        season_name: event.season,
      });
    }

    // Sign ingresses (all planets)
    for (const event of events.signIngresses) {
      // Skip season ingresses for Sun (already added above)
      if (event.planet === "Sun" && ["Aries", "Cancer", "Libra", "Capricorn"].includes(event.sign)) {
        continue;
      }

      rows.push({
        year,
        event_type: "sign_ingress",
        planet: event.planet,
        sign: event.sign,
        event_time: event.timestamp.toISOString(),
        julian_day: event.julianDay,
        longitude: event.longitude,
        season_name: null,
      });
    }

    // Stations (retrograde and direct)
    for (const event of events.stations) {
      rows.push({
        year,
        event_type: event.stationType === "retrograde" ? "station_retrograde" : "station_direct",
        planet: event.planet,
        sign: event.sign,
        event_time: event.timestamp.toISOString(),
        julian_day: event.julianDay,
        longitude: event.longitude,
        season_name: null,
      });
    }

    console.log(`[GlobalEvents] Inserting ${rows.length} events...`);

    // Insert in batches to avoid hitting limits
    const BATCH_SIZE = 100;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error } = await admin
        .from("global_astrology_events")
        .insert(batch);

      if (error) {
        console.error(`[GlobalEvents] Insert error for batch ${i / BATCH_SIZE}:`, error.message);
        stats.errors++;
        // Continue with other batches
      } else {
        stats.inserted += batch.length;
      }
    }

    console.log(`[GlobalEvents] Generation complete:`, stats);

    return NextResponse.json({
      message: `Generated global events for year ${year}`,
      stats,
    });
  } catch (error: any) {
    console.error("[GlobalEvents] Generation failed:", error);
    return NextResponse.json(
      { error: "Generation failed", message: error.message, stats },
      { status: 500 }
    );
  }
}
