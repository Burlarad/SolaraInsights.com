/**
 * Meta (Facebook/Instagram) OAuth Provider Adapters
 *
 * Meta-specific OAuth quirks:
 * - Facebook and Instagram share similar patterns
 * - Facebook doesn't support refresh tokens (uses long-lived tokens)
 * - Instagram supports refresh tokens
 * - Both use standard client_id/client_secret
 */

import { ProviderAdapter, NormalizedTokens } from "./types";

/**
 * Facebook OAuth Adapter
 */
export const facebookAdapter: ProviderAdapter = {
  provider: "facebook",
  authorizeUrl: "https://www.facebook.com/v18.0/dialog/oauth",
  tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",

  // Minimal scopes - only what we need
  scopes: ["public_profile", "user_posts"],

  clientIdEnvKey: "META_APP_ID",
  clientSecretEnvKey: "META_APP_SECRET",
  supportsRefreshToken: false, // FB uses long-lived tokens instead

  buildAuthorizeParams({ clientId, redirectUri, state, codeChallenge, codeChallengeMethod }) {
    const params = new URLSearchParams();

    params.set("client_id", clientId);
    params.set("redirect_uri", redirectUri);
    params.set("response_type", "code");
    params.set("scope", this.scopes.join(","));
    params.set("state", state);

    // PKCE parameters
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

  buildRefreshRequestBody() {
    // Facebook doesn't support refresh tokens
    throw new Error("Facebook does not support refresh tokens");
  },

  buildRefreshRequestHeaders() {
    return {
      "Content-Type": "application/x-www-form-urlencoded",
    };
  },

  parseTokenResponse(data): NormalizedTokens {
    return {
      accessToken: data.access_token as string,
      refreshToken: null, // FB doesn't provide refresh tokens
      expiresIn: (data.expires_in as number) || null,
      userId: (data.user_id as string) || null,
    };
  },
};

/**
 * Instagram OAuth Adapter
 */
export const instagramAdapter: ProviderAdapter = {
  provider: "instagram",
  authorizeUrl: "https://api.instagram.com/oauth/authorize",
  tokenUrl: "https://api.instagram.com/oauth/access_token",

  // Minimal scopes
  scopes: ["user_profile", "user_media"],

  clientIdEnvKey: "META_APP_ID",
  clientSecretEnvKey: "META_APP_SECRET",
  supportsRefreshToken: true,

  buildAuthorizeParams({ clientId, redirectUri, state, codeChallenge, codeChallengeMethod }) {
    const params = new URLSearchParams();

    params.set("client_id", clientId);
    params.set("redirect_uri", redirectUri);
    params.set("response_type", "code");
    params.set("scope", this.scopes.join(","));
    params.set("state", state);

    // PKCE parameters
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

    params.set("grant_type", "ig_refresh_token");
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
      userId: (data.user_id as string) || null,
    };
  },
};
