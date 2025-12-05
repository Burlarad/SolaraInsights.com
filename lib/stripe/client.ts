import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY is not set; Stripe client will be created with an empty key.");
}

/**
 * Server-side Stripe client
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  typescript: true,
});

/**
 * Stripe configuration values from environment variables.
 * These are used throughout the application for pricing and webhook handling.
 */
export const STRIPE_CONFIG = {
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  priceIds: {
    sanctuary: process.env.STRIPE_PRICE_ID || "",
    family: process.env.STRIPE_FAMILY_PRICE_ID || "",
  },
  pricingTableId: process.env.STRIPE_PRICING_TABLE_ID || "",
} as const;

/**
 * Validates that all required Stripe configuration is present.
 * Call this during app initialization to catch configuration errors early.
 */
export function validateStripeConfig() {
  const missing: string[] = [];

  if (!STRIPE_CONFIG.publishableKey) missing.push("STRIPE_PUBLISHABLE_KEY");
  if (!STRIPE_CONFIG.webhookSecret) missing.push("STRIPE_WEBHOOK_SECRET");
  if (!STRIPE_CONFIG.priceIds.sanctuary) missing.push("STRIPE_PRICE_ID");

  if (missing.length > 0) {
    console.warn(
      `⚠️  Missing optional Stripe configuration: ${missing.join(", ")}`
    );
  }
}
