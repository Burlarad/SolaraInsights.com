import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateAuthUrl, generateOAuthState } from "@/lib/social/oauth";
import { generatePKCEPair, storeCodeVerifier } from "@/lib/oauth/pkce";
import { isProviderEnabled, isOAuthConfigured } from "@/lib/oauth/providers";

/**
 * GET /api/auth/login/x
 *
 * Initiates X (Twitter) OAuth for LOGIN mode (creates Supabase session).
 *
 * Query params:
 * - return_to: Where to redirect after login (default: /join for new, /sanctuary for existing)
 */
export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  try {
    const provider = "x";
    const returnTo = req.nextUrl.searchParams.get("return_to") || "/join";

    // Check if X is enabled and configured
    if (!isProviderEnabled(provider)) {
      return NextResponse.redirect(
        new URL(`/sign-in?error=provider_disabled&provider=${provider}`, baseUrl)
      );
    }

    if (!isOAuthConfigured(provider)) {
      return NextResponse.redirect(
        new URL(`/sign-in?error=not_configured&provider=${provider}`, baseUrl)
      );
    }

    // Generate PKCE pair
    const pkce = generatePKCEPair();

    // Generate state for CSRF protection
    const state = generateOAuthState();

    // Read checkout session cookie to preserve across OAuth redirect
    const cookieStore = await cookies();
    const checkoutCookie = cookieStore.get("solara_checkout_session");

    // Store state in cookie (includes flow=login to distinguish from connect flow)
    const stateData = JSON.stringify({
      state,
      provider,
      flow: "login",
      timestamp: Date.now(),
      returnTo,
      checkoutSessionId: checkoutCookie?.value || null,
    });

    cookieStore.set("x_login_state", stateData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10, // 10 minutes
      path: "/",
    });

    // Store PKCE verifier
    await storeCodeVerifier(provider, state, pkce.verifier);

    // Generate authorization URL
    const redirectUri = `${baseUrl}/api/auth/login/x/callback`;
    const authUrl = generateAuthUrl(provider, redirectUri, state, pkce.challenge);

    // Debug: Log authorize URL structure (safe - no secrets)
    try {
      const parsedUrl = new URL(authUrl);
      const paramKeys = Array.from(parsedUrl.searchParams.keys());
      console.log(`[X Login] Authorize URL debug:`, {
        hostname: parsedUrl.hostname,
        pathname: parsedUrl.pathname,
        paramKeys,
        redirectUri: parsedUrl.searchParams.get("redirect_uri"),
        scope: parsedUrl.searchParams.get("scope"),
        hasCodeChallenge: !!parsedUrl.searchParams.get("code_challenge"),
      });
    } catch (e) {
      console.error(`[X Login] Failed to parse authUrl:`, authUrl);
    }

    console.log(`[X Login] Initiating OAuth flow, returnTo: ${returnTo}`);
    console.log(`[X Login] State cookie set: x_login_state`);

    // Redirect to X
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error("[X Login] Error:", error.message);
    return NextResponse.redirect(
      new URL("/sign-in?error=oauth_error", baseUrl)
    );
  }
}
