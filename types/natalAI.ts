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
 * Joy Deep Dive - Part of Fortune interpretation
 * Generated once, stored forever (stone tablet)
 */
export type JoyDeepDive = {
  meaning: string;        // 2 paragraphs (separated by \n\n)
  aligned: string[];      // exactly 3 bullets
  offCourse: string[];    // exactly 3 bullets
  decisionRule: string;   // 1 sentence
  practice: string;       // 1 weekly ritual
  promptVersion: number;  // version for cache invalidation
};

/**
 * Container for all tab deep dives
 * Each tab's deep dive is optional and generated on-demand
 */
export type TabDeepDives = {
  joy?: JoyDeepDive;
  // Future: direction?, patterns?, intensity?, energy?
};
