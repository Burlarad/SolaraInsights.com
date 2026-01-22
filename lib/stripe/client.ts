import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!STRIPE_SECRET_KEY) {
  throw new Error(
    "Missing STRIPE_SECRET_KEY. Set it in .env.local (dev) and .env (prod). Refusing to start to avoid silent payment failures."
  );
}

/**
 * Server-side Stripe client
 */
export const stripe = new Stripe(STRIPE_SECRET_KEY, {
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
