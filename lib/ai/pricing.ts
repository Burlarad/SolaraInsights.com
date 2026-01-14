/**
 * OpenAI pricing utilities for Solara token usage tracking.
 *
 * Prices are per 1 million tokens (as of January 2026).
 * Source: OpenAI pricing page
 *
 * IMPORTANT: When updating prices, increment PRICING_VERSION so audit logs
 * can distinguish which pricing was used for historical records.
 */

export type ModelPricing = {
  input: number; // USD per 1M input tokens
  output: number; // USD per 1M output tokens
};

/**
 * Pricing version - increment when prices change.
 * This is stored in event metadata for audit trail.
 */
export const PRICING_VERSION = 2;

/**
 * Pricing effective date for audit purposes.
 */
export const PRICING_EFFECTIVE_DATE = "2026-01-14";

/**
 * Provider name for this pricing table.
 */
export const PRICING_PROVIDER = "openai";

/**
 * OpenAI model pricing table.
 * Exported for inclusion in usage event metadata.
 */
export const PRICING_TABLE: Record<string, ModelPricing> = {
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

/**
 * Estimate the cost of an OpenAI API call in cents (integer).
 * Used for storage in database to avoid floating point issues.
 *
 * @param model - OpenAI model name
 * @param inputTokens - Number of input tokens consumed
 * @param outputTokens - Number of output tokens generated
 * @returns Estimated cost in cents (rounded), or 0 if model pricing not found
 */
export function estimateCostCents(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const costUsd = estimateCostUsd(model, inputTokens, outputTokens);
  return Math.round(costUsd * 100);
}

/**
 * Pricing snapshot for a model at the current pricing version.
 * Stored in event metadata for audit purposes.
 */
export type PricingSnapshot = {
  version: number;
  effectiveDate: string;
  provider: string;
  model: string;
  inputPer1M: number;
  outputPer1M: number;
};

/**
 * Get the pricing snapshot for a model.
 * Returns null if model is not in pricing table.
 */
export function getPricingSnapshot(model: string): PricingSnapshot | null {
  const pricing = PRICING_TABLE[model];

  if (!pricing) {
    return null;
  }

  return {
    version: PRICING_VERSION,
    effectiveDate: PRICING_EFFECTIVE_DATE,
    provider: PRICING_PROVIDER,
    model,
    inputPer1M: pricing.input,
    outputPer1M: pricing.output,
  };
}
