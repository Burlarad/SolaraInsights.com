import { NextRequest, NextResponse } from "next/server";
import { generateBirthChartPlacements } from "../../birth-chart/generatePlacements";

/**
 * DEV-ONLY: Test birth chart placements (Step A) endpoint
 *
 * This endpoint allows you to inspect what Step A returns for any birth data,
 * WITHOUT going through Step B (interpretation).
 *
 * Usage:
 * GET /api/dev/test-birth-chart?birth_date=1992-05-04&birth_time=23:50&birth_city=Fredericksburg&birth_region=Virginia&birth_country=United%20States&timezone=America/New_York
 *
 * Returns:
 * {
 *   "summary": {
 *     "sun": { "sign": "Taurus", "house": 5 },
 *     "moon": { "sign": "Gemini", "house": 6 },
 *     "rising": { "sign": "Capricorn" }
 *   },
 *   "planets": [...],
 *   "houses": [...],
 *   "angles": {...}
 * }
 */
export async function GET(req: NextRequest) {
  try {
    console.log("[DEV] Test birth chart placements endpoint called");

    // Extract query parameters
    const searchParams = req.nextUrl.searchParams;
    const birth_date = searchParams.get("birth_date");
    const birth_time = searchParams.get("birth_time") || null;
    const birth_city = searchParams.get("birth_city");
    const birth_region = searchParams.get("birth_region");
    const birth_country = searchParams.get("birth_country");
    const timezone = searchParams.get("timezone") || "UTC";

    // Validate required parameters
    if (!birth_date || !birth_city || !birth_region || !birth_country) {
      return NextResponse.json(
        {
          error: "Missing required parameters",
          message: "Required: birth_date, birth_city, birth_region, birth_country. Optional: birth_time, timezone",
          example: "/api/dev/test-birth-chart?birth_date=1992-05-04&birth_time=23:50&birth_city=Fredericksburg&birth_region=Virginia&birth_country=United%20States&timezone=America/New_York"
        },
        { status: 400 }
      );
    }

    console.log(`[DEV] Testing placements for: ${birth_date} ${birth_time || "unknown time"} at ${birth_city}, ${birth_region}, ${birth_country} (${timezone})`);

    // Construct birth data object
    const birthData = {
      birth_date,
      birth_time,
      birth_city,
      birth_region,
      birth_country,
      timezone,
      preferred_name: "DevTest",
      full_name: "Dev Test User"
    };

    // Call Step A directly
    const placements = await generateBirthChartPlacements(birthData);

    // Extract sun, moon, rising for summary
    const sun = placements.planets.find(p => p.name === "Sun");
    const moon = placements.planets.find(p => p.name === "Moon");
    const rising = placements.angles.ascendant;

    // Build response
    const response = {
      summary: {
        sun: {
          sign: sun?.sign || "unknown",
          house: sun?.house || null
        },
        moon: {
          sign: moon?.sign || "unknown",
          house: moon?.house || null
        },
        rising: {
          sign: rising.sign
        }
      },
      planets: placements.planets,
      houses: placements.houses,
      angles: placements.angles,
      blueprint: placements.blueprint
    };

    console.log(`[DEV] Placements generated - Sun: ${sun?.sign}, Moon: ${moon?.sign}, Rising: ${rising.sign}`);

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("[DEV] Error generating test birth chart:", error);
    return NextResponse.json(
      {
        error: "Generation failed",
        message: error.message || "Failed to generate placements",
        details: error.toString()
      },
      { status: 500 }
    );
  }
}
