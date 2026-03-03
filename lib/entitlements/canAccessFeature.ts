import { Profile } from "@/types";

/**
 * Features that are gated behind premium membership.
 * Passed to canAccessFeature() at the API route level.
 *
 * Feature map:
 *   year_insight      — Yearly insight tab (/api/insights, timeframe=year)
 *   space_between     — Deep relationship report (/api/connection-space-between)
 *   library_generate  — Generate official or checkout chart/numerology book
 *   library_load      — Load a previously generated book (post-cancel retention)
 *   social_insights   — Social insights feature
 */
export type Feature =
  | "year_insight"
  | "space_between"
  | "library_generate"
  | "library_load"
  | "social_insights";

export interface AccessResult {
  allowed: boolean;
  errorCode?: "PREMIUM_REQUIRED" | "UNAUTHORIZED";
  message?: string;
}

type MembershipProfile = Pick<
  Profile,
  "membership_plan" | "subscription_status" | "role" | "is_comped"
>;

/**
 * Returns true if the profile has active premium access.
 *
 * Includes:
 *   - Admin role
 *   - Comped accounts
 *   - Active/trialing subscriptions (individual or family plan)
 *
 * Past-due subscriptions are NOT granted access. Users must update their
 * payment method via the Stripe billing portal (/settings → Manage billing).
 *
 * Hard safety: DEV_PAYWALL_BYPASS is NEVER active in production.
 */
export function isPremium(profile: MembershipProfile): boolean {
  if (profile.role === "admin") return true;
  if (profile.is_comped === true) return true;

  // Dev bypass — hard-safe, never activates in production
  if (
    process.env.DEV_PAYWALL_BYPASS === "true" &&
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_SITE_URL !== "https://solarainsights.com"
  ) {
    return true;
  }

  const hasPlan =
    profile.membership_plan === "individual" ||
    profile.membership_plan === "family";

  const hasActiveStatus =
    profile.subscription_status === "active" ||
    profile.subscription_status === "trialing";

  return hasPlan && hasActiveStatus;
}

/**
 * Returns true if the user ever had a paid plan (membership_plan !== "none").
 * Used for post-cancellation data retention: canceled users can still
 * read books they generated while premium.
 */
function hasEverPaid(profile: MembershipProfile): boolean {
  return profile.membership_plan !== "none";
}

/**
 * Async check: returns true if userId is an active member of an active/trialing
 * seat account owned by someone else.
 *
 * Used as a fallback in gated API routes when canAccessFeature() returns false
 * (the user lacks their own premium subscription). Two-query pattern:
 *   1. Find an active seat_members row for this user
 *   2. Verify the corresponding seat_account is active or trialing
 *
 * Called after canAccessFeature — only when !accessResult.allowed.
 *
 * @param userId  The authenticated user's UUID
 * @param supabase  A server Supabase client (user context or admin; either works for reads)
 */
export async function checkSeatMemberAccess(
  userId: string,
  supabase: any
): Promise<boolean> {
  const { data: member } = await supabase
    .from("seat_members")
    .select("seat_account_id")
    .eq("accepted_user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (!member) return false;

  const { data: account } = await supabase
    .from("seat_accounts")
    .select("status")
    .eq("id", member.seat_account_id)
    .in("status", ["active", "trialing"])
    .maybeSingle();

  return !!account;
}

/**
 * Canonical server-side entitlement check.
 *
 * Returns { allowed: true } when the user can access the feature.
 * Returns { allowed: false, errorCode, message } when blocked.
 *
 * Usage:
 *   const result = canAccessFeature(profile, "space_between");
 *   if (!result.allowed) {
 *     return NextResponse.json(buildAccessDeniedPayload(result), { status: 403 });
 *   }
 *
 * IMPORTANT: Call this after authenticating the user and loading their profile.
 * Do NOT call before auth — pass null if profile could not be loaded.
 */
export function canAccessFeature(
  profile: MembershipProfile | null,
  feature: Feature
): AccessResult {
  if (!profile) {
    return {
      allowed: false,
      errorCode: "UNAUTHORIZED",
      message: "Sign in to continue.",
    };
  }

  // Admin and comped users always have full access
  if (profile.role === "admin" || profile.is_comped === true) {
    return { allowed: true };
  }

  // Dev bypass (hard-safe, never activates in production)
  if (
    process.env.DEV_PAYWALL_BYPASS === "true" &&
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_SITE_URL !== "https://solarainsights.com"
  ) {
    return { allowed: true };
  }

  const premium = isPremium(profile);

  switch (feature) {
    case "year_insight":
    case "space_between":
    case "library_generate":
    case "social_insights":
      if (!premium) {
        return {
          allowed: false,
          errorCode: "PREMIUM_REQUIRED",
          message: "This feature requires a Premium membership.",
        };
      }
      return { allowed: true };

    case "library_load":
      // Premium users: full access to all shelf books
      if (premium) return { allowed: true };
      // Post-cancellation retention: canceled users can read books they generated
      // while premium. The route enforces shelf ownership — only their own books.
      if (hasEverPaid(profile)) return { allowed: true };
      // Free users who never paid: no shelf books exist, block cleanly
      return {
        allowed: false,
        errorCode: "PREMIUM_REQUIRED",
        message: "This feature requires a Premium membership.",
      };

    default:
      return { allowed: true };
  }
}

/**
 * Builds the JSON body for a 403/401 access denied response.
 *
 * Keep this in lib/ (not importing Next.js) so routes build the response:
 *   return NextResponse.json(buildAccessDeniedPayload(result), { status: 403 });
 */
export function buildAccessDeniedPayload(result: AccessResult): {
  error: string;
  errorCode: string;
  message: string;
  upgradeUrl: string;
} {
  return {
    error: result.errorCode === "UNAUTHORIZED" ? "Unauthorized" : "Premium Required",
    errorCode: result.errorCode ?? "PREMIUM_REQUIRED",
    message: result.message ?? "This feature requires a Premium membership.",
    upgradeUrl: "/join",
  };
}
