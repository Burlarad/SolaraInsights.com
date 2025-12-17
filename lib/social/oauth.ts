/**
 * OAuth Provider Configuration for Social Connections
 *
 * Each provider has different OAuth flows and scopes:
 * - Facebook/Instagram: Graph API with user_posts, instagram_basic
 * - TikTok: OAuth 2.0 with user.info.basic, user.info.profile, user.info.stats
 * - X (Twitter): OAuth 2.0 with tweet.read, users.read
 * - Reddit: OAuth 2.0 with identity, history, read
 */

import { SocialProvider } from "@/types";

export interface OAuthProviderConfig {
  provider: SocialProvider;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnvKey: string;
  clientSecretEnvKey: string;
  supportsRefreshToken: boolean;
}

/**
 * OAuth configurations for each supported provider
 */
export const OAUTH_PROVIDERS: Record<SocialProvider, OAuthProviderConfig> = {
  facebook: {
    provider: "facebook",
    authorizeUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v18.0/oauth/access_token",
    scopes: ["public_profile", "user_posts"],
    clientIdEnvKey: "FACEBOOK_CLIENT_ID",
    clientSecretEnvKey: "FACEBOOK_CLIENT_SECRET",
    supportsRefreshToken: false, // FB uses long-lived tokens instead
  },
  instagram: {
    provider: "instagram",
    authorizeUrl: "https://api.instagram.com/oauth/authorize",
    tokenUrl: "https://api.instagram.com/oauth/access_token",
    scopes: ["user_profile", "user_media"],
    clientIdEnvKey: "INSTAGRAM_CLIENT_ID",
    clientSecretEnvKey: "INSTAGRAM_CLIENT_SECRET",
    supportsRefreshToken: true,
  },
  tiktok: {
    provider: "tiktok",
    authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    scopes: ["user.info.basic", "user.info.profile", "user.info.stats"],
    clientIdEnvKey: "TIKTOK_CLIENT_KEY",
    clientSecretEnvKey: "TIKTOK_CLIENT_SECRET",
    supportsRefreshToken: true,
  },
  x: {
    provider: "x",
    authorizeUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    scopes: ["tweet.read", "users.read", "offline.access"],
    clientIdEnvKey: "X_CLIENT_ID",
    clientSecretEnvKey: "X_CLIENT_SECRET",
    supportsRefreshToken: true,
  },
  reddit: {
    provider: "reddit",
    authorizeUrl: "https://www.reddit.com/api/v1/authorize",
    tokenUrl: "https://www.reddit.com/api/v1/access_token",
    scopes: ["identity", "history", "read"],
    clientIdEnvKey: "REDDIT_CLIENT_ID",
    clientSecretEnvKey: "REDDIT_CLIENT_SECRET",
    supportsRefreshToken: true,
  },
};

/**
 * Get OAuth credentials for a provider
 */
export function getOAuthCredentials(provider: SocialProvider): {
  clientId: string;
  clientSecret: string;
} {
  const config = OAUTH_PROVIDERS[provider];

  const clientId = process.env[config.clientIdEnvKey];
  const clientSecret = process.env[config.clientSecretEnvKey];

  if (!clientId || !clientSecret) {
    throw new Error(
      `OAuth credentials not configured for ${provider}. ` +
        `Set ${config.clientIdEnvKey} and ${config.clientSecretEnvKey} environment variables.`
    );
  }

  return { clientId, clientSecret };
}

/**
 * Generate the OAuth authorization URL for a provider
 */
export function generateAuthUrl(
  provider: SocialProvider,
  redirectUri: string,
  state: string
): string {
  const config = OAUTH_PROVIDERS[provider];
  const { clientId } = getOAuthCredentials(provider);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: config.scopes.join(" "),
    state,
  });

  // Provider-specific parameters
  if (provider === "x") {
    // X requires PKCE
    params.set("code_challenge", "challenge"); // Simplified - real impl needs proper PKCE
    params.set("code_challenge_method", "plain");
  }

  if (provider === "reddit") {
    params.set("duration", "permanent"); // For refresh tokens
  }

  if (provider === "tiktok") {
    // TikTok uses client_key instead of client_id
    params.delete("client_id");
    params.set("client_key", clientId);
  }

  return `${config.authorizeUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  provider: SocialProvider,
  code: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
  userId: string | null;
}> {
  const config = OAUTH_PROVIDERS[provider];
  const { clientId, clientSecret } = getOAuthCredentials(provider);

  const params: Record<string, string> = {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  };

  let headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  // Provider-specific token request handling
  if (provider === "reddit") {
    // Reddit uses Basic auth for token requests
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    headers["Authorization"] = `Basic ${credentials}`;
  } else if (provider === "tiktok") {
    params["client_key"] = clientId;
    params["client_secret"] = clientSecret;
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  } else {
    params["client_id"] = clientId;
    params["client_secret"] = clientSecret;
  }

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers,
    body: new URLSearchParams(params),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[OAuth] Token exchange failed for ${provider}:`, error);
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  const data = await response.json();

  // Normalize response across providers
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresIn: data.expires_in || null,
    userId: data.user_id || data.open_id || null, // TikTok uses open_id
  };
}

/**
 * Refresh an access token
 */
export async function refreshAccessToken(
  provider: SocialProvider,
  refreshToken: string
): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number | null;
}> {
  const config = OAUTH_PROVIDERS[provider];

  if (!config.supportsRefreshToken) {
    throw new Error(`${provider} does not support refresh tokens`);
  }

  const { clientId, clientSecret } = getOAuthCredentials(provider);

  const params: Record<string, string> = {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  };

  let headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (provider === "reddit") {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    headers["Authorization"] = `Basic ${credentials}`;
  } else if (provider === "tiktok") {
    params["client_key"] = clientId;
    params["client_secret"] = clientSecret;
  } else {
    params["client_id"] = clientId;
    params["client_secret"] = clientSecret;
  }

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers,
    body: new URLSearchParams(params),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`[OAuth] Token refresh failed for ${provider}:`, error);
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // Some providers rotate refresh tokens
    expiresIn: data.expires_in || null,
  };
}

/**
 * Get the callback URL for a provider
 */
export function getCallbackUrl(provider: SocialProvider): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return `${baseUrl}/api/social/oauth/${provider}/callback`;
}

/**
 * Check if OAuth is configured for a provider
 */
export function isOAuthConfigured(provider: SocialProvider): boolean {
  const config = OAUTH_PROVIDERS[provider];

  return !!(
    process.env[config.clientIdEnvKey] && process.env[config.clientSecretEnvKey]
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
