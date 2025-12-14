/**
 * Zod schemas for API request validation.
 */

import { z } from "zod";

// Common validators
const zodiacSign = z.enum([
  "aries", "taurus", "gemini", "cancer",
  "leo", "virgo", "libra", "scorpio",
  "sagittarius", "capricorn", "aquarius", "pisces",
]);

const timeframe = z.enum(["today", "week", "month", "year"]);
const publicTimeframe = z.enum(["today", "week", "month"]);
const language = z.string().min(2).max(5).default("en");
const timezone = z.string().min(1).max(50);

// Public horoscope request
export const publicHoroscopeSchema = z.object({
  sign: zodiacSign,
  timeframe: publicTimeframe,
  timezone: timezone,
  language: language.optional(),
});

// Insights request
export const insightsSchema = z.object({
  timeframe: timeframe,
  language: language.optional(),
});

// Connection insight request
export const connectionInsightSchema = z.object({
  connectionId: z.string().uuid(),
  timeframe: timeframe.optional().default("today"),
  language: language.optional(),
});

// Profile update request
export const profileUpdateSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  birth_time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  birth_place: z.string().max(200).optional().nullable(),
  birth_lat: z.number().min(-90).max(90).optional().nullable(),
  birth_lng: z.number().min(-180).max(180).optional().nullable(),
  timezone: timezone.optional(),
  language: language.optional(),
  is_onboarded: z.boolean().optional(),
});

// Journal entry request
export const journalEntrySchema = z.object({
  content: z.string().min(1).max(10000),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeframe: timeframe.optional(),
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
  language: language.optional(),
});

// Stripe checkout request
export const stripeCheckoutSchema = z.object({
  plan: z.enum(["individual", "family"]),
  email: z.string().email().optional(),
});

// ========================================
// AI Response Validation Schemas
// ========================================

// Joy Deep Dive schema (Part of Fortune personalized interpretation)
export const joyDeepDiveSchema = z.object({
  meaning: z.string()
    .min(100, "meaning must be at least 100 characters")
    .refine(
      (val) => val.includes("\n\n"),
      { message: "meaning must contain at least 2 paragraphs (separated by blank line)" }
    ),
  aligned: z.array(z.string().min(10))
    .length(3, "aligned must have exactly 3 items"),
  offCourse: z.array(z.string().min(10))
    .length(3, "offCourse must have exactly 3 items"),
  decisionRule: z.string()
    .min(20, "decisionRule must be at least 20 characters")
    .max(300, "decisionRule must be at most 300 characters"),
  practice: z.string()
    .min(30, "practice must be at least 30 characters")
    .max(500, "practice must be at most 500 characters"),
  promptVersion: z.number().int().positive(),
});

// Type inference for joy deep dive
export type ValidatedJoyDeepDive = z.infer<typeof joyDeepDiveSchema>;

// Helper to validate Joy Deep Dive
export function validateJoyDeepDive(
  data: unknown
): { success: true; data: ValidatedJoyDeepDive } | { success: false; error: string; fields: string[] } {
  const result = joyDeepDiveSchema.safeParse(data);

  if (!result.success) {
    const fields = result.error.issues.map((e) => e.path.join("."));
    const errorMessage = result.error.issues
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    return { success: false, error: errorMessage, fields };
  }

  return { success: true, data: result.data };
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
): { success: true; data: ValidatedBirthChartInsight } | { success: false; error: string; fields: string[] } {
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
