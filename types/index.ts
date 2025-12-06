// ============================================================================
// PROFILE & USER TYPES
// ============================================================================

export interface Profile {
  id: string; // uuid, references auth.users.id
  full_name: string | null;
  preferred_name: string | null;
  email: string;
  birth_date: string | null; // ISO date string
  birth_time: string | null; // HH:MM format
  birth_city: string | null;
  birth_region: string | null;
  birth_country: string | null;
  timezone: string;
  zodiac_sign: string | null;
  language: string;
  created_at: string;
  updated_at: string;

  // Onboarding
  is_onboarded: boolean;
  onboarding_started_at: string | null;
  onboarding_completed_at: string | null;

  // Stripe / Membership
  membership_plan: "none" | "individual" | "family";
  is_comped: boolean;
  role: "user" | "admin";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: "active" | "canceled" | "past_due" | "trialing" | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;

  // Charity tracking (for future)
  location_for_charity: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface ProfileUpdate {
  full_name?: string | null;
  preferred_name?: string | null;
  birth_date?: string | null;
  birth_time?: string | null;
  birth_city?: string | null;
  birth_region?: string | null;
  birth_country?: string | null;
  timezone?: string;
  zodiac_sign?: string | null;
  language?: string;
}

// ============================================================================
// API REQUEST TYPES
// ============================================================================

export type Timeframe = "today" | "week" | "month" | "year";

export interface InsightsRequest {
  timeframe: Timeframe;
  focusQuestion?: string;
}

export interface PublicHoroscopeRequest {
  sign: string; // "Aries", "Taurus", etc.
  timeframe: "today" | "week" | "month";
  timezone: string; // IANA timezone, e.g., "America/New_York"
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface SanctuaryInsight {
  personalNarrative: string;
  emotionalCadence: {
    dawn: string;
    midday: string;
    dusk: string;
  };
  coreThemes: string[]; // Short phrases
  focusForPeriod: string; // "Focus for today / this week / etc."
  tarot: {
    cardName: string;
    arcanaType: string; // e.g. "Major Arcana"
    summary: string;
    symbolism: string;
    guidance: string;
  };
  rune: {
    name: string;
    keyword: string;
    meaning: string;
    affirmation: string;
  };
  luckyCompass: {
    numbers: {
      value: number;
      label: string;
      meaning: string;
    }[];
    powerWords: string[]; // For the chips
    handwrittenNote: string; // 1–2 sentence affirmation
  };
  journalPrompt: string; // For the Daily Reflection textbox
}

export interface BirthChartInsight {
  coreIdentity: string;
  emotionalLandscape: string;
  relationalPatterns: string;
  growthEdgesAndGifts: string;
}

// ============================================================================
// FULL BIRTH CHART TYPES
// ============================================================================

export interface BirthChartBlueprint {
  birthDate: string; // ISO date
  birthTime: string | null; // HH:MM or null if unknown
  birthLocation: string; // "City, Region, Country"
  timezone: string;
}

export interface BirthChartPlanet {
  name: string; // "Sun", "Moon", etc.
  sign: string; // "Taurus", "Leo", etc.
  house?: string; // e.g. "10th house" (optional)
  description: string; // 2–4 sentences about what this placement means
}

export interface BirthChartHouse {
  house: string; // "1st", "2nd", etc.
  signOnCusp: string; // "Gemini", etc.
  themes: string; // key life themes for this house in this chart
}

export interface BirthChartAngles {
  ascendant: {
    sign: string;
    description: string;
  };
  midheaven: {
    sign: string;
    description: string;
  };
  descendant: {
    sign: string;
    description: string;
  };
  ic: {
    sign: string;
    description: string;
  };
}

export interface BirthChartAspect {
  between: string; // "Sun square Moon"
  type: string; // "conjunction" | "square" | etc.
  impact: string; // what this aspect does psychologically
}

export interface BirthChartPatterns {
  elements: {
    fire: number;
    earth: number;
    air: number;
    water: number;
    summary: string; // 1–2 paragraphs explaining the element balance
  };
  modalities: {
    cardinal: number;
    fixed: number;
    mutable: number;
    summary: string; // explanation of their mode balance
  };
  chartRuler: {
    planet: string; // e.g. "Venus"
    sign: string;
    house: string;
    description: string; // how this colors the whole chart
  };
  majorThemes: string; // 2–4 paragraphs synthesizing the big themes
}

/**
 * Full birth chart insight used by the Sanctuary Birth Chart tab.
 */
export interface FullBirthChartInsight {
  blueprint: BirthChartBlueprint;
  planets: BirthChartPlanet[];
  houses: BirthChartHouse[];
  angles: BirthChartAngles;
  aspects: BirthChartAspect[];
  patterns: BirthChartPatterns;
}

export interface PublicHoroscopeResponse {
  title: string; // e.g. "Today's Energy for Taurus"
  summary: string; // 2–3 paragraphs max
  keyThemes: string[]; // Optional bullet points
}

// ============================================================================
// CONNECTIONS TYPES
// ============================================================================

export interface Connection {
  id: string;
  owner_user_id: string;
  linked_profile_id: string | null;
  name: string;
  relationship_type: string;
  birth_date: string | null; // ISO date string
  birth_time: string | null; // HH:MM format
  birth_city: string | null;
  birth_region: string | null;
  birth_country: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConnectionInsight {
  overview: string;
  emotionalDynamics: string;
  communication: string;
  careSuggestions: string;
}

// ============================================================================
// SOCIAL CONNECTIONS TYPES
// ============================================================================

export type SocialProvider = "facebook" | "reddit" | "tiktok" | "x";

export interface SocialConnection {
  id: string;
  user_id: string;
  provider: SocialProvider;
  provider_user_id: string | null;
  handle: string | null;
  connected_at: string;
  updated_at: string;
}

export interface SocialSummary {
  id: string;
  user_id: string;
  provider: SocialProvider;
  summary: string;
  last_collected_at: string;
}

// ============================================================================
// ERROR RESPONSE
// ============================================================================

export interface ApiError {
  error: string;
  message: string;
  code?: string;
}
