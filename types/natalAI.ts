/**
 * Types for Natal AI Birth Chart Interpretation
 *
 * These types define the structure of data sent to OpenAI for birth chart
 * interpretation (Step B) and the structured response we expect back.
 *
 * NatalAIRequest = what we send to OpenAI
 * FullBirthChartInsight = what we receive from OpenAI
 */

// ============================================================================
// REQUEST TYPE (sent to OpenAI)
// ============================================================================

export type NatalAIRequest = {
  mode: "natal_full_profile";
  language: string; // e.g. "en"
  profile: {
    name?: string;
    zodiacSign?: string; // e.g. "Taurus"
  };
  birth: {
    date: string; // "YYYY-MM-DD"
    time: string | null; // "HH:MM"
    timezone: string; // IANA tz like "America/New_York"
    city: string | null;
    region: string | null;
    country: string | null;
    lat: number;
    lon: number;
  };
  currentLocation?: {
    city?: string;
    region?: string;
    country?: string;
    lat?: number;
    lon?: number;
    timezone?: string;
  };
  socialInsights?: {
    toneSummary?: string; // "reflective, family-focused, optimistic"
    postingPatterns?: string; // "most active late at night..."
    relationshipSignals?: string; // "values loyalty..."
    interests?: string[]; // ["astrology", "real estate", "parenting"]
  };
  placements: {
    system: "western_tropical_placidus";
    planets: Array<{
      name: string; // "Sun", "Moon", etc.
      sign: string; // "Taurus", "Gemini", etc.
      house: number | null; // 1-12 or null
      retrograde?: boolean;
    }>;
    houses: Array<{
      house: number; // 1-12
      signOnCusp: string; // "Capricorn", etc.
    }>;
    angles: {
      ascendant: { sign: string };
      midheaven: { sign: string };
      descendant: { sign: string };
      ic: { sign: string };
    };
    aspects?: Array<{
      between: string; // "Sun square Moon"
      type: "conjunction" | "sextile" | "square" | "trine" | "opposition";
      orb: number; // degrees off exact
    }>;
  };
};

// ============================================================================
// RESPONSE TYPE (received from OpenAI)
// ============================================================================

export type FullBirthChartInsight = {
  meta: {
    mode: "natal_full_profile";
    language: string;
  };
  coreSummary: {
    headline: string;
    overallVibe: string;
    bigThree: {
      sun: string;
      moon: string;
      rising: string;
    };
  };
  sections: {
    identity: string;
    emotions: string;
    loveAndRelationships: string;
    workAndMoney: string;
    purposeAndGrowth: string;
    innerWorld: string;
  };
  // Optional tab deep dives (generated separately, cached permanently)
  tabDeepDives?: TabDeepDives;
};

// ============================================================================
// TAB DEEP DIVES (personalized + actualized interpretations per tab)
// ============================================================================

/**
 * Generic Tab Deep Dive structure
 * Used for all Soul Print tabs with personalized AI interpretation
 * Generated once, stored forever (stone tablet)
 */
export type TabDeepDive = {
  meaning: string;        // 2 paragraphs (separated by \n\n)
  aligned: string[];      // exactly 3 bullets
  offCourse: string[];    // exactly 3 bullets
  decisionRule: string;   // 1 sentence
  promptVersion: number;  // version for cache invalidation
};

/**
 * Joy Deep Dive - Part of Fortune interpretation
 * @deprecated Use TabDeepDive instead. Kept for backwards compatibility.
 */
export type JoyDeepDive = TabDeepDive;

/**
 * Tab keys for all Soul Print deep dives
 */
export type TabDeepDiveKey =
  | "planetaryPlacements"
  | "houses"
  | "aspects"
  | "patterns"
  | "energyShape"
  | "intensityZones"
  | "direction"
  | "joy";

/**
 * Container for all tab deep dives
 * Each tab's deep dive is optional and generated on-demand
 * All generated in a single batched API call for efficiency
 */
export type TabDeepDives = {
  planetaryPlacements?: TabDeepDive;  // Sun, Moon, Rising, planets in signs/houses
  houses?: TabDeepDive;               // 12 houses and their meanings
  aspects?: TabDeepDive;              // Planetary aspects and patterns
  patterns?: TabDeepDive;             // Grand trines, T-squares, stelliums
  energyShape?: TabDeepDive;          // Element and modality balance
  intensityZones?: TabDeepDive;       // House emphasis and clusters
  direction?: TabDeepDive;            // North Node, South Node, life path
  joy?: TabDeepDive;                  // Part of Fortune
};
