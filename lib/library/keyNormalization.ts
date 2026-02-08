/**
 * Key Normalization for Library Book Model
 *
 * Provides deterministic key generation for global library deduplication.
 *
 * CRITICAL RULES:
 * 1. Same inputs MUST produce same key (deterministic)
 * 2. Different inputs MUST produce different keys (no collisions)
 * 3. Include engine/config version in key (allows cache invalidation)
 * 4. Normalization must be consistent across all code paths
 */

import { createHash } from "crypto";

// ============================================================================
// CHART KEY NORMALIZATION
// ============================================================================

/**
 * Chart engine configuration version
 * Increment this when changing:
 * - House system
 * - Zodiac mode (tropical/sidereal)
 * - SwissPlacements schema
 * - Any aspect calculation logic
 */
export const CHART_ENGINE_VERSION = {
  houseSystem: "placidus",
  zodiac: "tropical",
  schemaVersion: 8, // Matches BIRTH_CHART_SCHEMA_VERSION
};

export type ChartInput = {
  birth_date: string; // "YYYY-MM-DD"
  birth_time: string; // "HH:MM" - MUST be present, NO null
  birth_lat: number; // Decimal degrees
  birth_lon: number; // Decimal degrees
  timezone: string; // IANA timezone
};

/**
 * Normalize birth inputs for consistent hashing
 *
 * Rules:
 * - birth_date: YYYY-MM-DD format (no time component)
 * - birth_time: HH:MM format (24-hour, zero-padded)
 * - birth_lat: Round to 6 decimal places (~0.1m precision)
 * - birth_lon: Round to 6 decimal places (~0.1m precision)
 * - timezone: Exact IANA string (case-sensitive)
 */
export function normalizeChartInput(input: ChartInput): ChartInput {
  // Validate required fields
  if (!input.birth_date || !input.birth_time || input.birth_lat === null || input.birth_lon === null || !input.timezone) {
    throw new Error("All birth fields required for chart computation (no noon defaulting)");
  }

  // Normalize birth_date (ensure YYYY-MM-DD format)
  const dateMatch = input.birth_date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) {
    throw new Error(`Invalid birth_date format: ${input.birth_date}`);
  }
  const normalizedDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;

  // Normalize birth_time (ensure HH:MM format, 24-hour)
  const timeMatch = input.birth_time.match(/^(\d{1,2}):(\d{2})/);
  if (!timeMatch) {
    throw new Error(`Invalid birth_time format: ${input.birth_time}`);
  }
  const hour = timeMatch[1].padStart(2, "0");
  const minute = timeMatch[2];
  const normalizedTime = `${hour}:${minute}`;

  // Normalize coordinates (round to 6 decimal places)
  // 6 decimals = ~0.1m precision, enough for astrology
  const normalizedLat = Number(input.birth_lat.toFixed(6));
  const normalizedLon = Number(input.birth_lon.toFixed(6));

  // Validate coordinate ranges
  if (normalizedLat < -90 || normalizedLat > 90) {
    throw new Error(`Invalid latitude: ${input.birth_lat}`);
  }
  if (normalizedLon < -180 || normalizedLon > 180) {
    throw new Error(`Invalid longitude: ${input.birth_lon}`);
  }

  // Timezone: use as-is (IANA strings are already standardized)
  const normalizedTimezone = input.timezone.trim();

  return {
    birth_date: normalizedDate,
    birth_time: normalizedTime,
    birth_lat: normalizedLat,
    birth_lon: normalizedLon,
    timezone: normalizedTimezone,
  };
}

/**
 * Compute deterministic chart key
 *
 * Key includes:
 * - Normalized birth inputs
 * - Engine configuration version
 *
 * SHA-256 hash ensures:
 * - Fixed length (64 hex chars)
 * - Collision resistance
 * - One-way (can't reverse to find inputs)
 */
export function computeChartKey(input: ChartInput): string {
  const normalized = normalizeChartInput(input);

  // Build deterministic string
  const keyString = [
    normalized.birth_date,
    normalized.birth_time,
    normalized.birth_lat.toString(),
    normalized.birth_lon.toString(),
    normalized.timezone,
    CHART_ENGINE_VERSION.houseSystem,
    CHART_ENGINE_VERSION.zodiac,
    CHART_ENGINE_VERSION.schemaVersion.toString(),
  ].join("|");

  // Hash to fixed-length key
  return createHash("sha256").update(keyString, "utf8").digest("hex");
}

// ============================================================================
// NUMEROLOGY KEY NORMALIZATION
// ============================================================================

/**
 * Numerology algorithm configuration version
 * Increment this when changing:
 * - Pythagorean vs Chaldean rules
 * - Master number handling
 * - Any calculation logic
 */
export const NUMEROLOGY_CONFIG_VERSION = 1;

export type NumerologyInput = {
  first_name: string;
  middle_name?: string; // Optional
  last_name: string;
  birth_date: string; // "YYYY-MM-DD"
};

/**
 * Normalize name inputs for consistent hashing
 *
 * Rules:
 * - Trim whitespace
 * - Convert to uppercase (to avoid case sensitivity)
 * - Remove accents/diacritics (optional - depends on numerology system)
 * - Handle empty middle name consistently
 */
export function normalizeNumerologyInput(input: NumerologyInput): NumerologyInput {
  // Validate required fields
  if (!input.first_name || !input.last_name || !input.birth_date) {
    throw new Error("first_name, last_name, and birth_date required for numerology");
  }

  // Normalize names: trim, uppercase
  const normalizedFirstName = input.first_name.trim().toUpperCase();
  const normalizedLastName = input.last_name.trim().toUpperCase();
  const normalizedMiddleName = input.middle_name?.trim().toUpperCase() || "";

  // Normalize birth_date
  const dateMatch = input.birth_date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) {
    throw new Error(`Invalid birth_date format: ${input.birth_date}`);
  }
  const normalizedDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;

  return {
    first_name: normalizedFirstName,
    middle_name: normalizedMiddleName || undefined,
    last_name: normalizedLastName,
    birth_date: normalizedDate,
  };
}

/**
 * Compute deterministic numerology key
 */
export function computeNumerologyKey(input: NumerologyInput): string {
  const normalized = normalizeNumerologyInput(input);

  // Build deterministic string
  const keyString = [
    normalized.first_name,
    normalized.middle_name || "",
    normalized.last_name,
    normalized.birth_date,
    NUMEROLOGY_CONFIG_VERSION.toString(),
  ].join("|");

  // Hash to fixed-length key
  return createHash("sha256").update(keyString, "utf8").digest("hex");
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Check if chart input is complete (all required fields present)
 */
export function isChartInputComplete(input: Partial<ChartInput>): input is ChartInput {
  return (
    !!input.birth_date &&
    !!input.birth_time && // NO null allowed (no noon defaulting)
    input.birth_lat !== null &&
    input.birth_lat !== undefined &&
    input.birth_lon !== null &&
    input.birth_lon !== undefined &&
    !!input.timezone
  );
}

/**
 * Check if numerology input is complete
 */
export function isNumerologyInputComplete(input: Partial<NumerologyInput>): input is NumerologyInput {
  return (
    !!input.first_name &&
    !!input.last_name &&
    !!input.birth_date
    // middle_name is optional
  );
}
