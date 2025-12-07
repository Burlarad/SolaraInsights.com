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

  // System prompt: focused on placements math only
  const systemPrompt = `You are an astrologer for Solara Insights.

ASTROLOGICAL SYSTEM TO USE (THIS IS REQUIRED, DO NOT IGNORE):

- Zodiac: Western tropical (NOT sidereal). Aries begins at 0° on the March equinox.
- House system: Placidus (time-sensitive, quadrant-based).
- Aspects: Use major aspects only: conjunction, opposition, trine, square, sextile.
- Aspect orbs (approximate): conjunction ±8°, opposition ±8°, trine ±6°, square ±7°, sextile ±6°.
- Birthplace matters: City, region/state, and country are ALL critically important and must be used together to locate the correct place on Earth for house and rising sign calculations.
- Rising sign (Ascendant):
  - When birth time is known, you MUST compute the Ascendant from the local birth time, birthplace (city + region/state + country), and timezone using Western tropical + Placidus.
  - The Ascendant's sign is the Rising sign and must be consistent with the chart's time and location.
  - The Rising sign is one of the three most important placements (Sun, Moon, Rising) and must be accurate.
- Unknown birth time:
  - Use a solar chart approach (Sun on the Ascendant, equal houses from the Sun).
  - Be explicit in your reasoning that houses and angles are approximate when time is unknown.

You are responsible ONLY for computing placements. Do not write long descriptions or interpretations.
You must respond with ONLY valid JSON matching the BirthChartPlacements structure. No additional text, no markdown, no explanations—just the JSON object.`;

  // User prompt: just the birth data and JSON structure
  const userPrompt = `Compute the natal chart placements for this person using the system described above.

Birth details (ALL of these are critical for accurate Sun, Moon, and Rising calculations):
- Birth date: ${birthData.birth_date} (YYYY-MM-DD format)
- Local birth time: ${birthData.birth_time || "unknown"} (this is the time at the birthplace in the local timezone, NOT UTC)
- Birthplace city: ${birthData.birth_city}
- Birthplace region/state: ${birthData.birth_region}
- Birthplace country: ${birthData.birth_country}
- Full location string: ${locationString}
- Timezone at birth: ${birthData.timezone} (IANA timezone for the birthplace at the time of birth)

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
    "timezone": "${birthData.timezone}"
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

    const completion = await openai.chat.completions.create({
      model: OPENAI_MODELS.placements,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0, // Deterministic for placements
      response_format: { type: "json_object" },
    });

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

    console.log(`[Placements] Successfully generated placements. Sun: ${placements.planets.find((p: any) => p.name === "Sun")?.sign}, Moon: ${placements.planets.find((p: any) => p.name === "Moon")?.sign}, Rising: ${placements.angles.ascendant.sign}`);

    return placements as BirthChartPlacements;
  } catch (error: any) {
    console.error("[Placements] Error generating placements:", error);
    throw error;
  }
}
