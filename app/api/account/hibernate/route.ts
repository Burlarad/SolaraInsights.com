import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { Profile } from "@/types";
import { isOAuthOnly } from "@/lib/auth/helpers";
import { verifyReauth, clearReauth } from "@/lib/auth/reauth";

/**
 * POST /api/account/hibernate
 * Hibernates the user's account:
 * - Password users: Verifies password + confirmation text
 * - OAuth-only users: Verifies reauth_ok cookie from recent OAuth flow
 * Then:
 * 1. Pauses Stripe billing (if subscription exists)
 * 2. Sets is_hibernated = true
 */
export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in to hibernate your account." },
        { status: 401 }
      );
    }

    // Parse request body
    const { password, confirmText } = await req.json();

    // Validate confirmation text (trim whitespace, case-insensitive compare via uppercase)
    const normalizedConfirm = (confirmText || "").trim().toUpperCase();
    if (normalizedConfirm !== "HIBERNATE") {
      return NextResponse.json(
        { error: "ConfirmationFailed", message: "Please type HIBERNATE to confirm." },
        { status: 400 }
      );
    }

    // Verify identity based on auth type
    const userIsOAuthOnly = isOAuthOnly(user);

    if (userIsOAuthOnly) {
      // OAuth-only users: verify reauth_ok cookie
      const reauthValid = await verifyReauth(user.id, "hibernate");

      if (!reauthValid) {
        return NextResponse.json(
          {
            error: "ReauthRequired",
            message: "Please re-authenticate with your social provider to continue.",
          },
          { status: 401 }
        );
      }

      console.log(`[Hibernate] OAuth-only user ${user.id} verified via reauth`);
    } else {
      // Password users: verify password
      if (!password) {
        return NextResponse.json(
          { error: "PasswordRequired", message: "Password is required to hibernate your account." },
          { status: 400 }
        );
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password,
      });

      if (signInError) {
        return NextResponse.json(
          { error: "InvalidPassword", message: "Incorrect password. Please try again." },
          { status: 401 }
        );
      }

      console.log(`[Hibernate] Password user ${user.id} verified via password`);
    }

    // Get user's profile to check subscription
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_subscription_id, is_hibernated")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "ProfileNotFound", message: "Could not find your profile." },
        { status: 404 }
      );
    }

    const typedProfile = profile as Pick<Profile, "stripe_subscription_id" | "is_hibernated">;

    // Check if already hibernated - must reactivate first
    if (typedProfile.is_hibernated) {
      return NextResponse.json(
        { error: "HIBERNATED", message: "Reactivate first." },
        { status: 403 }
      );
    }

    // Pause Stripe subscription if it exists
    if (typedProfile.stripe_subscription_id) {
      try {
        await stripe.subscriptions.update(typedProfile.stripe_subscription_id, {
          pause_collection: {
            behavior: "mark_uncollectible",
          },
        });
        console.log(`[Hibernate] Paused Stripe subscription: ${typedProfile.stripe_subscription_id}`);
      } catch (stripeError: any) {
        console.error("[Hibernate] Failed to pause Stripe subscription:", stripeError.message);
        // Continue anyway - we still want to hibernate the account
        // The subscription might be already canceled or in an unusual state
      }
    }

    // Update profile to hibernated state
    const admin = createAdminSupabaseClient();
    const { error: updateError } = await admin
      .from("profiles")
      .update({
        is_hibernated: true,
        hibernated_at: new Date().toISOString(),
        reactivated_at: null, // Clear any previous reactivation timestamp
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("[Hibernate] Failed to update profile:", updateError);
      return NextResponse.json(
        { error: "HibernateFailed", message: "Failed to hibernate your account. Please try again." },
        { status: 500 }
      );
    }

    console.log(`[Hibernate] Account hibernated for user: ${user.id}`);

    // Clear reauth cookie if it was used
    if (userIsOAuthOnly) {
      await clearReauth();
    }

    return NextResponse.json({
      success: true,
      message: "Your account has been hibernated. You can reactivate it anytime.",
    });
  } catch (error: any) {
    console.error("[Hibernate] Error:", error);
    return NextResponse.json(
      { error: "HibernateFailed", message: error.message || "Failed to hibernate account." },
      { status: 500 }
    );
  }
}
