import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateAuthUrl, getCallbackUrl, generateOAuthState } from "@/lib/social/oauth";
import { generatePKCEPair, storeCodeVerifier } from "@/lib/oauth/pkce";
import { isProviderEnabled, isOAuthConfigured } from "@/lib/oauth/providers";

/**
 * GET /api/auth/login/tiktok
 *
 * Initiates TikTok OAuth for LOGIN mode (creates Supabase session).
 * This is different from the /api/social/oauth/tiktok/connect flow which
 * requires an existing session.
 *
 * Query params:
 * - return_to: Where to redirect after login (default: /join for new, /sanctuary for existing)
 */
export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  try {
    const provider = "tiktok";
    const returnTo = req.nextUrl.searchParams.get("return_to") || "/join";

    // Check if TikTok is enabled and configured
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
    // This is critical because client-set cookies may not survive cross-site redirects
    const cookieStore = await cookies();
    const checkoutCookie = cookieStore.get("solara_checkout_session");

    // Store state in cookie (includes flow=login to distinguish from connect flow)
    const stateData = JSON.stringify({
      state,
      provider,
      flow: "login", // KEY: Distinguishes from "connect" flow
      timestamp: Date.now(),
      returnTo,
      checkoutSessionId: checkoutCookie?.value || null, // Preserve checkout session across OAuth
    });

    cookieStore.set("tiktok_login_state", stateData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10, // 10 minutes
      path: "/",
    });

    // Store PKCE verifier
    await storeCodeVerifier(provider, state, pkce.verifier);

    // Generate authorization URL
    // IMPORTANT: Use login-specific callback URL, not the social connect callback
    const redirectUri = `${baseUrl}/api/auth/login/tiktok/callback`;
    const authUrl = generateAuthUrl(provider, redirectUri, state, pkce.challenge);

    // Debug: Log authorize URL structure (safe - no secrets)
    try {
      const parsedUrl = new URL(authUrl);
      const paramKeys = Array.from(parsedUrl.searchParams.keys());
      const clientKeyLength = parsedUrl.searchParams.get("client_key")?.length || 0;
      console.log(`[TikTok Login] Authorize URL debug:`, {
        hostname: parsedUrl.hostname,
        pathname: parsedUrl.pathname,
        paramKeys,
        clientKeyPresent: clientKeyLength > 0,
        clientKeyLength,
        redirectUri: parsedUrl.searchParams.get("redirect_uri"),
        scope: parsedUrl.searchParams.get("scope"),
        hasCodeChallenge: !!parsedUrl.searchParams.get("code_challenge"),
      });
    } catch (e) {
      console.error(`[TikTok Login] Failed to parse authUrl:`, authUrl);
    }

    console.log(`[TikTok Login] Initiating OAuth flow, returnTo: ${returnTo}`);

    // Redirect to TikTok
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error("[TikTok Login] Error:", error.message);
    return NextResponse.redirect(
      new URL("/sign-in?error=oauth_error", baseUrl)
    );
  }
}
