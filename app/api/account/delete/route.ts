import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/client";
import { Profile } from "@/types";

/**
 * POST /api/account/delete
 * Permanently deletes the user's account:
 * 1. Verifies password + confirmation text
 * 2. Cancels Stripe subscription (if exists)
 * 3. Deletes all user data from database tables
 * 4. Deletes auth user
 *
 * This is irreversible. All data is permanently deleted.
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
        { error: "Unauthorized", message: "Please sign in to delete your account." },
        { status: 401 }
      );
    }

    // Parse request body
    const { password, confirmText } = await req.json();

    // Validate confirmation text
    if (confirmText !== "DELETE") {
      return NextResponse.json(
        { error: "ConfirmationFailed", message: "Please type DELETE to confirm." },
        { status: 400 }
      );
    }

    // Verify password
    if (!password) {
      return NextResponse.json(
        { error: "PasswordRequired", message: "Password is required to delete your account." },
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

    console.log(`[Delete Account] Starting deletion for user: ${user.id}`);

    // Get user's profile for Stripe subscription info
    const admin = createAdminSupabaseClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_subscription_id, stripe_customer_id")
      .eq("id", user.id)
      .single();

    const typedProfile = profile as Pick<Profile, "stripe_subscription_id" | "stripe_customer_id"> | null;

    // Step 1: Cancel Stripe subscription if exists
    if (typedProfile?.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(typedProfile.stripe_subscription_id);
        console.log(`[Delete Account] Canceled Stripe subscription: ${typedProfile.stripe_subscription_id}`);
      } catch (stripeError: any) {
        // Log but continue - subscription might already be canceled
        console.error("[Delete Account] Failed to cancel Stripe subscription:", stripeError.message);
      }
    }

    // Step 2: Delete soul_paths (RLS-protected, service role required)
    const { error: soulPathsError } = await admin
      .from("soul_paths")
      .delete()
      .eq("user_id", user.id);

    if (soulPathsError) {
      console.error("[Delete Account] Failed to delete soul_paths:", soulPathsError);
      // Continue anyway - don't block deletion for this
    } else {
      console.log("[Delete Account] Deleted soul_paths");
    }

    // Step 3: Delete social_accounts (RLS-protected, service role required)
    const { error: socialAccountsError } = await admin
      .from("social_accounts")
      .delete()
      .eq("user_id", user.id);

    if (socialAccountsError) {
      console.error("[Delete Account] Failed to delete social_accounts:", socialAccountsError);
    } else {
      console.log("[Delete Account] Deleted social_accounts");
    }

    // Step 4: Delete social_summaries
    const { error: socialSummariesError } = await admin
      .from("social_summaries")
      .delete()
      .eq("user_id", user.id);

    if (socialSummariesError) {
      console.error("[Delete Account] Failed to delete social_summaries:", socialSummariesError);
    } else {
      console.log("[Delete Account] Deleted social_summaries");
    }

    // Step 5: Delete connections (cascades daily_briefs, space_between_reports)
    const { error: connectionsError } = await admin
      .from("connections")
      .delete()
      .eq("owner_user_id", user.id);

    if (connectionsError) {
      console.error("[Delete Account] Failed to delete connections:", connectionsError);
    } else {
      console.log("[Delete Account] Deleted connections (cascaded daily_briefs, space_between_reports)");
    }

    // Step 6: Delete profile
    const { error: profileError } = await admin
      .from("profiles")
      .delete()
      .eq("id", user.id);

    if (profileError) {
      console.error("[Delete Account] Failed to delete profile:", profileError);
      return NextResponse.json(
        { error: "DeleteFailed", message: "Failed to delete your profile. Please try again." },
        { status: 500 }
      );
    }
    console.log("[Delete Account] Deleted profile");

    // Step 7: Delete auth user using Supabase Admin API
    const { error: authError } = await admin.auth.admin.deleteUser(user.id);

    if (authError) {
      console.error("[Delete Account] Failed to delete auth user:", authError);
      return NextResponse.json(
        { error: "DeleteFailed", message: "Failed to delete your account. Please contact support." },
        { status: 500 }
      );
    }

    console.log(`[Delete Account] Successfully deleted account for user: ${user.id}`);

    return NextResponse.json({
      success: true,
      message: "Your account has been permanently deleted.",
    });
  } catch (error: any) {
    console.error("[Delete Account] Error:", error);
    return NextResponse.json(
      { error: "DeleteFailed", message: error.message || "Failed to delete account." },
      { status: 500 }
    );
  }
}
