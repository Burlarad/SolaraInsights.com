/**
 * Meta (Facebook/Instagram) OAuth Provider Adapters
 *
 * Meta-specific OAuth quirks:
 * - Facebook and Instagram share similar patterns
 * - Facebook doesn't support refresh tokens (uses long-lived tokens)
 * - Instagram supports refresh tokens
 * - Both use standard client_id/client_secret
 * - Token exchange may not return user_id, so we fetch via Graph API /me
 */

import { ProviderAdapter, NormalizedTokens } from "./types";

/**
 * Fetch Facebook user ID via Graph API /me endpoint.
 * Facebook token exchange doesn't reliably return user_id in the response,
 * so we must call the Graph API to get it.
 *
 * @param accessToken - The access token from token exchange
 * @returns The Facebook user ID
 * @throws Error if the API call fails or returns no id
 */
async function fetchFacebookUserId(accessToken: string): Promise<string> {
  const response = await fetch(
    "https://graph.facebook.com/me?fields=id",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const status = response.status;
    console.error(`[Meta OAuth] Graph API /me failed with status: ${status}`);
    throw new Error(`Failed to fetch Facebook user ID: HTTP ${status}`);
  }

  const data = await response.json();

  if (!data.id) {
    console.error("[Meta OAuth] Graph API /me returned no id");
    throw new Error("Facebook Graph API returned no user ID");
  }

  return data.id as string;
}

/**
 * Fetch Instagram user ID via Instagram Graph API.
 * Similar to Facebook, but uses Instagram's endpoint.
 *
 * @param accessToken - The access token from token exchange
 * @returns The Instagram user ID
 * @throws Error if the API call fails or returns no id
 */
async function fetchInstagramUserId(accessToken: string): Promise<string> {
  const response = await fetch(
    `https://graph.instagram.com/me?fields=id&access_token=${accessToken}`
  );

  if (!response.ok) {
    const status = response.status;
    console.error(`[Meta OAuth] Instagram Graph API /me failed with status: ${status}`);
    throw new Error(`Failed to fetch Instagram user ID: HTTP ${status}`);
  }

  const data = await response.json();

  if (!data.id) {
    console.error("[Meta OAuth] Instagram Graph API /me returned no id");
    throw new Error("Instagram Graph API returned no user ID");
  }

  return data.id as string;
}

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

  /**
   * Fetch user ID from Graph API /me if not in token response.
   * Facebook token exchange often doesn't include user_id.
   */
  fetchUserId: fetchFacebookUserId,
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

  /**
   * Fetch user ID from Instagram Graph API /me if not in token response.
   */
  fetchUserId: fetchInstagramUserId,
};
