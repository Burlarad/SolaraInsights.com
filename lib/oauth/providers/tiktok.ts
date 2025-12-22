/**
 * TikTok OAuth Provider Adapter
 *
 * TikTok-specific OAuth quirks:
 * - Uses `client_key` instead of `client_id`
 * - Returns `open_id` instead of `user_id`
 * - MVP: Only user.info.basic scope (auto-approved in sandbox)
 */

import { ProviderAdapter, NormalizedTokens } from "./types";

export const tiktokAdapter: ProviderAdapter = {
  provider: "tiktok",
  authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
  tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",

  // MVP: Only request user.info.basic (auto-approved in TikTok sandbox)
  // TODO: Add user.info.profile and user.info.stats after portal approval
  scopes: ["user.info.basic"],

  clientIdEnvKey: "TIKTOK_CLIENT_KEY",
  clientSecretEnvKey: "TIKTOK_CLIENT_SECRET",
  supportsRefreshToken: true,

  buildAuthorizeParams({ clientId, redirectUri, state, codeChallenge, codeChallengeMethod }) {
    const params = new URLSearchParams();

    // TikTok uses client_key instead of client_id
    params.set("client_key", clientId);
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
    params.set("client_key", clientId);
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
    params.set("client_key", clientId);
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
      // TikTok uses open_id instead of user_id
      userId: (data.open_id as string) || null,
    };
  },
};
