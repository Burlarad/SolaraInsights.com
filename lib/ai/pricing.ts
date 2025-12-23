/**
 * OpenAI pricing utilities for Solara token usage tracking.
 *
 * Prices are per 1 million tokens (as of December 2025).
 * Source: OpenAI pricing page
 */

type ModelPricing = {
  input: number; // USD per 1M input tokens
  output: number; // USD per 1M output tokens
};

const PRICING_TABLE: Record<string, ModelPricing> = {
  "gpt-4o-mini": {
    input: 0.15,
    output: 0.6,
  },
  "gpt-4o": {
    input: 2.5,
    output: 10.0,
  },
  "gpt-4.1-mini": {
    input: 0.4,
    output: 1.6,
  },
  "gpt-5.1": {
    input: 1.25,
    output: 10.0,
  },
  "gpt-5.2": {
    input: 1.75,
    output: 14.0,
  },
};

/**
 * Estimate the cost of an OpenAI API call in USD.
 *
 * @param model - OpenAI model name (e.g., "gpt-4o-mini")
 * @param inputTokens - Number of input tokens consumed
 * @param outputTokens - Number of output tokens generated
 * @returns Estimated cost in USD, or 0 if model pricing not found
 *
 * @example
 * const cost = estimateCostUsd("gpt-4o-mini", 1000, 500);
 * // Returns: (1000 / 1_000_000 * 0.15) + (500 / 1_000_000 * 0.6) = 0.00045
 */
export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING_TABLE[model];

  if (!pricing) {
    console.warn(`[Pricing] Unknown model "${model}", cannot estimate cost`);
    return 0;
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}
