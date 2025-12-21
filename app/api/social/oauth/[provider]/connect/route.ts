import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SocialProvider } from "@/types";
import {
  generateAuthUrl,
  getCallbackUrl,
  generateOAuthState,
  isOAuthConfigured,
} from "@/lib/social/oauth";
import { isProviderEnabled } from "@/lib/oauth/providers";
import { generatePKCEPair, storeCodeVerifier } from "@/lib/oauth/pkce";

const VALID_PROVIDERS: SocialProvider[] = [
  "facebook",
  "instagram",
  "tiktok",
  "x",
  "reddit",
];

// Debug logging - enable via OAUTH_DEBUG_LOGS=true when wiring new providers
const debug = process.env.OAUTH_DEBUG_LOGS === "true";

/**
 * GET /api/social/oauth/[provider]/connect
 *
 * Initiates the OAuth flow for a social provider.
 * Implements PKCE (S256) for all providers.
 * Redirects the user to the provider's authorization page.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider: providerParam } = await params;
    const provider = providerParam as SocialProvider;

    // Get return_to from query params (for redirecting back after OAuth)
    const returnTo = req.nextUrl.searchParams.get("return_to");

    // Validate provider
    if (!VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { error: "Invalid provider", message: `Provider "${provider}" is not supported.` },
        { status: 400 }
      );
    }

    // Check if provider is enabled (X is feature-flagged)
    if (!isProviderEnabled(provider)) {
      return NextResponse.json(
        {
          error: "Provider disabled",
          message: `${provider} OAuth is not currently enabled.`,
        },
        { status: 404 }
      );
    }

    // Check if OAuth is configured for this provider
    if (!isOAuthConfigured(provider)) {
      return NextResponse.json(
        {
          error: "Not configured",
          message: `OAuth is not configured for ${provider}. Please contact support.`,
        },
        { status: 503 }
      );
    }

    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // Redirect to login with return URL
      // Use NEXT_PUBLIC_SITE_URL to avoid internal port exposure in containerized environments
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const returnUrl = `/api/social/oauth/${provider}/connect`;
      return NextResponse.redirect(
        new URL(`/sign-in?returnUrl=${encodeURIComponent(returnUrl)}`, baseUrl)
      );
    }

    // Generate PKCE pair (verifier + S256 challenge)
    const pkce = generatePKCEPair();

    // Generate state for CSRF protection
    const state = generateOAuthState();

    // Store state in cookie (signed, httpOnly)
    const cookieStore = await cookies();
    const stateData = JSON.stringify({
      state,
      provider,
      userId: user.id,
      timestamp: Date.now(),
      returnTo: returnTo || null, // Store return_to for callback redirect
    });

    cookieStore.set("social_oauth_state", stateData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10, // 10 minutes
      path: "/",
    });

    // Store PKCE verifier in separate cookie (scoped to provider + state)
    await storeCodeVerifier(provider, state, pkce.verifier);

    // Generate authorization URL with PKCE challenge
    const redirectUri = getCallbackUrl(provider);
    const authUrl = generateAuthUrl(provider, redirectUri, state, pkce.challenge);

    if (debug) {
      console.log(`[OAuth Debug] [${provider}] redirectUri: ${redirectUri}`);
      console.log(`[OAuth Debug] [${provider}] authUrl: ${authUrl.toString()}`);
    }

    // Redirect to provider's authorization page
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error("[OAuth Connect] Error:", error.message);
    return NextResponse.json(
      { error: "Server error", message: "Failed to initiate OAuth flow." },
      { status: 500 }
    );
  }
}
