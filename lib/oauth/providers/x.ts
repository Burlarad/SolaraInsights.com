/**
 * X (Twitter) OAuth Provider Adapter
 *
 * ============================================================================
 * STATUS: DISABLED - Requires X Basic tier ($100/month)
 * ============================================================================
 *
 * X Free tier ($0/month) blocks the /users/me endpoint which is required
 * to get the user ID for authentication. Without the user ID, we cannot:
 * - Create a user account linked to X
 * - Look up existing users by their X identity
 * - Store OAuth tokens for the user
 *
 * The code is fully implemented and tested - just waiting for budget.
 *
 * To enable X OAuth:
 * 1. Upgrade to X Basic tier ($100/month) at developer.twitter.com
 * 2. Set X_OAUTH_ENABLED=true in .env and .env.local
 * 3. Set NEXT_PUBLIC_X_OAUTH_ENABLED=true in .env and .env.local
 * 4. Search codebase for "X OAuth disabled" and uncomment X buttons
 * 5. Test the full OAuth flow end-to-end
 *
 * X-specific OAuth quirks:
 * - Requires PKCE (S256) - mandatory
 * - Token exchange uses Basic auth (base64 client_id:client_secret)
 * - User ID must be fetched separately via /2/users/me endpoint
 * - Feature-flagged via X_OAUTH_ENABLED environment variable
 */

import { ProviderAdapter, NormalizedTokens } from "./types";

/**
 * Check if X OAuth is enabled
 */
export function isXOAuthEnabled(): boolean {
  return process.env.X_OAUTH_ENABLED?.toLowerCase() === "true";
}

export const xAdapter: ProviderAdapter = {
  provider: "x",
  authorizeUrl: "https://twitter.com/i/oauth2/authorize",
  tokenUrl: "https://api.twitter.com/2/oauth2/token",

  // Minimal scopes for login - Free tier only supports users.read
  // Add tweet.read and offline.access later if upgrading to Basic tier
  scopes: ["users.read"],

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

  buildTokenRequestBody({ code, redirectUri, codeVerifier }) {
    // X uses Basic auth for client credentials, so don't include them in body
    const params = new URLSearchParams();

    params.set("grant_type", "authorization_code");
    params.set("code", code);
    params.set("redirect_uri", redirectUri);
    params.set("code_verifier", codeVerifier);

    return params;
  },

  buildTokenRequestHeaders({ clientId, clientSecret }) {
    // X requires Basic auth with base64(client_id:client_secret)
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    return {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    };
  },

  buildRefreshRequestBody({ refreshToken }) {
    // X uses Basic auth for client credentials
    const params = new URLSearchParams();

    params.set("grant_type", "refresh_token");
    params.set("refresh_token", refreshToken);

    return params;
  },

  buildRefreshRequestHeaders({ clientId, clientSecret }) {
    // X requires Basic auth with base64(client_id:client_secret)
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    return {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    };
  },

  parseTokenResponse(data): NormalizedTokens {
    // Log token response structure (keys only, not values) for debugging
    console.log(`[X OAuth] Token response keys:`, Object.keys(data));
    console.log(`[X OAuth] Token response structure:`, JSON.stringify(
      Object.fromEntries(
        Object.entries(data).map(([key, value]) => {
          // Mask sensitive values, show structure for others
          if (key.includes('token') || key.includes('secret')) {
            return [key, `[${typeof value}:${String(value).length} chars]`];
          }
          return [key, value];
        })
      ),
      null,
      2
    ));

    // Check if X returns user ID in token response (some OAuth implementations do)
    const userId = data.user_id || data.sub || data.id || null;
    if (userId) {
      console.log(`[X OAuth] Found user_id in token response: ${userId}`);
    }

    return {
      accessToken: data.access_token as string,
      refreshToken: (data.refresh_token as string) || null,
      expiresIn: (data.expires_in as number) || null,
      userId: userId ? String(userId) : null,
    };
  },

  /**
   * Fetch user ID from X API after token exchange
   *
   * X Free tier returns 403 on /users/me endpoint.
   * We try multiple strategies:
   * 1. Check if user_id was already extracted from token response (see parseTokenResponse)
   * 2. Try to decode the access token as a JWT to get the `sub` claim
   * 3. Fall back to /users/me endpoint (only works for paid tiers)
   */
  async fetchUserId(accessToken: string): Promise<string> {
    console.log(`[X OAuth] Attempting to get user ID...`);
    console.log(`[X OAuth] Access token format check:`);
    console.log(`[X OAuth]   - Length: ${accessToken.length}`);
    console.log(`[X OAuth]   - First 20 chars: ${accessToken.substring(0, 20)}...`);
    console.log(`[X OAuth]   - Contains dots: ${accessToken.includes('.')}`);
    console.log(`[X OAuth]   - Dot count: ${(accessToken.match(/\./g) || []).length}`);

    // Strategy 1: Try to decode as JWT (some X tokens are JWTs with `sub` claim)
    try {
      const parts = accessToken.split(".");
      if (parts.length === 3) {
        console.log(`[X OAuth] Token appears to be a JWT (3 parts), attempting decode...`);
        // Decode the payload (second part of JWT)
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
        console.log(`[X OAuth] JWT payload keys:`, Object.keys(payload));
        console.log(`[X OAuth] JWT payload (non-sensitive):`, JSON.stringify({
          ...payload,
          // Redact any potentially sensitive fields
          aud: payload.aud ? '[present]' : undefined,
          iss: payload.iss,
          sub: payload.sub,
          exp: payload.exp,
          iat: payload.iat,
        }, null, 2));

        if (payload.sub) {
          console.log(`[X OAuth] ✅ Extracted user ID from JWT sub claim: ${payload.sub}`);
          return payload.sub;
        } else {
          console.log(`[X OAuth] JWT has no sub claim`);
        }
      } else {
        console.log(`[X OAuth] Token is NOT a JWT (${parts.length} parts instead of 3)`);
      }
    } catch (jwtError: any) {
      console.log(`[X OAuth] Could not decode as JWT: ${jwtError.message}`);
    }

    // Strategy 2: Fall back to /users/me endpoint (only works for paid tiers)
    const url = "https://api.twitter.com/2/users/me?user.fields=id";
    console.log(`[X OAuth] Trying /users/me endpoint (requires X Basic tier or higher)...`);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log(`[X OAuth] /users/me response status: ${response.status}`);

    if (response.status === 403) {
      const errorText = await response.text();
      console.error(`[X OAuth] ❌ /users/me returned 403 (Forbidden)`);
      console.error(`[X OAuth] This typically means X Free tier doesn't allow /users/me`);
      console.error(`[X OAuth] Response body:`, errorText);
      throw new Error(
        `X OAuth failed: Cannot get user ID. ` +
        `Free tier blocks /users/me and token is not a decodable JWT. ` +
        `Options: 1) Upgrade to X Basic tier ($100/mo), or 2) Disable X OAuth.`
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[X OAuth] /users/me failed: ${response.status}`, errorText);
      throw new Error(`Failed to fetch X user info: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const userId = data.data?.id;

    if (!userId) {
      throw new Error("X API returned no user ID");
    }

    console.log(`[X OAuth] ✅ User ID from /users/me: ${userId}`);
    return userId;
  },
};
