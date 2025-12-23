import OpenAI from "openai";

// Validate that the OpenAI API key is present
if (!process.env.OPENAI_API_KEY) {
  throw new Error(
    "Missing OPENAI_API_KEY environment variable. Please add it to your .env file."
  );
}

// Create and export the OpenAI client instance
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Export model names from env for easy reuse
// Model routing strategy:
// - gpt-4.1-mini: Daily content (insights today, connection briefs, public endpoints)
// - gpt-5.1: Permanent/yearly content (birth chart, yearly insights)
// - gpt-4o: Deep relationship analysis (Space Between)
export const OPENAI_MODELS = {
  // Daily insights (today timeframe) - fast, cheap
  dailyInsights: process.env.OPENAI_DAILY_INSIGHTS_MODEL || "gpt-4.1-mini",
  // Yearly insights - premium, cached for full year
  yearlyInsights: process.env.OPENAI_YEARLY_INSIGHTS_MODEL || "gpt-5.1",
  // Birth chart / Soul Path narrative - premium, permanent stone tablet
  birthChart: process.env.OPENAI_BIRTHCHART_MODEL || "gpt-5.1",
  // Public endpoints (horoscope, tarot, compatibility) - fast, cheap
  horoscope: process.env.OPENAI_HOROSCOPE_MODEL || "gpt-4.1-mini",
  // Connection briefs - daily, fast
  connectionBrief: process.env.OPENAI_CONNECTION_BRIEF_MODEL || "gpt-4.1-mini",
  // Space Between - deep analysis, quarterly refresh
  deep: process.env.OPENAI_DEEP_MODEL || "gpt-4o",
  // Social summaries - lightweight
  fast: process.env.OPENAI_FAST_MODEL || "gpt-4o-mini",
  // Legacy: kept for backward compatibility, maps to dailyInsights
  insights: process.env.OPENAI_DAILY_INSIGHTS_MODEL || "gpt-4.1-mini",
  // Legacy: placements (not used for AI calls)
  placements: process.env.OPENAI_PLACEMENTS_MODEL || "gpt-5.1",
} as const;
