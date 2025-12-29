/**
 * Provider Adapters Registry
 *
 * Exports all provider adapters and the unified registry.
 */

import { SocialProvider } from "@/types";
import { ProviderAdapter, ProviderRegistry } from "./types";
import { tiktokAdapter } from "./tiktok";
import { facebookAdapter, instagramAdapter } from "./meta";
import { redditAdapter } from "./reddit";
import { xAdapter, isXOAuthEnabled } from "./x";

/**
 * Registry of all provider adapters
 */
export const PROVIDER_ADAPTERS: ProviderRegistry = {
  facebook: facebookAdapter,
  instagram: instagramAdapter,
  tiktok: tiktokAdapter,
  x: xAdapter,
  reddit: redditAdapter,
};

/**
 * Get adapter for a specific provider
 */
export function getProviderAdapter(provider: SocialProvider): ProviderAdapter {
  const adapter = PROVIDER_ADAPTERS[provider];
  if (!adapter) {
    throw new Error(`No adapter found for provider: ${provider}`);
  }
  return adapter;
}

/**
 * Get list of enabled providers
 * X is gated behind X_OAUTH_ENABLED flag
 */
export function getEnabledProviders(): SocialProvider[] {
  const providers: SocialProvider[] = ["facebook", "instagram", "tiktok", "reddit"];

  if (isXOAuthEnabled()) {
    providers.push("x");
  }

  return providers;
}

/**
 * Check if a provider is enabled
 */
export function isProviderEnabled(provider: SocialProvider): boolean {
  if (provider === "x") {
    return isXOAuthEnabled();
  }
  return true;
}

/**
 * Check if OAuth is configured for a provider (credentials are set)
 */
export function isOAuthConfigured(provider: SocialProvider): boolean {
  const adapter = PROVIDER_ADAPTERS[provider];
  if (!adapter) {
    return false;
  }

  const clientId = process.env[adapter.clientIdEnvKey];
  const clientSecret = process.env[adapter.clientSecretEnvKey];

  return Boolean(clientId && clientSecret);
}

// Re-export types and utilities
export type { ProviderAdapter, NormalizedTokens, EnrichedTokens, ProviderRegistry } from "./types";
export { isXOAuthEnabled } from "./x";
