import { User } from "@supabase/supabase-js";

/**
 * Get the primary Facebook identity from a Supabase user object
 */
export function getPrimaryFacebookIdentity(user: User | null) {
  if (!user || !user.identities) return null;
  return user.identities.find((id) => id.provider === "facebook") || null;
}

/**
 * Extract display name from a social identity
 */
export function getIdentityDisplayName(identity: any): string {
  if (!identity || !identity.identity_data) return "Unknown";

  // Try various common fields
  return (
    identity.identity_data.full_name ||
    identity.identity_data.name ||
    identity.identity_data.username ||
    identity.identity_data.email ||
    "Unknown"
  );
}
