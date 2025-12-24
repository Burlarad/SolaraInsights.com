import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { Profile } from "@/types";

/**
 * POST /api/account/reactivate
 * Reactivates a hibernated account:
 * 1. Verifies password
 * 2. Resumes Stripe billing (if subscription exists)
 * 3. Sets is_hibernated = false, reactivated_at = now()
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
        { error: "Unauthorized", message: "Please sign in to reactivate your account." },
        { status: 401 }
      );
    }

    // Parse request body
    const { password } = await req.json();

    // Verify password
    if (!password) {
      return NextResponse.json(
        { error: "PasswordRequired", message: "Password is required to reactivate your account." },
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

    // Check if already active
    if (!typedProfile.is_hibernated) {
      return NextResponse.json(
        { error: "NotHibernated", message: "Your account is already active." },
        { status: 400 }
      );
    }

    // Resume Stripe subscription if it exists
    if (typedProfile.stripe_subscription_id) {
      try {
        await stripe.subscriptions.update(typedProfile.stripe_subscription_id, {
          pause_collection: null, // Remove the pause
        });
        console.log(`[Reactivate] Resumed Stripe subscription: ${typedProfile.stripe_subscription_id}`);
      } catch (stripeError: any) {
        console.error("[Reactivate] Failed to resume Stripe subscription:", stripeError.message);
        // Don't fail - user might need to manually resubscribe
        // The important thing is they can access their account
      }
    }

    // Update profile to active state
    const admin = createAdminSupabaseClient();
    const { error: updateError } = await admin
      .from("profiles")
      .update({
        is_hibernated: false,
        reactivated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("[Reactivate] Failed to update profile:", updateError);
      return NextResponse.json(
        { error: "ReactivateFailed", message: "Failed to reactivate your account. Please try again." },
        { status: 500 }
      );
    }

    console.log(`[Reactivate] Account reactivated for user: ${user.id}`);

    return NextResponse.json({
      success: true,
      message: "Welcome back! Your account has been reactivated.",
    });
  } catch (error: any) {
    console.error("[Reactivate] Error:", error);
    return NextResponse.json(
      { error: "ReactivateFailed", message: error.message || "Failed to reactivate account." },
      { status: 500 }
    );
  }
}
