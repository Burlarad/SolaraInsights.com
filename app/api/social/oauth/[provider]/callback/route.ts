import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { SocialProvider } from "@/types";
import {
  exchangeCodeForTokens,
  getCallbackUrl,
  OAUTH_PROVIDERS,
} from "@/lib/social/oauth";
import { encryptToken } from "@/lib/social/crypto";

const VALID_PROVIDERS: SocialProvider[] = [
  "facebook",
  "instagram",
  "tiktok",
  "x",
  "reddit",
];

/**
 * GET /api/social/oauth/[provider]/callback
 *
 * Handles the OAuth callback from the provider.
 * Exchanges the authorization code for tokens and stores them.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  try {
    const { provider: providerParam } = await params;
    const provider = providerParam as SocialProvider;

    // Validate provider
    if (!VALID_PROVIDERS.includes(provider)) {
      return NextResponse.redirect(
        new URL(`/connect-social?error=invalid_provider`, baseUrl)
      );
    }

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Check for OAuth errors from provider
    if (error) {
      console.error(`[OAuth Callback] Provider error for ${provider}:`, error, errorDescription);
      return NextResponse.redirect(
        new URL(
          `/connect-social?error=${encodeURIComponent(error)}&provider=${provider}`,
          baseUrl
        )
      );
    }

    // Validate code and state
    if (!code || !state) {
      return NextResponse.redirect(
        new URL(`/connect-social?error=missing_params&provider=${provider}`, baseUrl)
      );
    }

    // Verify state from cookie
    const cookieStore = await cookies();
    const stateCookie = cookieStore.get("social_oauth_state");

    if (!stateCookie) {
      return NextResponse.redirect(
        new URL(`/connect-social?error=state_expired&provider=${provider}`, baseUrl)
      );
    }

    let storedState: {
      state: string;
      provider: SocialProvider;
      userId: string;
      timestamp: number;
    };

    try {
      storedState = JSON.parse(stateCookie.value);
    } catch {
      return NextResponse.redirect(
        new URL(`/connect-social?error=invalid_state&provider=${provider}`, baseUrl)
      );
    }

    // Validate state matches
    if (storedState.state !== state || storedState.provider !== provider) {
      return NextResponse.redirect(
        new URL(`/connect-social?error=state_mismatch&provider=${provider}`, baseUrl)
      );
    }

    // Check state hasn't expired (10 minutes)
    if (Date.now() - storedState.timestamp > 10 * 60 * 1000) {
      return NextResponse.redirect(
        new URL(`/connect-social?error=state_expired&provider=${provider}`, baseUrl)
      );
    }

    // Clear the state cookie
    cookieStore.delete("social_oauth_state");

    // Exchange code for tokens
    const redirectUri = getCallbackUrl(provider);
    const tokens = await exchangeCodeForTokens(provider, code, redirectUri);

    // Encrypt tokens before storing
    const accessTokenEncrypted = encryptToken(tokens.accessToken);
    const refreshTokenEncrypted = tokens.refreshToken
      ? encryptToken(tokens.refreshToken)
      : null;

    // Calculate token expiry time
    const tokenExpiresAt = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
      : null;

    // Store connection in database using service role
    const supabase = createServiceSupabaseClient();

    const { error: upsertError } = await supabase
      .from("social_connections")
      .upsert(
        {
          user_id: storedState.userId,
          provider,
          provider_user_id: tokens.userId,
          status: "connected",
          access_token_encrypted: accessTokenEncrypted,
          refresh_token_encrypted: refreshTokenEncrypted,
          token_expires_at: tokenExpiresAt,
          scopes: OAUTH_PROVIDERS[provider].scopes.join(" "),
          last_error: null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,provider",
        }
      );

    if (upsertError) {
      console.error("[OAuth Callback] Database error:", upsertError);
      return NextResponse.redirect(
        new URL(`/connect-social?error=database_error&provider=${provider}`, baseUrl)
      );
    }

    // Trigger initial sync (fire and forget)
    const syncUrl = `${baseUrl}/api/social/sync`;
    fetch(syncUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.CRON_SECRET}`,
      },
      body: JSON.stringify({
        userId: storedState.userId,
        provider,
      }),
    }).catch((err) => {
      console.error("[OAuth Callback] Failed to trigger sync:", err);
    });

    // Redirect to success page
    return NextResponse.redirect(
      new URL(`/connect-social?success=true&provider=${provider}`, baseUrl)
    );
  } catch (error: any) {
    console.error("[OAuth Callback] Error:", error.message);
    return NextResponse.redirect(
      new URL(`/connect-social?error=server_error`, baseUrl)
    );
  }
}
