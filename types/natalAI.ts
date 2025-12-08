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
    time: string; // "HH:MM"
    timezone: string; // IANA tz like "America/New_York"
    city: string;
    region: string;
    country: string;
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
    headline: string; // 1-2 sentence headline
    bigThree: {
      sun: string; // e.g. "Sun in Taurus (4th house)"
      moon: string; // e.g. "Moon in Gemini (6th house)"
      rising: string; // e.g. "Capricorn Rising"
    };
    overallVibe: string; // a short summary paragraph
  };
  sections: {
    identity: string; // paragraphs
    emotions: string; // paragraphs
    loveAndRelationships: string; // paragraphs
    workAndMoney: string; // paragraphs
    purposeAndGrowth: string; // paragraphs
    innerWorld: string; // paragraphs
  };
  planetInsights?: Array<{
    name: string; // "Sun", "Moon", etc.
    sign: string; // "Taurus"
    house: number | null; // 1-12 or null
    summary: string; // 2-4 sentences
  }>;
  houseInsights?: Array<{
    house: number; // 1-12
    signOnCusp: string; // "Capricorn"
    summary: string; // 2-4 sentences
  }>;
  angleInsights?: {
    ascendant: string; // interpretation of Rising
    midheaven: string; // interpretation of MC
    descendant: string; // interpretation of Desc
    ic: string; // interpretation of IC
  };
  aspectInsights?: {
    summary?: string; // overview of key aspects
    aspects?: Array<{
      between: string; // "Sun square Moon"
      type: "conjunction" | "sextile" | "square" | "trine" | "opposition";
      interpretation: string;
    }>;
  };
};

// Types are already exported above with export type declarations
