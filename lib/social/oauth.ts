/**
 * OAuth Orchestration Layer
 *
 * This module provides a unified interface for OAuth operations across all providers.
 * It delegates provider-specific logic to adapters in lib/oauth/providers/*.
 *
 * All providers use:
 * - Authorization Code flow with PKCE (S256)
 * - State parameter for CSRF protection
 * - Server-side token exchange only
 * - Encrypted token storage (AES-256-GCM)
 */

import { SocialProvider } from "@/types";
import {
  getProviderAdapter,
  isProviderEnabled,
  PROVIDER_ADAPTERS,
  NormalizedTokens,
} from "@/lib/oauth/providers";

// Re-export for backwards compatibility
export { PROVIDER_ADAPTERS as OAUTH_PROVIDERS };
export { isProviderEnabled, getProviderAdapter };

/**
 * Get OAuth credentials for a provider from environment variables
 */
export function getOAuthCredentials(provider: SocialProvider): {
  clientId: string;
  clientSecret: string;
} {
  const adapter = getProviderAdapter(provider);

  const clientId = process.env[adapter.clientIdEnvKey];
  const clientSecret = process.env[adapter.clientSecretEnvKey];

  if (!clientId || !clientSecret) {
    throw new Error(
      `OAuth credentials not configured for ${provider}. ` +
        `Set ${adapter.clientIdEnvKey} and ${adapter.clientSecretEnvKey} environment variables.`
    );
  }

  return { clientId, clientSecret };
}

/**
 * Generate the OAuth authorization URL for a provider
 * Includes PKCE code_challenge (S256 method)
 */
export function generateAuthUrl(
  provider: SocialProvider,
  redirectUri: string,
  state: string,
  codeChallenge: string
): string {
  const adapter = getProviderAdapter(provider);
  const { clientId } = getOAuthCredentials(provider);

  const params = adapter.buildAuthorizeParams({
    clientId,
    redirectUri,
    state,
    codeChallenge,
    codeChallengeMethod: "S256",
  });

  return `${adapter.authorizeUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 * Requires code_verifier for PKCE validation
 */
export async function exchangeCodeForTokens(
  provider: SocialProvider,
  code: string,
  redirectUri: string,
  codeVerifier: string
): Promise<NormalizedTokens> {
  const adapter = getProviderAdapter(provider);
  const { clientId, clientSecret } = getOAuthCredentials(provider);

  const body = adapter.buildTokenRequestBody({
    clientId,
    clientSecret,
    code,
    redirectUri,
    codeVerifier,
  });

  const headers = adapter.buildTokenRequestHeaders({
    clientId,
    clientSecret,
  });

  const response = await fetch(adapter.tokenUrl, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[OAuth] Token exchange failed for ${provider}:`, error);
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  const data = await response.json();
  return adapter.parseTokenResponse(data);
}

/**
 * Refresh an access token
 */
export async function refreshAccessToken(
  provider: SocialProvider,
  refreshToken: string
): Promise<NormalizedTokens> {
  const adapter = getProviderAdapter(provider);

  if (!adapter.supportsRefreshToken) {
    throw new Error(`${provider} does not support refresh tokens`);
  }

  const { clientId, clientSecret } = getOAuthCredentials(provider);

  const body = adapter.buildRefreshRequestBody({
    clientId,
    clientSecret,
    refreshToken,
  });

  const headers = adapter.buildRefreshRequestHeaders({
    clientId,
    clientSecret,
  });

  const response = await fetch(adapter.tokenUrl, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[OAuth] Token refresh failed for ${provider}:`, error);
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const data = await response.json();
  const tokens = adapter.parseTokenResponse(data);

  // Some providers rotate refresh tokens, others don't
  return {
    ...tokens,
    refreshToken: tokens.refreshToken || refreshToken,
  };
}

/**
 * Get the callback URL for a provider
 * Uses NEXT_PUBLIC_SITE_URL as the single source of truth
 */
export function getCallbackUrl(provider: SocialProvider): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${baseUrl}/api/social/oauth/${provider}/callback`;
}

/**
 * Check if OAuth is configured for a provider
 */
export function isOAuthConfigured(provider: SocialProvider): boolean {
  const adapter = getProviderAdapter(provider);

  return !!(
    process.env[adapter.clientIdEnvKey] && process.env[adapter.clientSecretEnvKey]
  );
}

/**
 * Generate a random state parameter for CSRF protection
 */
export function generateOAuthState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Get scopes for a provider
 */
export function getProviderScopes(provider: SocialProvider): string[] {
  const adapter = getProviderAdapter(provider);
  return adapter.scopes;
}
