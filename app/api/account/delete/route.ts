import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { deleteAccountCore } from "@/lib/account/deleteAccountCore";
import { isOAuthOnly } from "@/lib/auth/helpers";
import { verifyReauth } from "@/lib/auth/reauth";

/**
 * App-specific cookies that should be cleared on account deletion.
 * These are in addition to any sb-* Supabase auth cookies.
 */
const APP_COOKIES_TO_CLEAR = [
  "reauth_ok",
  "reauth_intent",
  "tiktok_login_state",
  "social_oauth_state",
  "facebook_reauth_state",
  "tiktok_reauth_state",
  "google_reauth_state",
];

/**
 * POST /api/account/delete
 * Permanently deletes the user's account:
 * - Password users: Verifies password + confirmation text
 * - OAuth-only users: Verifies reauth_ok cookie from recent OAuth flow
 *
 * This is irreversible. All data is permanently deleted.
 *
 * After deletion, all auth cookies are cleared server-side to ensure
 * the user is immediately logged out.
 */
export async function POST(req: NextRequest) {
  try {
    // Get authenticated user and capture userId FIRST
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

    // Store userId before any operations that might invalidate the session
    const userId = user.id;

    // Check if account is hibernated - must reactivate first
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_hibernated")
      .eq("id", userId)
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
      const reauthValid = await verifyReauth(userId, "delete");

      if (!reauthValid) {
        return NextResponse.json(
          {
            error: "ReauthRequired",
            message: "Please re-authenticate with your social provider to continue.",
          },
          { status: 401 }
        );
      }

      console.log(`[Delete Account] OAuth-only user ${userId} verified via reauth`);
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

      console.log(`[Delete Account] Password user ${userId} verified via password`);
    }

    // Attempt server-side signOut before deletion (best effort, don't rely on it)
    try {
      await supabase.auth.signOut();
      console.log(`[Delete Account] Server-side signOut completed for ${userId}`);
    } catch (signOutError) {
      console.warn(`[Delete Account] Server-side signOut failed (continuing):`, signOutError);
    }

    // Execute account deletion
    const result = await deleteAccountCore({
      userId,
      source: "user_request",
    });

    if (!result.success) {
      console.error("[Delete Account] Deletion failed:", result.errors);
      return NextResponse.json(
        { error: "DeleteFailed", message: "Failed to delete your account. Please contact support." },
        { status: 500 }
      );
    }

    console.log(`[Delete Account] Account deleted successfully for ${userId}`);

    // Build response with cookie-clearing headers
    const response = NextResponse.json({
      success: true,
      message: "Your account has been permanently deleted.",
    });

    // Prevent caching of this response
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("Pragma", "no-cache");

    // Clear all Supabase auth cookies (sb-*) and app cookies
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    for (const cookie of allCookies) {
      // Clear any Supabase auth cookies
      if (cookie.name.startsWith("sb-")) {
        response.cookies.set(cookie.name, "", {
          path: "/",
          maxAge: 0,
          expires: new Date(0),
        });
        console.log(`[Delete Account] Cleared cookie: ${cookie.name}`);
      }

      // Clear PKCE verifier cookies
      if (cookie.name.startsWith("oauth_pkce_")) {
        response.cookies.set(cookie.name, "", {
          path: "/",
          maxAge: 0,
          expires: new Date(0),
        });
        console.log(`[Delete Account] Cleared cookie: ${cookie.name}`);
      }
    }

    // Clear known app cookies explicitly
    for (const cookieName of APP_COOKIES_TO_CLEAR) {
      response.cookies.set(cookieName, "", {
        path: "/",
        maxAge: 0,
        expires: new Date(0),
      });
    }

    console.log(`[Delete Account] All auth cookies cleared for deleted user ${userId}`);

    return response;
  } catch (error: any) {
    console.error("[Delete Account] Error:", error);
    return NextResponse.json(
      { error: "DeleteFailed", message: error.message || "Failed to delete account." },
      { status: 500 }
    );
  }
}
