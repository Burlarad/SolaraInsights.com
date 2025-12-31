/**
 * Numerology AI Interpretation Types
 *
 * These types define the structure for AI-generated numerology interpretations.
 * Similar to TabDeepDive in natalAI.ts, these provide personalized insights
 * beyond the raw computed numbers.
 *
 * Stone tablet pattern: computed once per user, stored forever unless inputs change.
 */

// ============================================================================
// DEEP DIVE STRUCTURE (matches TabDeepDive pattern from natalAI.ts)
// ============================================================================

/**
 * Generic structure for a numerology deep dive interpretation
 * Used for all core numbers and cycles with personalized AI content
 */
export type NumerologyDeepDive = {
  meaning: string; // 2 paragraphs of personalized interpretation (separated by \n\n)
  aligned: string[]; // exactly 3 "when aligned" behaviors
  offCourse: string[]; // exactly 3 "when off course" behaviors
  decisionRule: string; // 1 actionable sentence for decision-making
};

// ============================================================================
// FULL NUMEROLOGY INSIGHT (all interpretations for a user)
// ============================================================================

/**
 * Complete AI-generated numerology insight for a user
 * Covers all core numbers, current cycles, and life periods
 */
export type NumerologyInsight = {
  // Core Numbers (6 total - the foundation of your numerology profile)
  lifePath: NumerologyDeepDive; // Your life purpose and path
  expression: NumerologyDeepDive; // Your natural abilities and talents
  soulUrge: NumerologyDeepDive; // Your inner motivations and desires
  personality: NumerologyDeepDive; // How others perceive you
  birthday: NumerologyDeepDive; // Your natural gifts
  maturity: NumerologyDeepDive; // Who you are becoming

  // Current Life Period
  currentPinnacle: NumerologyDeepDive; // Current pinnacle period interpretation
  currentChallenge: NumerologyDeepDive; // Current challenge interpretation

  // Current Cycles (dynamic - changes yearly/monthly/daily)
  personalYear: NumerologyDeepDive; // This year's theme and energy

  // Metadata
  promptVersion: number; // For cache invalidation
  createdAt: string; // ISO timestamp
};

// ============================================================================
// NUMEROLOGY INSIGHT ROW (database storage)
// ============================================================================

/**
 * Database row structure for numerology_insights table
 * (To be created when API is implemented)
 */
export type NumerologyInsightRow = {
  id: string;
  user_id: string;

  // Cache invalidation keys
  life_path_number: number;
  expression_number: number;
  soul_urge_number: number;
  personality_number: number;
  birthday_number: number;
  maturity_number: number;
  current_pinnacle_number: number;
  current_challenge_number: number;
  personal_year_number: number;
  system: "pythagorean" | "chaldean";

  // JSON blob of all interpretations
  interpretations: NumerologyInsight;

  // Metadata
  prompt_version: number;
  created_at: string;
  updated_at: string;
};

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Response from /api/numerology/interpret endpoint
 * (To be implemented)
 */
export type NumerologyInterpretResponse = {
  insight: NumerologyInsight;
  fromCache: boolean;
};

// ============================================================================
// DEEP DIVE KEYS (for individual fetches if needed)
// ============================================================================

/**
 * Keys for individual numerology deep dives
 */
export type NumerologyDeepDiveKey =
  | "lifePath"
  | "expression"
  | "soulUrge"
  | "personality"
  | "birthday"
  | "maturity"
  | "currentPinnacle"
  | "currentChallenge"
  | "personalYear";
