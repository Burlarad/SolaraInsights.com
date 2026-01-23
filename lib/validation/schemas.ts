/**
 * Zod schemas for API request validation.
 */

import { z } from "zod";

// ========================================
// Common validators
// ========================================

const zodiacSign = z.enum([
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
]);

const timeframe = z.enum(["today", "week", "month", "year"]);
const publicTimeframe = z.enum(["today", "week", "month"]);

const timezone = z.string().min(1).max(50);

// Language: default must be applied AFTER optional or it won’t actually default.
const language = z.string().min(2).max(5);
const languageDefault = language.optional().default("en");

// ========================================
// Public request schemas
// ========================================

// Public horoscope request
export const publicHoroscopeSchema = z.object({
  sign: zodiacSign,
  timeframe: publicTimeframe,
  timezone,
  language: languageDefault,
});

// Public compatibility request
export const publicCompatibilitySchema = z.object({
  signA: zodiacSign,
  signB: zodiacSign,
  requestId: z.string().uuid("requestId must be a valid UUID"),
  year: z.number().int().min(2024).max(2030).optional(),
  timezone: timezone.optional(),
  language: languageDefault,
});

// Public tarot request
export const publicTarotSchema = z.object({
  question: z
    .string()
    .min(10, "Question must be at least 10 characters")
    .max(500, "Question must be at most 500 characters")
    .refine((q) => q.trim().length >= 10, {
      message: "Question cannot be only whitespace",
    }),
  spread: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  requestId: z.string().uuid("requestId must be a valid UUID"),
  timezone,
  language: languageDefault,
  // Optional userContext for quiet personalization (logged-in users)
  userContext: z
    .object({
      preferredName: z.string().optional(),
      astroSummary: z.string().optional(),
      socialInsightsSummary: z.string().optional(),
    })
    .optional(),
});

// ========================================
// Authenticated / internal request schemas
// ========================================

// Insights request
export const insightsSchema = z.object({
  timeframe,
  language: languageDefault,
});

// Connection insight request
export const connectionInsightSchema = z.object({
  connectionId: z.string().uuid(),
  timeframe: timeframe.optional().default("today"),
  language: languageDefault,
});

// Profile update request
export const profileUpdateSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  birth_time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  birth_place: z.string().max(200).optional().nullable(),
  birth_lat: z.number().min(-90).max(90).optional().nullable(),
  birth_lon: z.number().min(-180).max(180).optional().nullable(), // <- lon (not lng)
  timezone: timezone.optional(),
  language: languageDefault,
  is_onboarded: z.boolean().optional(),
});

// Connection create/update request
export const connectionSchema = z.object({
  name: z.string().min(1).max(100),
  relationship_type: z.string().min(1).max(50).optional(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  birth_time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  birth_place: z.string().max(200).optional().nullable(),
  notes: z.string().max(500).optional(),
});

// Birth chart request
export const birthChartSchema = z.object({
  language: languageDefault,
});

// Stripe checkout request
export const stripeCheckoutSchema = z.object({
  plan: z.enum(["individual", "family"]),
  email: z.string().email().optional(),
});

// ========================================
// AI Response Validation Schemas
// ========================================

// Generic Tab Deep Dive schema (reusable for all Soul Print tabs)
// Note: practice field was removed - stone tablet vibe doesn't include homework
export const tabDeepDiveSchema = z
  .object({
    meaning: z
      .string()
      .min(100, "meaning must be at least 100 characters")
      .refine((val) => val.includes("\n\n"), {
        message:
          "meaning must contain at least 2 paragraphs (separated by blank line)",
      }),
    aligned: z.array(z.string().min(10)).length(3, "aligned must have exactly 3 items"),
    offCourse: z.array(z.string().min(10)).length(3, "offCourse must have exactly 3 items"),
    decisionRule: z
      .string()
      .min(20, "decisionRule must be at least 20 characters")
      .max(300, "decisionRule must be at most 300 characters"),
    promptVersion: z.number().int().positive(),
  })
  .passthrough(); // Allow extra fields (backward compat for existing stored practice)

// Type inference for tab deep dive
export type ValidatedTabDeepDive = z.infer<typeof tabDeepDiveSchema>;

// Tab keys for validation
export const TAB_DEEP_DIVE_KEYS = [
  "planetaryPlacements",
  "houses",
  "aspects",
  "patterns",
  "energyShape",
  "intensityZones",
  "direction",
  "joy",
] as const;

export type TabDeepDiveKey = (typeof TAB_DEEP_DIVE_KEYS)[number];

// Helper to validate a single Tab Deep Dive
export function validateTabDeepDive(
  data: unknown,
  tabKey: string
):
  | { success: true; data: ValidatedTabDeepDive }
  | { success: false; error: string; fields: string[] } {
  const result = tabDeepDiveSchema.safeParse(data);

  if (!result.success) {
    const fields = result.error.issues.map((e) => `${tabKey}.${e.path.join(".")}`);
    const errorMessage = result.error.issues
      .map((e) => `${tabKey}.${e.path.join(".")}: ${e.message}`)
      .join("; ");
    return { success: false, error: errorMessage, fields };
  }

  return { success: true, data: result.data };
}

// Batched Tab Deep Dives validation result
export type BatchedTabDeepDivesResult = {
  valid: Partial<Record<TabDeepDiveKey, ValidatedTabDeepDive>>;
  invalid: Array<{ key: TabDeepDiveKey; error: string; fields: string[] }>;
};

// Helper to validate all tab deep dives from a batched response
export function validateBatchedTabDeepDives(data: unknown): BatchedTabDeepDivesResult {
  const result: BatchedTabDeepDivesResult = {
    valid: {},
    invalid: [],
  };

  if (!data || typeof data !== "object") {
    return result;
  }

  const dataObj = data as Record<string, unknown>;

  for (const key of TAB_DEEP_DIVE_KEYS) {
    if (dataObj[key]) {
      const validation = validateTabDeepDive(dataObj[key], key);
      if (validation.success) {
        result.valid[key] = validation.data;
      } else {
        result.invalid.push({
          key,
          error: validation.error,
          fields: validation.fields,
        });
      }
    }
  }

  return result;
}

// FullBirthChartInsight response from OpenAI
// Validates that all required fields exist and are non-empty strings
export const fullBirthChartInsightSchema = z.object({
  meta: z.object({
    mode: z.literal("natal_full_profile"),
    language: z.string().min(2),
  }),
  coreSummary: z.object({
    headline: z.string().min(10, "headline must be at least 10 characters"),
    overallVibe: z.string().min(50, "overallVibe must be at least 50 characters"),
    bigThree: z.object({
      sun: z.string().min(50),
      moon: z.string().min(50),
      rising: z.string().min(50),
    }),
  }),
  sections: z.object({
    identity: z.string().min(100, "identity must be at least 100 characters"),
    emotions: z.string().min(100, "emotions must be at least 100 characters"),
    loveAndRelationships: z.string().min(100, "loveAndRelationships must be at least 100 characters"),
    workAndMoney: z.string().min(100, "workAndMoney must be at least 100 characters"),
    purposeAndGrowth: z.string().min(100, "purposeAndGrowth must be at least 100 characters"),
    innerWorld: z.string().min(100, "innerWorld must be at least 100 characters"),
  }),
});

// Type inference for the schema
export type ValidatedBirthChartInsight = z.infer<typeof fullBirthChartInsightSchema>;

// Helper to validate FullBirthChartInsight
export function validateBirthChartInsight(
  data: unknown
):
  | { success: true; data: ValidatedBirthChartInsight }
  | { success: false; error: string; fields: string[] } {
  const result = fullBirthChartInsightSchema.safeParse(data);

  if (!result.success) {
    const fields = result.error.issues.map((e) => e.path.join("."));
    const errorMessage = result.error.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    return { success: false, error: errorMessage, fields };
  }

  return { success: true, data: result.data };
}

// Helper to validate and parse request body
export async function validateRequest<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      const errors = result.error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      return { success: false, error: errors };
    }

    return { success: true, data: result.data };
  } catch {
    return { success: false, error: "Invalid JSON body" };
  }
}