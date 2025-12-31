/**
 * Numerology Types
 *
 * Type definitions for the Solara numerology engine.
 * Supports both Pythagorean (default) and Chaldean systems.
 *
 * KEY CONCEPTS:
 * - Master Numbers (11, 22, 33): Special numbers that are NOT reduced
 * - Karmic Debt Numbers (13, 14, 16, 19): Indicate karmic lessons
 * - Core Numbers: Life Path, Expression, Soul Urge, Personality, Birthday, Maturity
 * - Cycle Numbers: Personal Year, Month, Day
 * - Pinnacles & Challenges: Four life periods with specific energies
 */

// ============================================================================
// SYSTEM TYPES
// ============================================================================

/**
 * Supported numerology systems
 * - pythagorean: Modern Western numerology (default)
 * - chaldean: Ancient Babylonian system (different letter values)
 */
export type NumerologySystem = "pythagorean" | "chaldean";

// ============================================================================
// NUMBER TYPES
// ============================================================================

/**
 * Master numbers that are preserved before reduction
 */
export type MasterNumber = 11 | 22 | 33;

/**
 * Karmic debt numbers that indicate karmic lessons
 */
export type KarmicDebtNumber = 13 | 14 | 16 | 19;

/**
 * A numerology number with optional master number preservation
 * - value: The final reduced value (1-9, 11, 22, or 33)
 * - master: The original master number if it was reduced (for display)
 */
export interface NumerologyNumber {
  value: number;
  master?: MasterNumber;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

/**
 * Input required to compute a numerology profile
 */
export interface NumerologyInput {
  birthDate: string; // ISO date string "YYYY-MM-DD"
  birthFirstName: string; // Legal first name at birth
  birthMiddleName?: string; // Legal middle name(s) at birth (optional)
  birthLastName: string; // Legal surname at birth
  system?: NumerologySystem; // Defaults to "pythagorean"
}

/**
 * Input for cycle calculations (requires current date)
 */
export interface CycleInput {
  birthDate: string; // ISO date string "YYYY-MM-DD"
  currentDate: string; // ISO date string for "now"
  lifePathNumber: number; // Pre-computed life path (for efficiency)
}

// ============================================================================
// CORE NUMBERS
// ============================================================================

/**
 * Core numerology numbers computed from birth date and name
 */
export interface CoreNumbers {
  /**
   * Life Path Number: The most important number, derived from birth date
   * Represents life purpose and the path one walks
   */
  lifePath: NumerologyNumber;

  /**
   * Birthday Number: Simply the day of birth (1-31, then reduced if >9)
   * Represents natural talents and abilities
   */
  birthday: NumerologyNumber;

  /**
   * Expression Number (Destiny): Full birth name converted to numbers
   * Represents natural abilities, personal goals, and what you're meant to do
   */
  expression: NumerologyNumber;

  /**
   * Soul Urge Number (Heart's Desire): Vowels in birth name only
   * Represents inner motivations, desires, and what truly drives you
   */
  soulUrge: NumerologyNumber;

  /**
   * Personality Number: Consonants in birth name only
   * Represents how others perceive you, your outer personality
   */
  personality: NumerologyNumber;

  /**
   * Maturity Number: Life Path + Expression, reduced
   * Represents who you're becoming, emerges around age 35-40
   */
  maturity: NumerologyNumber;
}

// ============================================================================
// CYCLE NUMBERS
// ============================================================================

/**
 * Personal cycles based on current date and life path
 */
export interface CycleNumbers {
  /**
   * Personal Year: Birth month + birth day + current year, reduced
   * 9-year cycle of growth and development
   */
  personalYear: number;

  /**
   * Personal Month: Personal year + current calendar month, reduced
   */
  personalMonth: number;

  /**
   * Personal Day: Personal month + current calendar day, reduced
   */
  personalDay: number;
}

// ============================================================================
// PINNACLES & CHALLENGES
// ============================================================================

/**
 * Four pinnacles representing major life periods
 * Each pinnacle has a number and the ages it spans
 */
export interface Pinnacles {
  first: {
    number: number;
    startAge: 0;
    endAge: number; // 36 - Life Path
  };
  second: {
    number: number;
    startAge: number;
    endAge: number; // First end + 9
  };
  third: {
    number: number;
    startAge: number;
    endAge: number; // Second end + 9
  };
  fourth: {
    number: number;
    startAge: number;
    endAge: null; // Rest of life
  };
}

/**
 * Four challenges representing obstacles to overcome in each life period
 * Challenges use subtraction rather than addition
 */
export interface Challenges {
  first: number;
  second: number;
  third: number;
  fourth: number; // Main challenge
}

// ============================================================================
// LUCKY NUMBERS
// ============================================================================

/**
 * Lucky numbers derived from core numerology (NOT random)
 */
export interface LuckyNumbers {
  /**
   * Primary lucky number (usually Life Path)
   */
  primary: number;

  /**
   * Secondary numbers derived from Expression, Soul Urge, etc.
   */
  secondary: number[];

  /**
   * All lucky numbers combined (3-5 numbers)
   */
  all: number[];
}

// ============================================================================
// KARMIC DEBT
// ============================================================================

/**
 * Karmic debt information
 */
export interface KarmicDebt {
  /**
   * Whether any karmic debt numbers were found
   */
  hasKarmicDebt: boolean;

  /**
   * Which karmic debt numbers were found (13, 14, 16, 19)
   */
  numbers: KarmicDebtNumber[];

  /**
   * Where each karmic debt number was found
   */
  sources: {
    number: KarmicDebtNumber;
    source: "lifePath" | "expression" | "soulUrge" | "personality" | "birthday";
  }[];
}

// ============================================================================
// FULL NUMEROLOGY PROFILE
// ============================================================================

/**
 * Complete numerology profile with all computed values
 * This is the "stone tablet" - computed once and stored
 */
export interface NumerologyProfile {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * User who owns this profile
   */
  userId: string;

  /**
   * Which numerology system was used
   */
  system: NumerologySystem;

  /**
   * Input data used for computation (for cache invalidation)
   */
  input: {
    birthDate: string;
    birthFirstName: string;
    birthMiddleName?: string;
    birthLastName: string;
  };

  /**
   * Core numbers (the main numerology calculations)
   */
  coreNumbers: CoreNumbers;

  /**
   * Pinnacles (four major life periods)
   */
  pinnacles: Pinnacles;

  /**
   * Challenges (obstacles for each life period)
   */
  challenges: Challenges;

  /**
   * Lucky numbers derived from core numbers
   */
  luckyNumbers: LuckyNumbers;

  /**
   * Karmic debt indicators
   */
  karmicDebt: KarmicDebt;

  /**
   * Version for cache invalidation
   */
  promptVersion: number;

  /**
   * Timestamps
   */
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// API TYPES
// ============================================================================

/**
 * Request to compute/retrieve numerology profile
 */
export interface NumerologyRequest {
  system?: NumerologySystem;
  forceRecompute?: boolean;
}

/**
 * Response from numerology API
 */
export interface NumerologyResponse {
  profile: NumerologyProfile;
  cycles: CycleNumbers;
  fromCache: boolean;
}

/**
 * Request for lucky numbers only (for Insights tab)
 */
export interface LuckyNumbersRequest {
  system?: NumerologySystem;
}

/**
 * Response with just lucky numbers
 */
export interface LuckyNumbersResponse {
  luckyNumbers: LuckyNumbers;
  fromCache: boolean;
}

// ============================================================================
// DATABASE TYPES (matching Supabase schema)
// ============================================================================

/**
 * Database row type for numerology_profiles table
 */
export interface NumerologyProfileRow {
  id: string;
  user_id: string;
  birth_date: string;
  birth_first_name: string;
  birth_middle_name: string | null;
  birth_last_name: string;
  system: NumerologySystem;

  // Core numbers
  life_path_number: number;
  life_path_master: number | null;
  birthday_number: number;
  expression_number: number;
  expression_master: number | null;
  soul_urge_number: number;
  soul_urge_master: number | null;
  personality_number: number;
  personality_master: number | null;
  maturity_number: number;
  maturity_master: number | null;

  // Pinnacles
  pinnacle_1: number;
  pinnacle_2: number;
  pinnacle_3: number;
  pinnacle_4: number;
  pinnacle_1_end_age: number;
  pinnacle_2_end_age: number;
  pinnacle_3_end_age: number;

  // Challenges
  challenge_1: number;
  challenge_2: number;
  challenge_3: number;
  challenge_4: number;

  // Lucky numbers
  lucky_numbers: number[];

  // Karmic debt
  has_karmic_debt: boolean;
  karmic_debt_numbers: number[] | null;

  // Metadata
  prompt_version: number;
  created_at: string;
  updated_at: string;
}
