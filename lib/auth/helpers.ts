import { User } from "@supabase/supabase-js";

/**
 * Auth type detection helpers
 *
 * Supabase stores linked auth providers in user.identities[].
 * The "email" provider indicates the user has a password credential.
 * OAuth-only users will only have providers like "facebook", "google", etc.
 */

/**
 * Check if user has a password credential (email provider)
 * Works on both client and server with Supabase User object
 */
export function hasPasswordCredential(user: User | null): boolean {
  if (!user || !user.identities) return false;
  return user.identities.some((identity) => identity.provider === "email");
}

/**
 * Check if user is OAuth-only (no password credential)
 */
export function isOAuthOnly(user: User | null): boolean {
  return !hasPasswordCredential(user);
}

/**
 * Get the primary OAuth provider for a user (first non-email identity)
 */
export function getPrimaryOAuthProvider(user: User | null): string | null {
  if (!user || !user.identities) return null;
  const oauthIdentity = user.identities.find((id) => id.provider !== "email");
  return oauthIdentity?.provider || null;
}

/**
 * Get all linked OAuth providers for a user
 */
export function getLinkedOAuthProviders(user: User | null): string[] {
  if (!user || !user.identities) return [];
  return user.identities
    .filter((id) => id.provider !== "email")
    .map((id) => id.provider);
}
