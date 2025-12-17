/**
 * Reddit OAuth Provider Adapter
 *
 * Reddit-specific OAuth quirks:
 * - Uses Basic auth for token requests (client_id:client_secret base64)
 * - Requires `duration=permanent` for refresh tokens
 * - Scopes are space-separated in URL
 */

import { ProviderAdapter, NormalizedTokens } from "./types";

export const redditAdapter: ProviderAdapter = {
  provider: "reddit",
  authorizeUrl: "https://www.reddit.com/api/v1/authorize",
  tokenUrl: "https://www.reddit.com/api/v1/access_token",

  // Minimal scopes - only what we need
  scopes: ["identity", "history", "read"],

  clientIdEnvKey: "REDDIT_CLIENT_ID",
  clientSecretEnvKey: "REDDIT_CLIENT_SECRET",
  supportsRefreshToken: true,

  buildAuthorizeParams({ clientId, redirectUri, state, codeChallenge, codeChallengeMethod }) {
    const params = new URLSearchParams();

    params.set("client_id", clientId);
    params.set("redirect_uri", redirectUri);
    params.set("response_type", "code");
    params.set("scope", this.scopes.join(" ")); // Reddit uses space-separated
    params.set("state", state);
    params.set("duration", "permanent"); // Required for refresh tokens

    // PKCE parameters
    params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", codeChallengeMethod);

    return params;
  },

  buildTokenRequestBody({ code, redirectUri, codeVerifier }) {
    // Reddit uses Basic auth, so client_id/secret go in headers, not body
    const params = new URLSearchParams();

    params.set("grant_type", "authorization_code");
    params.set("code", code);
    params.set("redirect_uri", redirectUri);
    params.set("code_verifier", codeVerifier);

    return params;
  },

  buildTokenRequestHeaders({ clientId, clientSecret }) {
    // Reddit requires Basic auth
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    return {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    };
  },

  buildRefreshRequestBody({ refreshToken }) {
    // Reddit uses Basic auth, so client_id/secret go in headers
    const params = new URLSearchParams();

    params.set("grant_type", "refresh_token");
    params.set("refresh_token", refreshToken);

    return params;
  },

  buildRefreshRequestHeaders({ clientId, clientSecret }) {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    return {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    };
  },

  parseTokenResponse(data): NormalizedTokens {
    return {
      accessToken: data.access_token as string,
      refreshToken: (data.refresh_token as string) || null,
      expiresIn: (data.expires_in as number) || null,
      userId: null, // Reddit doesn't return user_id in token response
    };
  },
};
