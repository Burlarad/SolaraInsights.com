/**
 * Step A: Generate birth chart placements (raw astro math)
 *
 * This function calls OpenAI to compute ONLY the placements:
 * - Sun, Moon, planets in signs + houses
 * - House cusps
 * - Angles (Ascendant/Rising, MC, Desc, IC)
 * - Major aspects
 *
 * NO interpretations are included. This is pure astrology math.
 * All math is done by OpenAI using Western tropical zodiac + Placidus houses.
 */

import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { BirthChartPlacements, BirthChartPlanetName } from "@/types";
import { inferTimezoneFromBirthplace } from "@/lib/timezone";

interface BirthData {
  birth_date: string;
  birth_time: string | null;
  birth_city: string;
  birth_region: string;
  birth_country: string;
  timezone: string;
  preferred_name?: string | null;
  full_name?: string | null;
}

/**
 * Validate placements structure (shape validation only, not astro math)
 */
function validatePlacements(placements: any): placements is BirthChartPlacements {
  // Check system
  if (placements.system !== "western_tropical_placidus") {
    console.error("[Placements] Invalid system:", placements.system);
    return false;
  }

  // Check blueprint exists
  if (!placements.blueprint || !placements.blueprint.birthDate) {
    console.error("[Placements] Missing blueprint");
    return false;
  }

  // Check planets array
  if (!Array.isArray(placements.planets) || placements.planets.length !== 12) {
    console.error("[Placements] Invalid planets array, expected 12, got:", placements.planets?.length);
    return false;
  }

  // Check all required planets are present
  const requiredPlanets: BirthChartPlanetName[] = [
    "Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter",
    "Saturn", "Uranus", "Neptune", "Pluto", "North Node", "Chiron"
  ];

  const planetNames = placements.planets.map((p: any) => p.name);
  const missingPlanets = requiredPlanets.filter(name => !planetNames.includes(name));

  if (missingPlanets.length > 0) {
    console.error("[Placements] Missing planets:", missingPlanets);
    return false;
  }

  // Check houses array
  if (!Array.isArray(placements.houses) || placements.houses.length !== 12) {
    console.error("[Placements] Invalid houses array, expected 12, got:", placements.houses?.length);
    return false;
  }

  // Check angles
  if (!placements.angles || !placements.angles.ascendant || !placements.angles.midheaven) {
    console.error("[Placements] Missing angles");
    return false;
  }

  // Check aspects
  if (!Array.isArray(placements.aspects)) {
    console.error("[Placements] Invalid aspects array");
    return false;
  }

  return true;
}

export async function generateBirthChartPlacements(
  birthData: BirthData
): Promise<BirthChartPlacements> {
  const locationString = `${birthData.birth_city}, ${birthData.birth_region}, ${birthData.birth_country}`;

  // ========================================
  // TIMEZONE COMPUTATION (civil timekeeping, not astrology)
  // ========================================

  // Determine the best timezone to use for birth chart calculations
  // Priority: 1) inferred from birthplace, 2) profile timezone (if not UTC), 3) UTC fallback

  let blueprintTimezone: string;
  let timezoneWasInferred = false;

  // Attempt timezone inference if profile timezone is missing or is UTC
  if ((!birthData.timezone || birthData.timezone === "UTC") &&
      birthData.birth_city && birthData.birth_country) {

    const inferred = inferTimezoneFromBirthplace(
      birthData.birth_city,
      birthData.birth_region,
      birthData.birth_country
    );

    if (inferred) {
      console.log(`[Placements] Inferred timezone ${inferred} from birthplace (profile had: ${birthData.timezone || "empty"})`);
      blueprintTimezone = inferred;
      timezoneWasInferred = true;
    } else {
      console.warn(`[Placements] WARNING: Could not infer timezone for birthplace "${birthData.birth_city}, ${birthData.birth_region}, ${birthData.birth_country}". Falling back to UTC.`);
      blueprintTimezone = "UTC";
    }
  } else {
    // Use profile timezone as-is (it's not empty and not UTC)
    blueprintTimezone = birthData.timezone;
    timezoneWasInferred = false;
  }

  // System prompt: focused on placements math only (GPT-5.1)
  const systemPrompt = `You are the natal chart placements engine for Solara Insights.

Your ONLY job is to compute *astrological placements* for a birth chart and return them as a JSON object that matches the BirthChartPlacements schema. You must NOT write interpretations, advice, or commentary. You must NOT output markdown or code fences.

ASTROLOGY SYSTEM (REQUIRED):
- Zodiac: Western tropical (NOT sidereal).
- House system: Placidus (time-sensitive, quadrant-based).
- Angles: Ascendant is the 1st house cusp; Midheaven is the 10th house cusp.
- Aspects: Optional. If included, use only major aspects: conjunction, opposition, trine, square, sextile.

INPUT:
- You receive a single user message with:
  - birth_date: YYYY-MM-DD
  - birth_time: HH:MM (local civil time at birthplace, NOT UTC)
  - timezone: IANA timezone string (e.g. "America/New_York")
  - birth_city, birth_region, birth_country
  - A description of the expected BirthChartPlacements JSON structure.
- Treat the input as accurate for Western tropical + Placidus calculations.

OUTPUT CONTRACT (BirthChartPlacements):
You MUST output a single JSON object with exactly these top-level keys:

{
  "system": "western_tropical_placidus",
  "blueprint": {
    "birthDate": "<YYYY-MM-DD>",
    "birthTime": "<HH:MM or null>",
    "birthLocation": "<City, Region, Country>",
    "timezone": "<IANA timezone>",
    "timezoneWasInferred": <true or false, if provided>
  },
  "planets": [
    {
      "name": "<PlanetName>",
      "sign": "<SignName>",
      "house": <1-12 or omitted if unknown>
    }
    // Include at least: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, North Node, Chiron
  ],
  "houses": [
    {
      "house": <1-12>,
      "signOnCusp": "<SignName>"
    }
  ],
  "angles": {
    "ascendant": { "sign": "<SignName>" },
    "midheaven": { "sign": "<SignName>" },
    "descendant": { "sign": "<SignName>" },
    "ic": { "sign": "<SignName>" }
  },
  "aspects": [
    {
      "between": "<Planet A> <aspect> <Planet B>",
      "type": "conjunction" | "opposition" | "trine" | "square" | "sextile"
    }
  ]
}

RULES:
- Focus on assigning consistent signs and houses according to Western tropical + Placidus.
- The Sun, Moon, and Ascendant are the three most important placements and should be computed carefully.
- Do NOT invent extra top-level keys.
- Do NOT include degrees, or any natural language explanations; only the JSON fields described above.
- Do NOT output any text outside of the JSON object.`;

  // User prompt: just the birth data and JSON structure
  const userPrompt = `Compute the natal chart placements for this person using the system described above.

Birth details (ALL of these are critical for accurate Sun, Moon, and Rising calculations):
- Birth date: ${birthData.birth_date} (YYYY-MM-DD format)
- Local birth time: ${birthData.birth_time || "unknown"} (this is the time at the birthplace in the local timezone, NOT UTC)
- Birthplace city: ${birthData.birth_city}
- Birthplace region/state: ${birthData.birth_region}
- Birthplace country: ${birthData.birth_country}
- Full location string: ${locationString}
- Timezone at birth: ${blueprintTimezone} (IANA timezone for the birthplace at the time of birth)

IMPORTANT: You must use the COMPLETE birthplace (city + region/state + country) to determine the correct geographic location on Earth. This is essential for calculating the Rising sign (Ascendant) and house cusps accurately using the Placidus system.

${
  !birthData.birth_time
    ? "NOTE: Birth time is unknown, so use a solar chart approach (Sun on the Ascendant, equal houses from the Sun). Houses and angles will be approximate/less precise."
    : ""
}

Return ONLY a JSON object with this EXACT structure:

{
  "system": "western_tropical_placidus",
  "blueprint": {
    "birthDate": "${birthData.birth_date}",
    "birthTime": ${birthData.birth_time ? `"${birthData.birth_time}"` : "null"},
    "birthLocation": "${locationString}",
    "timezone": "${blueprintTimezone}"
  },
  "planets": [
    // Array of EXACTLY 12 objects for: Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, North Node, Chiron
    // Each object: { "name": "Sun", "sign": "Taurus", "house": 10 }
    // Sun and Moon MUST always be included with accurate signs calculated using Western tropical zodiac.
    // If birth time is known, include "house" field (1-12) for each planet (calculated using Placidus houses).
    // If birth time unknown, omit "house" field for each planet.
    // The Sun, Moon, and Ascendant are the three most important placements and MUST be computed correctly.
  ],
  "houses": [
    // Array of EXACTLY 12 objects for houses 1 through 12
    // Each object: { "house": 1, "signOnCusp": "Gemini" }
    // Use Placidus house system when birth time is known.
    // Use equal houses from Sun when birth time is unknown.
  ],
  "angles": {
    "ascendant": { "sign": "Gemini" },
    "midheaven": { "sign": "Aquarius" },
    "descendant": { "sign": "Sagittarius" },
    "ic": { "sign": "Leo" }
    // The ascendant.sign is the Rising sign and MUST be computed from the birth date, local birth time, birthplace (city + region/state + country), and timezone using Western tropical + Placidus.
    // When birth time is known, calculate the exact Ascendant sign based on the time and location.
    // When birth time is unknown, use Sun's sign as Ascendant sign (solar chart).
  },
  "aspects": [
    // Array of 5-7 most important major aspects
    // Each object: { "between": "Sun square Moon", "type": "square" }
    // Valid types: "conjunction", "opposition", "trine", "square", "sextile"
  ]
}

Sun, Moon, and Ascendant (Rising) MUST be computed correctly according to the Western tropical zodiac and Placidus system for the given birth date, local time, birthplace, and timezone.`;

  try {
    console.log(`[Placements] Generating placements for ${birthData.birth_date} at ${birthData.birth_time || "unknown time"}...`);

    // GPT-5.1 reasoning parameter not yet in OpenAI SDK types, so we use type assertion
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODELS.placements, // gpt-5.1
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      reasoning: { effort: "low" }, // GPT-5.1 reasoning for stability (no temperature when using reasoning)
      response_format: { type: "json_object" },
    } as any);

    const responseContent = completion.choices[0]?.message?.content;

    if (!responseContent) {
      throw new Error("No response from OpenAI for placements");
    }

    // Parse JSON
    let placements: any;
    try {
      placements = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("[Placements] Failed to parse OpenAI response:", responseContent);
      throw new Error("Invalid JSON response from placements generator");
    }

    // Validate structure
    if (!validatePlacements(placements)) {
      console.error("[Placements] Validation failed. Raw response:", JSON.stringify(placements, null, 2));
      throw new Error("Placements validation failed - structure is incorrect");
    }

    // ========================================
    // FORCE THE CORRECT TIMEZONE IN BLUEPRINT
    // ========================================
    // OpenAI should echo our timezone, but we enforce it to be certain
    placements.blueprint.timezone = blueprintTimezone;
    placements.blueprint.timezoneWasInferred = timezoneWasInferred;

    console.log(`[Placements] Successfully generated placements. Sun: ${placements.planets.find((p: any) => p.name === "Sun")?.sign}, Moon: ${placements.planets.find((p: any) => p.name === "Moon")?.sign}, Rising: ${placements.angles.ascendant.sign}, Timezone: ${blueprintTimezone}${timezoneWasInferred ? " (inferred)" : ""}`);

    return placements as BirthChartPlacements;
  } catch (error: any) {
    console.error("[Placements] Error generating placements:", error);
    throw error;
  }
}
