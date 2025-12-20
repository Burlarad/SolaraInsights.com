import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { SocialProvider } from "@/types";
import {
  exchangeCodeForTokens,
  getCallbackUrl,
} from "@/lib/social/oauth";
import { isProviderEnabled } from "@/lib/oauth/providers";
import { retrieveCodeVerifier } from "@/lib/oauth/pkce";
import { encryptToken } from "@/lib/social/crypto";

const VALID_PROVIDERS: SocialProvider[] = [
  "facebook",
  "instagram",
  "tiktok",
  "x",
  "reddit",
];

// =============================================================================
// TODO: REMOVE DEBUG LOGGING AFTER OAUTH STABILIZES
// =============================================================================

/**
 * GET /api/social/oauth/[provider]/callback
 *
 * Handles the OAuth callback from the provider.
 * Exchanges the authorization code for tokens using PKCE verifier.
 * Stores encrypted tokens and triggers quiet sync.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // Generate short request ID for log correlation
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const { provider: providerParam } = await params;
    const provider = providerParam as SocialProvider;

    // Get query parameters early for logging
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    // Get cookies early for entry logging
    const cookieStore = await cookies();
    const stateCookie = cookieStore.get("social_oauth_state");

    // A) Callback entry log
    console.log(`[OAuth Debug] [${requestId}] === CALLBACK ENTRY ===`);
    console.log(`[OAuth Debug] [${requestId}] provider: ${provider}`);
    console.log(`[OAuth Debug] [${requestId}] code present: ${!!code}`);
    console.log(`[OAuth Debug] [${requestId}] state present: ${!!state}`);
    console.log(`[OAuth Debug] [${requestId}] error param: ${error || "(none)"}`);
    console.log(`[OAuth Debug] [${requestId}] state cookie present: ${!!stateCookie}`);
    console.log(`[OAuth Debug] [${requestId}] NEXT_PUBLIC_SITE_URL: ${process.env.NEXT_PUBLIC_SITE_URL || "(not set, using localhost)"}`);
    console.log(`[OAuth Debug] [${requestId}] SOCIAL_TOKEN_ENCRYPTION_KEY set: ${!!process.env.SOCIAL_TOKEN_ENCRYPTION_KEY}`);
    console.log(`[OAuth Debug] [${requestId}] SUPABASE_SERVICE_ROLE_KEY set: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);

    // Validate provider
    if (!VALID_PROVIDERS.includes(provider)) {
      console.log(`[OAuth Debug] [${requestId}] EXIT: invalid_provider`);
      return NextResponse.redirect(
        new URL(`/connect-social?error=invalid_provider`, baseUrl)
      );
    }

    // Check if provider is enabled
    if (!isProviderEnabled(provider)) {
      console.log(`[OAuth Debug] [${requestId}] EXIT: provider_disabled`);
      return NextResponse.redirect(
        new URL(`/connect-social?error=provider_disabled&provider=${provider}`, baseUrl)
      );
    }

    // Check for OAuth errors from provider
    if (error) {
      console.log(`[OAuth Debug] [${requestId}] EXIT: provider_error - ${error}`);
      console.error(`[OAuth Callback] Provider error for ${provider}:`, error, errorDescription);

      // Quiet error - map to "needs_reauth" behavior
      if (error === "access_denied") {
        return NextResponse.redirect(
          new URL(`/connect-social?error=access_denied&provider=${provider}`, baseUrl)
        );
      }

      return NextResponse.redirect(
        new URL(`/connect-social?error=needs_reauth&provider=${provider}`, baseUrl)
      );
    }

    // Validate code and state presence
    if (!code || !state) {
      console.log(`[OAuth Debug] [${requestId}] EXIT: missing_params (code: ${!!code}, state: ${!!state})`);
      return NextResponse.redirect(
        new URL(`/connect-social?error=missing_params&provider=${provider}`, baseUrl)
      );
    }

    // Verify state from cookie
    if (!stateCookie) {
      console.log(`[OAuth Debug] [${requestId}] EXIT: state_expired (no cookie)`);
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
      console.log(`[OAuth Debug] [${requestId}] EXIT: invalid_state (parse error)`);
      return NextResponse.redirect(
        new URL(`/connect-social?error=invalid_state&provider=${provider}`, baseUrl)
      );
    }

    // Validate state matches
    if (storedState.state !== state || storedState.provider !== provider) {
      console.log(`[OAuth Debug] [${requestId}] EXIT: state_mismatch`);
      return NextResponse.redirect(
        new URL(`/connect-social?error=state_mismatch&provider=${provider}`, baseUrl)
      );
    }

    // Check state hasn't expired (10 minutes)
    const stateAgeMs = Date.now() - storedState.timestamp;
    if (stateAgeMs > 10 * 60 * 1000) {
      console.log(`[OAuth Debug] [${requestId}] EXIT: state_expired (age: ${Math.round(stateAgeMs / 1000)}s)`);
      return NextResponse.redirect(
        new URL(`/connect-social?error=state_expired&provider=${provider}`, baseUrl)
      );
    }

    // B) State validation success log
    console.log(`[OAuth Debug] [${requestId}] state validated: true`);
    console.log(`[OAuth Debug] [${requestId}] storedState.userId present: ${!!storedState.userId}`);
    console.log(`[OAuth Debug] [${requestId}] state age: ${Math.round(stateAgeMs / 1000)}s`);

    // Clear the state cookie
    cookieStore.delete("social_oauth_state");

    // Retrieve PKCE verifier from cookie
    const codeVerifier = await retrieveCodeVerifier(provider, state);

    // C) PKCE retrieval log
    console.log(`[OAuth Debug] [${requestId}] pkceVerifier found: ${!!codeVerifier}`);

    if (!codeVerifier) {
      console.log(`[OAuth Debug] [${requestId}] EXIT: needs_reauth (pkce missing)`);
      console.error(`[OAuth Callback] PKCE verifier missing for ${provider}`);
      return NextResponse.redirect(
        new URL(`/connect-social?error=needs_reauth&provider=${provider}`, baseUrl)
      );
    }

    // Exchange code for tokens with PKCE verifier
    const redirectUri = getCallbackUrl(provider);
    console.log(`[OAuth Debug] [${requestId}] attempting token exchange...`);
    console.log(`[OAuth Debug] [${requestId}] redirectUri for exchange: ${redirectUri}`);

    let tokens;
    try {
      tokens = await exchangeCodeForTokens(provider, code, redirectUri, codeVerifier);

      // D) Token exchange success log
      console.log(`[OAuth Debug] [${requestId}] token exchange: SUCCESS`);
      console.log(`[OAuth Debug] [${requestId}] tokens.userId present: ${!!tokens.userId}`);
      console.log(`[OAuth Debug] [${requestId}] tokens.expiresIn present: ${!!tokens.expiresIn}`);
      console.log(`[OAuth Debug] [${requestId}] tokens.refreshToken present: ${!!tokens.refreshToken}`);
    } catch (tokenError: any) {
      console.log(`[OAuth Debug] [${requestId}] EXIT: token_exchange_failed`);
      console.log(`[OAuth Debug] [${requestId}] token exchange error: ${tokenError.message}`);
      throw tokenError; // Re-throw to hit the catch block
    }

    // Encrypt tokens before storing
    console.log(`[OAuth Debug] [${requestId}] encrypting tokens...`);
    const accessTokenEncrypted = encryptToken(tokens.accessToken);
    const refreshTokenEncrypted = tokens.refreshToken
      ? encryptToken(tokens.refreshToken)
      : null;
    console.log(`[OAuth Debug] [${requestId}] encryption: SUCCESS`);

    // Calculate token expiry time
    const tokenExpiresAt = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
      : null;

    // Store tokens in social_accounts vault using service role
    console.log(`[OAuth Debug] [${requestId}] creating service client...`);
    const supabase = createServiceSupabaseClient();
    console.log(`[OAuth Debug] [${requestId}] service client: SUCCESS`);

    console.log(`[OAuth Debug] [${requestId}] upserting to social_accounts...`);
    const { error: upsertError } = await supabase
      .from("social_accounts")
      .upsert(
        {
          user_id: storedState.userId,
          provider,
          external_user_id: tokens.userId,
          access_token: accessTokenEncrypted,
          refresh_token: refreshTokenEncrypted,
          expires_at: tokenExpiresAt,
        },
        {
          onConflict: "user_id,provider",
        }
      );

    // E) DB upsert log
    if (upsertError) {
      console.log(`[OAuth Debug] [${requestId}] EXIT: database_error`);
      console.log(`[OAuth Debug] [${requestId}] upsert error: ${upsertError.message}`);
      console.error("[OAuth Callback] Database error:", upsertError);
      return NextResponse.redirect(
        new URL(`/connect-social?error=database_error&provider=${provider}`, baseUrl)
      );
    }

    console.log(`[OAuth Debug] [${requestId}] db upsert: SUCCESS`);

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

    // Success!
    console.log(`[OAuth Debug] [${requestId}] === CALLBACK SUCCESS ===`);

    // Redirect to success page
    return NextResponse.redirect(
      new URL(`/connect-social?success=true&provider=${provider}`, baseUrl)
    );
  } catch (error: any) {
    // F) Catch-all error log
    console.log(`[OAuth Debug] [${requestId}] EXIT: exception`);
    console.log(`[OAuth Debug] [${requestId}] exception message: ${error.message}`);
    console.error("[OAuth Callback] Error:", error.message);

    // Quiet error - don't leak details
    return NextResponse.redirect(
      new URL(`/connect-social?error=needs_reauth`, baseUrl)
    );
  }
}
