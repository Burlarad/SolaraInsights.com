import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { claimCheckoutSession } from "@/lib/stripe/claimCheckoutSession";

/**
 * Get the correct base URL for redirects.
 *
 * IMPORTANT: In reverse proxy/tunnel environments (Cloudflare, ngrok, etc.),
 * request.url will show the internal URL (e.g., localhost:3000) not the
 * external URL the user accessed. We MUST use NEXT_PUBLIC_SITE_URL instead.
 */
function getBaseUrl(request: NextRequest): string {
  // First priority: Use configured site URL (required for tunnels/proxies)
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredUrl) {
    return configuredUrl;
  }

  // Fallback: Try to detect from X-Forwarded headers (reverse proxy standard)
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  // Last resort: Use request URL (only works without proxy/tunnel)
  const requestUrl = new URL(request.url);
  return requestUrl.origin;
}

// Reauth cookie validity: 5 minutes
const REAUTH_OK_MAX_AGE = 5 * 60;

/**
 * Auth callback route handler
 *
 * Handles Supabase auth callbacks for:
 * - OAuth sign-in (Facebook, etc.)
 * - Email verification
 * - Password reset (PKCE flow)
 * - Reauth flow for OAuth-only users (type=reauth)
 *
 * The callback receives a `code` parameter which is exchanged for a session.
 *
 * NOTE: For OAuth flows, we redirect to /auth/post-callback which reads
 * the final destination from sessionStorage. This is because Supabase
 * strips query params from redirectTo URLs.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type"); // recovery, signup, etc.

  // Get the correct base URL (handles reverse proxy/tunnel scenarios)
  const baseUrl = getBaseUrl(request);

  // Debug logging for OAuth redirect investigation
  console.log(`[AuthCallback] ========== CALLBACK DEBUG ==========`);
  console.log(`[AuthCallback] Full URL: ${request.url}`);
  console.log(`[AuthCallback] Request Origin: ${requestUrl.origin}`);
  console.log(`[AuthCallback] NEXT_PUBLIC_SITE_URL: ${process.env.NEXT_PUBLIC_SITE_URL || "(not set)"}`);
  console.log(`[AuthCallback] Using baseUrl: ${baseUrl}`);
  console.log(`[AuthCallback] Code present: ${!!code}`);
  console.log(`[AuthCallback] Type: ${type || "(none)"}`);
  console.log(`[AuthCallback] ====================================`);

  if (code) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("[AuthCallback] Code exchange failed:", error.message);

        // Redirect to appropriate error page based on type
        if (type === "recovery") {
          return NextResponse.redirect(
            new URL("/reset-password?error=expired", baseUrl)
          );
        }

        return NextResponse.redirect(
          new URL("/sign-in?error=auth_callback_failed", baseUrl)
        );
      }

      console.log(`[AuthCallback] Session established for user: ${data.user?.id}`);

      // Track if checkout claim succeeded (for conditional cookie clearing)
      let checkoutClaimed = false;

      // Ensure profile exists (prevents bounce to /join due to missing profile)
      // This is critical for OAuth flows where Supabase creates auth user but not profile
      if (data.user) {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", data.user.id)
          .single();

        if (!existingProfile) {
          console.log(`[AuthCallback] Creating minimal profile for user: ${data.user.id}`);

          // Detect timezone from request headers if possible
          const timezone = Intl.DateTimeFormat().resolvedOptions?.().timeZone || "America/Los_Angeles";

          const { error: insertError } = await supabase.from("profiles").insert({
            id: data.user.id,
            email: data.user.email || "",
            timezone,
            language: "en",
            is_onboarded: false,
            social_insights_enabled: false,
            is_hibernated: false,
            role: "user",
            membership_plan: "none",
          });

          if (insertError) {
            console.error(`[AuthCallback] Profile creation failed:`, insertError.message);
            // Continue anyway - SettingsProvider will create profile as fallback
          } else {
            console.log(`[AuthCallback] Profile created successfully`);
          }
        }

        // Claim Stripe checkout session if cookie is present
        // This links the payment to the current user by ID (not email)
        const cookieStore = await cookies();
        const checkoutSessionCookie = cookieStore.get("solara_checkout_session");

        if (checkoutSessionCookie?.value?.startsWith("cs_")) {
          console.log(`[AuthCallback] Found checkout session cookie, attempting to claim...`);

          const adminSupabase = createAdminSupabaseClient();
          const claimResult = await claimCheckoutSession(
            checkoutSessionCookie.value,
            data.user.id,
            adminSupabase
          );

          console.log(`[AuthCallback] Claim result: ${JSON.stringify(claimResult)}`);
          checkoutClaimed = claimResult.claimed;

          if (!claimResult.claimed) {
            console.warn(`[AuthCallback] Checkout claim failed: ${claimResult.reason}`);
          }
        }
      }

      // Handle recovery flow - redirect to reset password page
      if (type === "recovery") {
        console.log(`[AuthCallback] Recovery flow - redirecting to /reset-password`);
        return NextResponse.redirect(new URL("/reset-password", baseUrl));
      }

      // Handle reauth flow for OAuth-only users
      if (type === "reauth") {
        const cookieStore = await cookies();
        const intentCookie = cookieStore.get("reauth_intent");

        if (!intentCookie) {
          console.warn("[AuthCallback] Reauth flow but no intent cookie found");
          return NextResponse.redirect(new URL("/settings?error=reauth_expired", baseUrl));
        }

        try {
          const intentData = JSON.parse(intentCookie.value);

          // Verify user matches intent
          if (intentData.userId !== data.user?.id) {
            console.error("[AuthCallback] Reauth user mismatch");
            cookieStore.delete("reauth_intent");
            return NextResponse.redirect(new URL("/settings?error=reauth_mismatch", baseUrl));
          }

          // Check intent hasn't expired (10 min max)
          const intentAge = Date.now() - intentData.createdAt;
          if (intentAge > 10 * 60 * 1000) {
            console.warn("[AuthCallback] Reauth intent expired");
            cookieStore.delete("reauth_intent");
            return NextResponse.redirect(new URL("/settings?error=reauth_expired", baseUrl));
          }

          // Set reauth_ok cookie (5-minute validity)
          const reauthOkData = {
            intent: intentData.intent,
            userId: data.user?.id,
            provider: intentData.provider,
            completedAt: Date.now(),
          };

          cookieStore.set("reauth_ok", JSON.stringify(reauthOkData), {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: REAUTH_OK_MAX_AGE,
            path: "/",
          });

          // Clear intent cookie
          cookieStore.delete("reauth_intent");

          console.log(`[AuthCallback] Reauth successful for user ${data.user?.id}, intent: ${intentData.intent}`);

          // Redirect to settings with success param
          return NextResponse.redirect(
            new URL(`/settings?reauth_success=${intentData.intent}`, baseUrl)
          );
        } catch (parseError) {
          console.error("[AuthCallback] Failed to parse reauth intent:", parseError);
          cookieStore.delete("reauth_intent");
          return NextResponse.redirect(new URL("/settings?error=reauth_invalid", baseUrl));
        }
      }

      // Check for `next` query param (used by magiclink flows from complete-signup/resend)
      // SECURITY: Allowlist-only to prevent open redirect attacks
      const ALLOWED_NEXT = new Set([
        "/onboarding",
        "/set-password",
        "/settings?refresh=1",
        "/sanctuary",
        "/welcome",
      ]);

      const nextPath = requestUrl.searchParams.get("next");
      if (nextPath) {
        // Defense-in-depth: reject obviously malicious patterns
        const isMalicious = nextPath.includes("://") || nextPath.startsWith("//") || nextPath.includes("\\");

        if (!isMalicious && ALLOWED_NEXT.has(nextPath)) {
          console.log(`[AuthCallback] Magiclink flow - redirecting to: ${nextPath}`);
          return NextResponse.redirect(new URL(nextPath, baseUrl));
        }
        console.warn(`[AuthCallback] Rejected next param (not in allowlist): ${nextPath}`);
      }

      // For OAuth flows, redirect to post-callback page which reads destination from sessionStorage
      // This works around Supabase stripping query params from redirectTo
      console.log(`[AuthCallback] SUCCESS - Redirecting to /auth/post-callback on ${baseUrl}`);

      const response = NextResponse.redirect(new URL("/auth/post-callback", baseUrl));

      // Only clear checkout session cookie if claim succeeded
      // If claim failed, preserve cookie so onboarding can poll and retry
      if (checkoutClaimed) {
        response.cookies.set("solara_checkout_session", "", {
          path: "/",
          maxAge: 0,
          expires: new Date(0),
        });
      }

      return response;
    } catch (err) {
      console.error("[AuthCallback] Unexpected error:", err);
      return NextResponse.redirect(
        new URL("/sign-in?error=unexpected", baseUrl)
      );
    }
  }

  // No code provided - redirect to sign-in
  console.warn("[AuthCallback] No code parameter provided");
  return NextResponse.redirect(new URL("/sign-in", baseUrl));
}
