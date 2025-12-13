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
