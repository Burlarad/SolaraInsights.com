/**
 * PKCE (Proof Key for Code Exchange) Utilities
 *
 * Implements RFC 7636 for OAuth 2.0 PKCE with S256 challenge method.
 * Used to prevent authorization code interception attacks.
 */

import crypto from "crypto";
import { cookies } from "next/headers";

const VERIFIER_LENGTH = 64; // 64 bytes = 512 bits of entropy
const COOKIE_MAX_AGE = 60 * 10; // 10 minutes

/**
 * Base64 URL encode (RFC 4648)
 */
function base64UrlEncode(buffer: Buffer | Uint8Array): string {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Generate a cryptographically random code verifier
 * Returns a base64url-encoded string of high entropy
 */
export function generateCodeVerifier(): string {
  const buffer = crypto.randomBytes(VERIFIER_LENGTH);
  return base64UrlEncode(buffer);
}

/**
 * Generate S256 code challenge from verifier
 * challenge = BASE64URL(SHA256(verifier))
 */
export function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return base64UrlEncode(hash);
}

/**
 * Generate a short hash of the state for cookie naming
 * Used to scope verifier cookies to specific OAuth flows
 */
function hashState(state: string): string {
  return crypto.createHash("sha256").update(state).digest("hex").slice(0, 8);
}

/**
 * Get the cookie name for a provider + state combination
 */
function getVerifierCookieName(provider: string, state: string): string {
  const stateHash = hashState(state);
  return `oauth_pkce_${provider}_${stateHash}`;
}

/**
 * Store code verifier in httpOnly cookie
 * Cookie is scoped to provider + state to prevent collisions
 */
export async function storeCodeVerifier(
  provider: string,
  state: string,
  verifier: string
): Promise<void> {
  const cookieStore = await cookies();
  const cookieName = getVerifierCookieName(provider, state);

  cookieStore.set(cookieName, verifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
}

/**
 * Retrieve and delete code verifier from cookie
 * Returns null if not found or expired
 */
export async function retrieveCodeVerifier(
  provider: string,
  state: string
): Promise<string | null> {
  const cookieStore = await cookies();
  const cookieName = getVerifierCookieName(provider, state);

  const cookie = cookieStore.get(cookieName);

  if (!cookie) {
    return null;
  }

  // Delete the cookie after retrieval (one-time use)
  cookieStore.delete(cookieName);

  return cookie.value;
}

/**
 * Generate PKCE pair (verifier + challenge)
 * Returns both for use in OAuth flow
 */
export function generatePKCEPair(): {
  verifier: string;
  challenge: string;
  challengeMethod: "S256";
} {
  const verifier = generateCodeVerifier();
  const challenge = generateCodeChallenge(verifier);

  return {
    verifier,
    challenge,
    challengeMethod: "S256",
  };
}
