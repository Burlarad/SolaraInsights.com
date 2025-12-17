/**
 * X (Twitter) OAuth Provider Adapter
 *
 * X-specific OAuth quirks:
 * - Requires PKCE (S256) - mandatory
 * - Uses standard client_id/client_secret
 * - Feature-flagged until API approval: X_OAUTH_ENABLED
 */

import { ProviderAdapter, NormalizedTokens } from "./types";

/**
 * Check if X OAuth is enabled
 */
export function isXOAuthEnabled(): boolean {
  return process.env.X_OAUTH_ENABLED === "true";
}

export const xAdapter: ProviderAdapter = {
  provider: "x",
  authorizeUrl: "https://twitter.com/i/oauth2/authorize",
  tokenUrl: "https://api.twitter.com/2/oauth2/token",

  // Minimal scopes
  scopes: ["tweet.read", "users.read", "offline.access"],

  clientIdEnvKey: "X_CLIENT_ID",
  clientSecretEnvKey: "X_CLIENT_SECRET",
  supportsRefreshToken: true,

  buildAuthorizeParams({ clientId, redirectUri, state, codeChallenge, codeChallengeMethod }) {
    const params = new URLSearchParams();

    params.set("client_id", clientId);
    params.set("redirect_uri", redirectUri);
    params.set("response_type", "code");
    params.set("scope", this.scopes.join(" ")); // X uses space-separated
    params.set("state", state);

    // PKCE is REQUIRED for X - S256 method
    params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", codeChallengeMethod);

    return params;
  },

  buildTokenRequestBody({ clientId, clientSecret, code, redirectUri, codeVerifier }) {
    const params = new URLSearchParams();

    params.set("grant_type", "authorization_code");
    params.set("client_id", clientId);
    params.set("client_secret", clientSecret);
    params.set("code", code);
    params.set("redirect_uri", redirectUri);
    params.set("code_verifier", codeVerifier);

    return params;
  },

  buildTokenRequestHeaders() {
    return {
      "Content-Type": "application/x-www-form-urlencoded",
    };
  },

  buildRefreshRequestBody({ clientId, clientSecret, refreshToken }) {
    const params = new URLSearchParams();

    params.set("grant_type", "refresh_token");
    params.set("client_id", clientId);
    params.set("client_secret", clientSecret);
    params.set("refresh_token", refreshToken);

    return params;
  },

  buildRefreshRequestHeaders() {
    return {
      "Content-Type": "application/x-www-form-urlencoded",
    };
  },

  parseTokenResponse(data): NormalizedTokens {
    return {
      accessToken: data.access_token as string,
      refreshToken: (data.refresh_token as string) || null,
      expiresIn: (data.expires_in as number) || null,
      userId: null, // X doesn't return user_id in token response
    };
  },
};
