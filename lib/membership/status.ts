import { Profile } from "@/types";

/**
 * Check if a profile has an active membership (paid access).
 *
 * Used by client-side pages (join, onboarding, welcome) to verify
 * the user has paid before allowing access to certain flows.
 *
 * NOTE: For server-side protected layout checks, additional conditions
 * apply (admin role, is_comped, DEV_PAYWALL_BYPASS). This helper only
 * checks the standard membership + subscription status.
 */
export function hasActiveMembership(profile: Profile | null): boolean {
  if (!profile) return false;

  const validPlan =
    profile.membership_plan === "individual" ||
    profile.membership_plan === "family";

  const validStatus =
    profile.subscription_status === "trialing" ||
    profile.subscription_status === "active";

  return validPlan && validStatus;
}
