import { User } from "@supabase/supabase-js";

/**
 * Auth type detection helpers
 *
 * Supabase stores linked auth providers in user.identities[].
 * The "email" provider indicates the user has a password credential.
 * OAuth-only users will only have providers like "facebook", "google", etc.
 */

/**
 * Check if user has a password credential
 * Works on both client and server with Supabase User object
 *
 * A user has a password if:
 * 1. They have an "email" identity (signed up with email/password), OR
 * 2. They have has_password=true in user_metadata (OAuth user who added a password)
 *
 * IMPORTANT: TikTok users created via admin.createUser({ email: placeholder })
 * get an "email" identity automatically, but they DON'T have a password.
 * We must check placeholder_email metadata first to handle this case.
 */
export function hasPasswordCredential(user: User | null): boolean {
  if (!user) return false;

  // Users with placeholder emails (TikTok, etc.) don't have passwords
  // unless they explicitly created one via Settings
  if (user.user_metadata?.placeholder_email === true) {
    return user.user_metadata?.has_password === true;
  }

  // Check for email identity (native email/password signup)
  const hasEmailIdentity = user.identities?.some((identity) => identity.provider === "email") ?? false;
  if (hasEmailIdentity) return true;

  // Check for password added via Settings (OAuth user who created a password)
  const hasPasswordMetadata = user.user_metadata?.has_password === true;
  return hasPasswordMetadata;
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
 * Get all linked OAuth providers for a user (Supabase-native only)
 */
export function getLinkedOAuthProviders(user: User | null): string[] {
  if (!user || !user.identities) return [];
  return user.identities
    .filter((id) => id.provider !== "email")
    .map((id) => id.provider);
}

/**
 * Check if user is a custom OAuth user (TikTok, X, etc.)
 * These users don't have Supabase-native identities
 */
export function isCustomOAuthUser(user: User | null): boolean {
  if (!user) return false;
  const provider = user.user_metadata?.oauth_provider;
  return provider === "tiktok" || provider === "x";
}

/**
 * Get the custom OAuth provider for a user
 * Returns null if not a custom OAuth user
 */
export function getCustomOAuthProvider(user: User | null): string | null {
  if (!user) return null;
  const provider = user.user_metadata?.oauth_provider;
  // Only return recognized custom OAuth providers
  if (provider === "tiktok" || provider === "x") return provider;
  return null;
}

/**
 * Get the primary provider for a user (including custom OAuth)
 * Prioritizes Supabase-native, falls back to custom OAuth
 */
export function getPrimaryProvider(user: User | null): string | null {
  // First check Supabase-native OAuth
  const nativeProvider = getPrimaryOAuthProvider(user);
  if (nativeProvider) return nativeProvider;

  // Then check custom OAuth
  return getCustomOAuthProvider(user);
}
