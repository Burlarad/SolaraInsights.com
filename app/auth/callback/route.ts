import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Auth callback route handler
 *
 * Handles Supabase auth callbacks for:
 * - OAuth sign-in (Facebook, etc.)
 * - Email verification
 * - Password reset (PKCE flow)
 *
 * The callback receives a `code` parameter which is exchanged for a session.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/sanctuary";
  const type = requestUrl.searchParams.get("type"); // recovery, signup, etc.

  console.log(`[AuthCallback] Received callback - type: ${type}, has code: ${!!code}`);

  if (code) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("[AuthCallback] Code exchange failed:", error.message);

        // Redirect to appropriate error page based on type
        if (type === "recovery") {
          return NextResponse.redirect(
            new URL("/reset-password?error=expired", requestUrl.origin)
          );
        }

        return NextResponse.redirect(
          new URL("/sign-in?error=auth_callback_failed", requestUrl.origin)
        );
      }

      console.log(`[AuthCallback] Session established for user: ${data.user?.id}`);

      // Handle recovery flow - redirect to reset password page
      if (type === "recovery") {
        return NextResponse.redirect(new URL("/reset-password", requestUrl.origin));
      }

      // For other flows (OAuth, signup verification), redirect to next
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    } catch (err) {
      console.error("[AuthCallback] Unexpected error:", err);
      return NextResponse.redirect(
        new URL("/sign-in?error=unexpected", requestUrl.origin)
      );
    }
  }

  // No code provided - redirect to sign-in
  console.warn("[AuthCallback] No code parameter provided");
  return NextResponse.redirect(new URL("/sign-in", requestUrl.origin));
}
