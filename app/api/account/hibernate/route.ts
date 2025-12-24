import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { Profile } from "@/types";

/**
 * POST /api/account/hibernate
 * Hibernates the user's account:
 * 1. Verifies password
 * 2. Pauses Stripe billing (if subscription exists)
 * 3. Sets is_hibernated = true
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

    // Validate confirmation text
    if (confirmText !== "HIBERNATE") {
      return NextResponse.json(
        { error: "ConfirmationFailed", message: "Please type HIBERNATE to confirm." },
        { status: 400 }
      );
    }

    // Verify password
    if (!password) {
      return NextResponse.json(
        { error: "PasswordRequired", message: "Password is required to hibernate your account." },
        { status: 400 }
      );
    }

    // Re-authenticate to verify password
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

    // Check if already hibernated
    if (typedProfile.is_hibernated) {
      return NextResponse.json(
        { error: "AlreadyHibernated", message: "Your account is already hibernated." },
        { status: 400 }
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
