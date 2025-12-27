import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { deleteAccountCore } from "@/lib/account/deleteAccountCore";
import { isOAuthOnly } from "@/lib/auth/helpers";
import { verifyReauth } from "@/lib/auth/reauth";

/**
 * POST /api/account/delete
 * Permanently deletes the user's account:
 * - Password users: Verifies password + confirmation text
 * - OAuth-only users: Verifies reauth_ok cookie from recent OAuth flow
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

    // Check if account is hibernated - must reactivate first
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_hibernated")
      .eq("id", user.id)
      .single();

    if (profile?.is_hibernated) {
      return NextResponse.json(
        { error: "HIBERNATED", message: "Reactivate first." },
        { status: 403 }
      );
    }

    // Parse request body
    const { password, confirmText } = await req.json();

    // Validate confirmation text (trim whitespace, case-insensitive compare via uppercase)
    const normalizedConfirm = (confirmText || "").trim().toUpperCase();
    if (normalizedConfirm !== "DELETE") {
      return NextResponse.json(
        { error: "ConfirmationFailed", message: "Please type DELETE to confirm." },
        { status: 400 }
      );
    }

    // Verify identity based on auth type
    const userIsOAuthOnly = isOAuthOnly(user);

    if (userIsOAuthOnly) {
      // OAuth-only users: verify reauth_ok cookie
      const reauthValid = await verifyReauth(user.id, "delete");

      if (!reauthValid) {
        return NextResponse.json(
          {
            error: "ReauthRequired",
            message: "Please re-authenticate with your social provider to continue.",
          },
          { status: 401 }
        );
      }

      console.log(`[Delete Account] OAuth-only user ${user.id} verified via reauth`);
    } else {
      // Password users: verify password
      if (!password) {
        return NextResponse.json(
          { error: "PasswordRequired", message: "Password is required to delete your account." },
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

      console.log(`[Delete Account] Password user ${user.id} verified via password`);
    }

    // Use shared deletion logic
    const result = await deleteAccountCore({
      userId: user.id,
      source: "user_request",
    });

    if (!result.success) {
      console.error("[Delete Account] Deletion failed:", result.errors);
      return NextResponse.json(
        { error: "DeleteFailed", message: "Failed to delete your account. Please contact support." },
        { status: 500 }
      );
    }

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
