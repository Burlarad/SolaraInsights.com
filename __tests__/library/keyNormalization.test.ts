/**
 * Key Normalization Tests
 *
 * Ensures deterministic key generation for library deduplication.
 *
 * CRITICAL: Same inputs MUST produce same key, different inputs MUST differ.
 */

import { describe, it, expect } from "vitest";
import {
  computeChartKey,
  computeNumerologyKey,
  normalizeChartInput,
  normalizeNumerologyInput,
  isChartInputComplete,
  isNumerologyInputComplete,
} from "@/lib/library/keyNormalization";

describe("Chart Key Normalization", () => {
  describe("normalizeChartInput", () => {
    it("normalizes birth_date to YYYY-MM-DD", () => {
      const result = normalizeChartInput({
        birth_date: "1990-05-15",
        birth_time: "14:30",
        birth_lat: 40.7128,
        birth_lon: -74.006,
        timezone: "America/New_York",
      });

      expect(result.birth_date).toBe("1990-05-15");
    });

    it("normalizes birth_time to HH:MM", () => {
      const result = normalizeChartInput({
        birth_date: "1990-05-15",
        birth_time: "9:30", // Single digit hour
        birth_lat: 40.7128,
        birth_lon: -74.006,
        timezone: "America/New_York",
      });

      expect(result.birth_time).toBe("09:30");
    });

    it("rounds latitude to 6 decimal places", () => {
      const result = normalizeChartInput({
        birth_date: "1990-05-15",
        birth_time: "14:30",
        birth_lat: 40.71283746592837, // Many decimals
        birth_lon: -74.006,
        timezone: "America/New_York",
      });

      expect(result.birth_lat).toBe(40.712837);
    });

    it("rounds longitude to 6 decimal places", () => {
      const result = normalizeChartInput({
        birth_date: "1990-05-15",
        birth_time: "14:30",
        birth_lat: 40.7128,
        birth_lon: -74.00598765432, // Many decimals
        timezone: "America/New_York",
      });

      expect(result.birth_lon).toBe(-74.005988);
    });

    it("throws error when birth_time is null (NO NOON DEFAULTING)", () => {
      expect(() =>
        normalizeChartInput({
          birth_date: "1990-05-15",
          birth_time: null as any,
          birth_lat: 40.7128,
          birth_lon: -74.006,
          timezone: "America/New_York",
        })
      ).toThrow("All birth fields required");
    });

    it("throws error when birth_lat is null", () => {
      expect(() =>
        normalizeChartInput({
          birth_date: "1990-05-15",
          birth_time: "14:30",
          birth_lat: null as any,
          birth_lon: -74.006,
          timezone: "America/New_York",
        })
      ).toThrow("All birth fields required");
    });

    it("throws error when latitude out of range", () => {
      expect(() =>
        normalizeChartInput({
          birth_date: "1990-05-15",
          birth_time: "14:30",
          birth_lat: 91, // Out of range
          birth_lon: -74.006,
          timezone: "America/New_York",
        })
      ).toThrow("Invalid latitude");
    });

    it("throws error when longitude out of range", () => {
      expect(() =>
        normalizeChartInput({
          birth_date: "1990-05-15",
          birth_time: "14:30",
          birth_lat: 40.7128,
          birth_lon: 181, // Out of range
          timezone: "America/New_York",
        })
      ).toThrow("Invalid longitude");
    });
  });

  describe("computeChartKey", () => {
    it("produces consistent key for same inputs", () => {
      const inputs = {
        birth_date: "1990-05-15",
        birth_time: "14:30",
        birth_lat: 40.7128,
        birth_lon: -74.006,
        timezone: "America/New_York",
      };

      const key1 = computeChartKey(inputs);
      const key2 = computeChartKey(inputs);

      expect(key1).toBe(key2);
    });

    it("produces different keys for different birth_time", () => {
      const inputs1 = {
        birth_date: "1990-05-15",
        birth_time: "14:30",
        birth_lat: 40.7128,
        birth_lon: -74.006,
        timezone: "America/New_York",
      };

      const inputs2 = {
        ...inputs1,
        birth_time: "14:31", // Different time
      };

      const key1 = computeChartKey(inputs1);
      const key2 = computeChartKey(inputs2);

      expect(key1).not.toBe(key2);
    });

    it("produces different keys for different coordinates", () => {
      const inputs1 = {
        birth_date: "1990-05-15",
        birth_time: "14:30",
        birth_lat: 40.7128,
        birth_lon: -74.006,
        timezone: "America/New_York",
      };

      const inputs2 = {
        ...inputs1,
        birth_lat: 40.7129, // Slightly different
      };

      const key1 = computeChartKey(inputs1);
      const key2 = computeChartKey(inputs2);

      expect(key1).not.toBe(key2);
    });

    it("produces SHA-256 hash (64 hex characters)", () => {
      const key = computeChartKey({
        birth_date: "1990-05-15",
        birth_time: "14:30",
        birth_lat: 40.7128,
        birth_lon: -74.006,
        timezone: "America/New_York",
      });

      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("isChartInputComplete", () => {
    it("returns true when all fields present", () => {
      const result = isChartInputComplete({
        birth_date: "1990-05-15",
        birth_time: "14:30",
        birth_lat: 40.7128,
        birth_lon: -74.006,
        timezone: "America/New_York",
      });

      expect(result).toBe(true);
    });

    it("returns false when birth_time is missing (NO NOON DEFAULTING)", () => {
      const result = isChartInputComplete({
        birth_date: "1990-05-15",
        birth_time: undefined,
        birth_lat: 40.7128,
        birth_lon: -74.006,
        timezone: "America/New_York",
      });

      expect(result).toBe(false);
    });

    it("returns false when birth_lat is missing", () => {
      const result = isChartInputComplete({
        birth_date: "1990-05-15",
        birth_time: "14:30",
        birth_lat: undefined,
        birth_lon: -74.006,
        timezone: "America/New_York",
      });

      expect(result).toBe(false);
    });

    it("returns false when timezone is missing", () => {
      const result = isChartInputComplete({
        birth_date: "1990-05-15",
        birth_time: "14:30",
        birth_lat: 40.7128,
        birth_lon: -74.006,
        timezone: undefined,
      });

      expect(result).toBe(false);
    });
  });
});

describe("Numerology Key Normalization", () => {
  describe("normalizeNumerologyInput", () => {
    it("normalizes names to uppercase", () => {
      const result = normalizeNumerologyInput({
        first_name: "john",
        last_name: "doe",
        birth_date: "1990-05-15",
      });

      expect(result.first_name).toBe("JOHN");
      expect(result.last_name).toBe("DOE");
    });

    it("trims whitespace from names", () => {
      const result = normalizeNumerologyInput({
        first_name: "  John  ",
        last_name: "  Doe  ",
        birth_date: "1990-05-15",
      });

      expect(result.first_name).toBe("JOHN");
      expect(result.last_name).toBe("DOE");
    });

    it("handles optional middle name", () => {
      const result = normalizeNumerologyInput({
        first_name: "John",
        middle_name: "Michael",
        last_name: "Doe",
        birth_date: "1990-05-15",
      });

      expect(result.middle_name).toBe("MICHAEL");
    });

    it("handles missing middle name", () => {
      const result = normalizeNumerologyInput({
        first_name: "John",
        last_name: "Doe",
        birth_date: "1990-05-15",
      });

      expect(result.middle_name).toBeUndefined();
    });
  });

  describe("computeNumerologyKey", () => {
    it("produces consistent key for same inputs", () => {
      const inputs = {
        first_name: "John",
        last_name: "Doe",
        birth_date: "1990-05-15",
      };

      const key1 = computeNumerologyKey(inputs);
      const key2 = computeNumerologyKey(inputs);

      expect(key1).toBe(key2);
    });

    it("produces same key regardless of name casing", () => {
      const inputs1 = {
        first_name: "john",
        last_name: "doe",
        birth_date: "1990-05-15",
      };

      const inputs2 = {
        first_name: "JOHN",
        last_name: "DOE",
        birth_date: "1990-05-15",
      };

      const key1 = computeNumerologyKey(inputs1);
      const key2 = computeNumerologyKey(inputs2);

      expect(key1).toBe(key2); // Case-insensitive
    });

    it("produces different keys for different names", () => {
      const inputs1 = {
        first_name: "John",
        last_name: "Doe",
        birth_date: "1990-05-15",
      };

      const inputs2 = {
        first_name: "Jane",
        last_name: "Doe",
        birth_date: "1990-05-15",
      };

      const key1 = computeNumerologyKey(inputs1);
      const key2 = computeNumerologyKey(inputs2);

      expect(key1).not.toBe(key2);
    });

    it("produces SHA-256 hash (64 hex characters)", () => {
      const key = computeNumerologyKey({
        first_name: "John",
        last_name: "Doe",
        birth_date: "1990-05-15",
      });

      expect(key).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("isNumerologyInputComplete", () => {
    it("returns true when all required fields present", () => {
      const result = isNumerologyInputComplete({
        first_name: "John",
        last_name: "Doe",
        birth_date: "1990-05-15",
      });

      expect(result).toBe(true);
    });

    it("returns true even when middle_name is missing (optional)", () => {
      const result = isNumerologyInputComplete({
        first_name: "John",
        last_name: "Doe",
        birth_date: "1990-05-15",
      });

      expect(result).toBe(true);
    });

    it("returns false when first_name is missing", () => {
      const result = isNumerologyInputComplete({
        first_name: undefined,
        last_name: "Doe",
        birth_date: "1990-05-15",
      });

      expect(result).toBe(false);
    });

    it("returns false when birth_date is missing", () => {
      const result = isNumerologyInputComplete({
        first_name: "John",
        last_name: "Doe",
        birth_date: undefined,
      });

      expect(result).toBe(false);
    });
  });
});
