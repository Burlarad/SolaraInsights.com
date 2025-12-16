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
export const OPENAI_MODELS = {
  horoscope: process.env.OPENAI_HOROSCOPE_MODEL || "gpt-4o-mini",
  insights: process.env.OPENAI_INSIGHTS_MODEL || "gpt-4o-mini",
  placements: process.env.OPENAI_PLACEMENTS_MODEL || "gpt-5.1",
  deep: process.env.OPENAI_DEEP_MODEL || "gpt-4o", // For stone tablet / permanent content
} as const;
