/**
 * Provider Adapter Types
 *
 * Defines the interface for OAuth provider adapters.
 * Each provider implements this interface to handle provider-specific quirks.
 */

import { SocialProvider } from "@/types";

/**
 * Normalized token response from any provider
 */
export interface NormalizedTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  userId: string | null;
}

/**
 * Provider adapter interface
 * Each provider must implement this to handle their OAuth quirks
 */
export interface ProviderAdapter {
  // Identity
  provider: SocialProvider;

  // URLs
  authorizeUrl: string;
  tokenUrl: string;

  // Scopes (must match portal submissions exactly)
  scopes: string[];

  // Environment variable names
  clientIdEnvKey: string;
  clientSecretEnvKey: string;

  // Provider capabilities
  supportsRefreshToken: boolean;

  /**
   * Build authorization URL parameters
   * Provider can add/modify params as needed (e.g., client_key vs client_id)
   */
  buildAuthorizeParams(params: {
    clientId: string;
    redirectUri: string;
    state: string;
    codeChallenge: string;
    codeChallengeMethod: string;
  }): URLSearchParams;

  /**
   * Build token exchange request body
   */
  buildTokenRequestBody(params: {
    clientId: string;
    clientSecret: string;
    code: string;
    redirectUri: string;
    codeVerifier: string;
  }): URLSearchParams;

  /**
   * Build token exchange request headers
   */
  buildTokenRequestHeaders(params: {
    clientId: string;
    clientSecret: string;
  }): Record<string, string>;

  /**
   * Build refresh token request body
   */
  buildRefreshRequestBody(params: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  }): URLSearchParams;

  /**
   * Build refresh token request headers
   */
  buildRefreshRequestHeaders(params: {
    clientId: string;
    clientSecret: string;
  }): Record<string, string>;

  /**
   * Parse and normalize the token response
   */
  parseTokenResponse(data: Record<string, unknown>): NormalizedTokens;
}

/**
 * Provider registry type
 */
export type ProviderRegistry = Record<SocialProvider, ProviderAdapter>;
