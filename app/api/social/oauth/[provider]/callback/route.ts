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

// Debug logging - enable via OAUTH_DEBUG_LOGS=true when wiring new providers
const debug = process.env.OAUTH_DEBUG_LOGS === "true";

/**
 * Validate return_to URL for open redirect protection.
 * Only allows internal paths that are safe to redirect to.
 */
function isValidReturnTo(returnTo: string | null | undefined): returnTo is string {
  if (!returnTo) return false;
  // Must start with "/" (relative path)
  if (!returnTo.startsWith("/")) return false;
  // Must not be protocol-relative URL (//)
  if (returnTo.startsWith("//")) return false;
  // Must not contain protocol indicators
  if (returnTo.toLowerCase().includes("http:") || returnTo.toLowerCase().includes("https:")) return false;
  // Must not contain :// anywhere (catches all protocols)
  if (returnTo.includes("://")) return false;
  // Must not contain backslash (prevents /\evil.com tricks)
  if (returnTo.includes("\\")) return false;
  // Must not contain encoded slashes that could bypass checks
  if (returnTo.includes("%2f") || returnTo.includes("%2F")) return false;
  return true;
}

/**
 * Build a redirect URL, preferring returnTo if valid, otherwise falling back to /settings.
 * Appends query params properly (using ? or & as needed).
 */
function buildRedirectUrl(
  returnTo: string | null | undefined,
  params: Record<string, string>,
  baseUrl: string
): URL {
  // Determine base path - default to /settings if no valid returnTo
  const basePath = isValidReturnTo(returnTo) ? returnTo : "/settings";

  // Build query string
  const queryString = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  // Append query params properly
  const separator = basePath.includes("?") ? "&" : "?";
  const fullPath = `${basePath}${separator}${queryString}`;

  return new URL(fullPath, baseUrl);
}

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

  // Best-effort returnTo for catch block (extracted from cookie if possible)
  let earlyReturnTo: string | null = null;

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

    // Try to extract returnTo early for error redirect paths
    // This is a best-effort parse - if it fails, we'll use null (fallback to /settings)
    if (stateCookie) {
      try {
        const parsed = JSON.parse(stateCookie.value);
        earlyReturnTo = parsed.returnTo || null;
      } catch {
        // Ignore parse errors - earlyReturnTo stays null
      }
    }

    // A) Callback entry log (verbose - gated)
    if (debug) {
      console.log(`[OAuth Debug] [${requestId}] === CALLBACK ENTRY ===`);
      console.log(`[OAuth Debug] [${requestId}] provider: ${provider}`);
      console.log(`[OAuth Debug] [${requestId}] code present: ${!!code}`);
      console.log(`[OAuth Debug] [${requestId}] state present: ${!!state}`);
      console.log(`[OAuth Debug] [${requestId}] error param: ${error || "(none)"}`);
      console.log(`[OAuth Debug] [${requestId}] state cookie present: ${!!stateCookie}`);
      console.log(`[OAuth Debug] [${requestId}] NEXT_PUBLIC_SITE_URL: ${process.env.NEXT_PUBLIC_SITE_URL || "(not set, using localhost)"}`);
      console.log(`[OAuth Debug] [${requestId}] SOCIAL_TOKEN_ENCRYPTION_KEY set: ${!!process.env.SOCIAL_TOKEN_ENCRYPTION_KEY}`);
      console.log(`[OAuth Debug] [${requestId}] SUPABASE_SERVICE_ROLE_KEY set: ${!!process.env.SUPABASE_SERVICE_ROLE_KEY}`);
    }

    // Validate provider
    if (!VALID_PROVIDERS.includes(provider)) {
      if (debug) console.log(`[OAuth Debug] [${requestId}] EXIT: invalid_provider`);
      return NextResponse.redirect(
        buildRedirectUrl(earlyReturnTo, { error: "invalid_provider" }, baseUrl)
      );
    }

    // Check if provider is enabled
    if (!isProviderEnabled(provider)) {
      if (debug) console.log(`[OAuth Debug] [${requestId}] EXIT: provider_disabled`);
      return NextResponse.redirect(
        buildRedirectUrl(earlyReturnTo, { error: "provider_disabled", provider }, baseUrl)
      );
    }

    // Check for OAuth errors from provider
    if (error) {
      // Always log provider errors (minimal safe info)
      console.error(`[OAuth Callback] [${requestId}] ${provider}: provider_error - ${error}`);
      if (debug) console.log(`[OAuth Debug] [${requestId}] error_description: ${errorDescription}`);

      // Quiet error - map to "needs_reauth" behavior
      if (error === "access_denied") {
        return NextResponse.redirect(
          buildRedirectUrl(earlyReturnTo, { error: "access_denied", provider }, baseUrl)
        );
      }

      return NextResponse.redirect(
        buildRedirectUrl(earlyReturnTo, { error: "needs_reauth", provider }, baseUrl)
      );
    }

    // Validate code and state presence
    if (!code || !state) {
      console.error(`[OAuth Callback] [${requestId}] ${provider}: missing_params`);
      if (debug) console.log(`[OAuth Debug] [${requestId}] code: ${!!code}, state: ${!!state}`);
      return NextResponse.redirect(
        buildRedirectUrl(earlyReturnTo, { error: "missing_params", provider }, baseUrl)
      );
    }

    // Verify state from cookie
    if (!stateCookie) {
      // No cookie = no returnTo available, will fallback to /settings
      console.error(`[OAuth Callback] [${requestId}] ${provider}: state_expired (no cookie)`);
      return NextResponse.redirect(
        buildRedirectUrl(null, { error: "state_expired", provider }, baseUrl)
      );
    }

    let storedState: {
      state: string;
      provider: SocialProvider;
      userId: string;
      timestamp: number;
      returnTo?: string | null;
    };

    try {
      storedState = JSON.parse(stateCookie.value);
    } catch {
      // Parse failed - earlyReturnTo attempt already failed, fallback to /settings
      console.error(`[OAuth Callback] [${requestId}] ${provider}: invalid_state (parse error)`);
      return NextResponse.redirect(
        buildRedirectUrl(null, { error: "invalid_state", provider }, baseUrl)
      );
    }

    // Validate state matches
    if (storedState.state !== state || storedState.provider !== provider) {
      console.error(`[OAuth Callback] [${requestId}] ${provider}: state_mismatch`);
      return NextResponse.redirect(
        buildRedirectUrl(storedState.returnTo, { error: "state_mismatch", provider }, baseUrl)
      );
    }

    // Check state hasn't expired (10 minutes)
    const stateAgeMs = Date.now() - storedState.timestamp;
    if (stateAgeMs > 10 * 60 * 1000) {
      console.error(`[OAuth Callback] [${requestId}] ${provider}: state_expired (age: ${Math.round(stateAgeMs / 1000)}s)`);
      return NextResponse.redirect(
        buildRedirectUrl(storedState.returnTo, { error: "state_expired", provider }, baseUrl)
      );
    }

    // B) State validation success log (verbose - gated)
    if (debug) {
      console.log(`[OAuth Debug] [${requestId}] state validated: true`);
      console.log(`[OAuth Debug] [${requestId}] storedState.userId present: ${!!storedState.userId}`);
      console.log(`[OAuth Debug] [${requestId}] state age: ${Math.round(stateAgeMs / 1000)}s`);
    }

    // Clear the state cookie
    cookieStore.delete("social_oauth_state");

    // Retrieve PKCE verifier from cookie
    const codeVerifier = await retrieveCodeVerifier(provider, state);

    // C) PKCE retrieval log (verbose - gated)
    if (debug) console.log(`[OAuth Debug] [${requestId}] pkceVerifier found: ${!!codeVerifier}`);

    if (!codeVerifier) {
      console.error(`[OAuth Callback] [${requestId}] ${provider}: needs_reauth (pkce missing)`);
      return NextResponse.redirect(
        buildRedirectUrl(storedState.returnTo, { error: "needs_reauth", provider }, baseUrl)
      );
    }

    // Exchange code for tokens with PKCE verifier
    const redirectUri = getCallbackUrl(provider);
    if (debug) {
      console.log(`[OAuth Debug] [${requestId}] attempting token exchange...`);
      console.log(`[OAuth Debug] [${requestId}] redirectUri for exchange: ${redirectUri}`);
    }

    let tokens;
    try {
      tokens = await exchangeCodeForTokens(provider, code, redirectUri, codeVerifier);

      // D) Token exchange success log (verbose - gated)
      if (debug) {
        console.log(`[OAuth Debug] [${requestId}] token exchange: SUCCESS`);
        console.log(`[OAuth Debug] [${requestId}] tokens.userId present: ${!!tokens.userId}`);
        console.log(`[OAuth Debug] [${requestId}] tokens.expiresIn present: ${!!tokens.expiresIn}`);
        console.log(`[OAuth Debug] [${requestId}] tokens.refreshToken present: ${!!tokens.refreshToken}`);
      }
    } catch (tokenError: any) {
      // Always log token exchange failures (minimal safe info)
      console.error(`[OAuth Callback] [${requestId}] ${provider}: token_exchange_failed - ${tokenError.message}`);
      throw tokenError; // Re-throw to hit the catch block
    }

    // Encrypt tokens before storing
    if (debug) console.log(`[OAuth Debug] [${requestId}] encrypting tokens...`);
    const accessTokenEncrypted = encryptToken(tokens.accessToken);
    const refreshTokenEncrypted = tokens.refreshToken
      ? encryptToken(tokens.refreshToken)
      : null;
    if (debug) console.log(`[OAuth Debug] [${requestId}] encryption: SUCCESS`);

    // Calculate token expiry time
    const tokenExpiresAt = tokens.expiresIn
      ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
      : null;

    // Store tokens in social_accounts vault using service role
    if (debug) console.log(`[OAuth Debug] [${requestId}] creating service client...`);
    const supabase = createServiceSupabaseClient();
    if (debug) console.log(`[OAuth Debug] [${requestId}] service client: SUCCESS`);

    if (debug) console.log(`[OAuth Debug] [${requestId}] upserting to social_accounts...`);
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
      // Always log database errors (minimal safe info)
      console.error(`[OAuth Callback] [${requestId}] ${provider}: database_error - ${upsertError.message}`);
      return NextResponse.redirect(
        buildRedirectUrl(storedState.returnTo, { error: "database_error", provider }, baseUrl)
      );
    }

    if (debug) console.log(`[OAuth Debug] [${requestId}] db upsert: SUCCESS`);

    // Activate social insights on first connection (deferred persistence model)
    // Only set enabled=true and activated_at if not already set
    const { data: profile } = await supabase
      .from("profiles")
      .select("social_insights_enabled, social_insights_activated_at")
      .eq("id", storedState.userId)
      .single();

    if (profile && !profile.social_insights_activated_at) {
      await supabase
        .from("profiles")
        .update({
          social_insights_enabled: true,
          social_insights_activated_at: new Date().toISOString(),
        })
        .eq("id", storedState.userId);
      if (debug) console.log(`[OAuth Debug] [${requestId}] social insights activated: first connection`);
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
      console.error("[OAuth Callback] Failed to trigger sync:", err.message);
    });

    // Success!
    if (debug) console.log(`[OAuth Debug] [${requestId}] === CALLBACK SUCCESS ===`);

    // Redirect to return_to page if valid, otherwise /settings
    return NextResponse.redirect(
      buildRedirectUrl(storedState.returnTo, { social: "connected", provider }, baseUrl)
    );
  } catch (error: any) {
    // F) Catch-all error log - always log (minimal safe info)
    console.error(`[OAuth Callback] [${requestId}] exception: ${error.message}`);

    // Quiet error - don't leak details
    // Use earlyReturnTo if available (best effort), otherwise fallback
    return NextResponse.redirect(
      buildRedirectUrl(earlyReturnTo, { error: "needs_reauth" }, baseUrl)
    );
  }
}
