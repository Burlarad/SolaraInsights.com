import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SocialProvider } from "@/types";
import {
  generateAuthUrl,
  getCallbackUrl,
  generateOAuthState,
  isOAuthConfigured,
  OAUTH_PROVIDERS,
} from "@/lib/social/oauth";

const VALID_PROVIDERS: SocialProvider[] = [
  "facebook",
  "instagram",
  "tiktok",
  "x",
  "reddit",
];

/**
 * GET /api/social/oauth/[provider]/connect
 *
 * Initiates the OAuth flow for a social provider.
 * Redirects the user to the provider's authorization page.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider: providerParam } = await params;
    const provider = providerParam as SocialProvider;

    // Validate provider
    if (!VALID_PROVIDERS.includes(provider)) {
      return NextResponse.json(
        { error: "Invalid provider", message: `Provider "${provider}" is not supported.` },
        { status: 400 }
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
      const returnUrl = `/api/social/oauth/${provider}/connect`;
      return NextResponse.redirect(
        new URL(`/login?returnUrl=${encodeURIComponent(returnUrl)}`, req.url)
      );
    }

    // Generate state for CSRF protection
    const state = generateOAuthState();

    // Store state in cookie (signed, httpOnly)
    const cookieStore = await cookies();
    const stateData = JSON.stringify({
      state,
      provider,
      userId: user.id,
      timestamp: Date.now(),
    });

    cookieStore.set("social_oauth_state", stateData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10, // 10 minutes
      path: "/",
    });

    // Generate authorization URL
    const redirectUri = getCallbackUrl(provider);
    const authUrl = generateAuthUrl(provider, redirectUri, state);

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
