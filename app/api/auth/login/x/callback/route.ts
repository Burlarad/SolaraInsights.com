import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/social/oauth";
import { retrieveCodeVerifier } from "@/lib/oauth/pkce";
import { encryptToken } from "@/lib/social/crypto";
import { generateXPlaceholderEmail } from "@/lib/auth/placeholder";
import { claimCheckoutSession } from "@/lib/stripe/claimCheckoutSession";

// Debug mode controlled by environment variable
const debug = process.env.OAUTH_DEBUG_LOGS === "true";

/**
 * GET /api/auth/login/x/callback
 *
 * Handles X (Twitter) OAuth callback for LOGIN flow:
 * 1. Validates state + PKCE
 * 2. Exchanges code for tokens (uses Basic auth)
 * 3. Fetches user ID from /users/me endpoint
 * 4. Looks up or creates Supabase user
 * 5. Mints session (sets auth cookies)
 * 6. Stores tokens in social_accounts (auto-connect)
 * 7. Redirects to destination
 */
export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Get state cookie
    const cookieStore = await cookies();
    const stateCookie = cookieStore.get("x_login_state");

    // Always log callback entry for debugging OAuth issues
    console.log(`[X Login] [${requestId}] === CALLBACK ENTRY ===`);
    console.log(`[X Login] [${requestId}] code present: ${!!code}`);
    console.log(`[X Login] [${requestId}] state present: ${!!state}`);
    console.log(`[X Login] [${requestId}] error: ${error || "(none)"}`);
    console.log(`[X Login] [${requestId}] state cookie present: ${!!stateCookie}`);

    // Log all cookies to diagnose cross-site cookie issues
    const allCookies = cookieStore.getAll();
    console.log(`[X Login] [${requestId}] All cookies received:`, allCookies.map(c => c.name));

    if (debug) {
      console.log(`[X Login] [${requestId}] Full URL: ${req.url}`);
    }

    // Handle OAuth errors
    if (error) {
      console.error(`[X Login] [${requestId}] Provider error: ${error}`);
      return NextResponse.redirect(
        new URL(`/sign-in?error=access_denied&provider=x`, baseUrl)
      );
    }

    // Validate code and state
    if (!code || !state) {
      console.error(`[X Login] [${requestId}] Missing code or state`);
      return NextResponse.redirect(
        new URL("/sign-in?error=missing_params&provider=x", baseUrl)
      );
    }

    // Validate state cookie
    if (!stateCookie) {
      console.error(`[X Login] [${requestId}] State cookie missing`);
      return NextResponse.redirect(
        new URL("/sign-in?error=state_expired&provider=x", baseUrl)
      );
    }

    let storedState: {
      state: string;
      provider: string;
      flow: string;
      timestamp: number;
      returnTo: string;
      checkoutSessionId: string | null;
    };

    try {
      storedState = JSON.parse(stateCookie.value);
    } catch {
      console.error(`[X Login] [${requestId}] Invalid state cookie`);
      return NextResponse.redirect(
        new URL("/sign-in?error=invalid_state&provider=x", baseUrl)
      );
    }

    // Validate state matches
    if (storedState.state !== state || storedState.flow !== "login") {
      console.error(`[X Login] [${requestId}] State mismatch`);
      return NextResponse.redirect(
        new URL("/sign-in?error=state_mismatch&provider=x", baseUrl)
      );
    }

    // Check state hasn't expired (10 minutes)
    const stateAgeMs = Date.now() - storedState.timestamp;
    if (stateAgeMs > 10 * 60 * 1000) {
      console.error(`[X Login] [${requestId}] State expired (age: ${Math.round(stateAgeMs / 1000)}s)`);
      return NextResponse.redirect(
        new URL("/sign-in?error=state_expired&provider=x", baseUrl)
      );
    }

    // Clear state cookie
    cookieStore.delete("x_login_state");

    // Check consent cookie (set by client before OAuth redirect)
    const consentCookie = cookieStore.get("oauth_consent_x");
    const hasConsent = consentCookie?.value === "true";
    if (debug) console.log(`[X Login] [${requestId}] Consent: ${hasConsent}`);

    // Retrieve PKCE verifier
    const codeVerifier = await retrieveCodeVerifier("x", state);
    if (!codeVerifier) {
      console.error(`[X Login] [${requestId}] PKCE verifier missing`);
      return NextResponse.redirect(
        new URL("/sign-in?error=pkce_missing&provider=x", baseUrl)
      );
    }

    console.log(`[X Login] [${requestId}] State validated, exchanging code...`);

    // Exchange code for tokens (includes fetching user ID via adapter.fetchUserId)
    const redirectUri = `${baseUrl}/api/auth/login/x/callback`;

    let tokens;
    try {
      tokens = await exchangeCodeForTokens("x", code, redirectUri, codeVerifier);
      console.log(`[X Login] [${requestId}] Token exchange successful`);
    } catch (tokenError: any) {
      console.error(`[X Login] [${requestId}] Token exchange FAILED:`, tokenError.message);
      throw tokenError;
    }

    if (!tokens.userId) {
      console.error(`[X Login] [${requestId}] No user_id from token exchange or /users/me`);
      return NextResponse.redirect(
        new URL("/sign-in?error=no_user_id&provider=x", baseUrl)
      );
    }

    const xUserId = tokens.userId;
    if (debug) console.log(`[X Login] [${requestId}] X user ID obtained: ${xUserId}`);

    // Use admin client for user lookup/creation
    const admin = createAdminSupabaseClient();

    // Look up existing user by X user_id in social_identities
    const { data: existingIdentity } = await admin
      .from("social_identities")
      .select("user_id")
      .eq("provider", "x")
      .eq("external_user_id", xUserId)
      .single();

    let userId: string;
    let isNewUser = false;

    if (existingIdentity) {
      // Existing user - use their ID
      userId = existingIdentity.user_id;
      console.log(`[X Login] [${requestId}] Existing user found: ${userId}`);
    } else {
      // New user - create Supabase auth user with placeholder email
      isNewUser = true;
      const placeholderEmail = generateXPlaceholderEmail(xUserId);

      if (debug) console.log(`[X Login] [${requestId}] Creating new user with placeholder email`);

      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: placeholderEmail,
        email_confirm: true, // Skip email verification
        user_metadata: {
          placeholder_email: true,
          oauth_provider: "x",
          x_user_id: xUserId,
        },
      });

      if (createError || !newUser.user) {
        console.error(`[X Login] [${requestId}] Failed to create user:`, createError);
        return NextResponse.redirect(
          new URL("/sign-in?error=user_creation_failed&provider=x", baseUrl)
        );
      }

      userId = newUser.user.id;
      console.log(`[X Login] [${requestId}] New user created: ${userId}`);

      // Insert social_identities mapping (for future logins)
      await admin.from("social_identities").insert({
        user_id: userId,
        provider: "x",
        external_user_id: xUserId,
      });

      // Create profile for new user
      await admin.from("profiles").insert({
        id: userId,
        email: placeholderEmail,
        full_name: null,
        timezone: "America/Los_Angeles",
        language: "en",
        is_onboarded: false,
        role: null,
        membership_plan: "none",
        social_insights_enabled: false,
        is_hibernated: false,
      });

      if (debug) console.log(`[X Login] [${requestId}] Profile created`);
    }

    // Claim Stripe checkout session if preserved in state
    const checkoutSessionId = storedState.checkoutSessionId;
    let checkoutClaimed = false; // Track if claim succeeded for cookie clearing
    if (checkoutSessionId?.startsWith("cs_")) {
      console.log(`[X Login] [${requestId}] Found checkout session in state: ${checkoutSessionId.slice(0, 20)}...`);
      const claimResult = await claimCheckoutSession(checkoutSessionId, userId, admin);
      console.log(`[X Login] [${requestId}] Claim result: ${JSON.stringify(claimResult)}`);
      checkoutClaimed = claimResult.claimed;

      if (!claimResult.claimed) {
        console.warn(`[X Login] [${requestId}] Checkout claim failed: ${claimResult.reason}`);
      }
    } else {
      console.log(`[X Login] [${requestId}] No checkout session in state`);
    }

    // Only store tokens and enable social insights if user consented
    if (hasConsent) {
      const accessTokenEncrypted = encryptToken(tokens.accessToken);
      const refreshTokenEncrypted = tokens.refreshToken
        ? encryptToken(tokens.refreshToken)
        : null;
      const tokenExpiresAt = tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
        : null;

      await admin.from("social_accounts").upsert(
        {
          user_id: userId,
          provider: "x",
          external_user_id: xUserId,
          access_token: accessTokenEncrypted,
          refresh_token: refreshTokenEncrypted,
          expires_at: tokenExpiresAt,
        },
        { onConflict: "user_id,provider" }
      );

      if (debug) console.log(`[X Login] [${requestId}] Tokens stored in social_accounts`);

      // Enable social insights on first connection
      const { data: profile } = await admin
        .from("profiles")
        .select("social_insights_activated_at")
        .eq("id", userId)
        .single();

      if (profile && !profile.social_insights_activated_at) {
        await admin
          .from("profiles")
          .update({
            social_insights_enabled: true,
            social_insights_activated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (debug) console.log(`[X Login] [${requestId}] Social insights activated`);
      }
    } else {
      if (debug) console.log(`[X Login] [${requestId}] Skipping auto-connect (no consent)`);
    }

    // MINT SESSION: Generate magic link and verify it to establish session
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: (await admin.auth.admin.getUserById(userId)).data.user?.email || "",
    });

    if (linkError || !linkData.properties?.hashed_token) {
      console.error(`[X Login] [${requestId}] Failed to generate session link:`, linkError);
      return NextResponse.redirect(
        new URL("/sign-in?error=session_failed&provider=x", baseUrl)
      );
    }

    // Create SSR client that can set cookies
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabaseWithCookies = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    });

    // Verify the OTP to establish session (this sets auth cookies)
    const { error: verifyError } = await supabaseWithCookies.auth.verifyOtp({
      token_hash: linkData.properties.hashed_token,
      type: "magiclink",
    });

    if (verifyError) {
      console.error(`[X Login] [${requestId}] Failed to verify OTP:`, verifyError);
      return NextResponse.redirect(
        new URL("/sign-in?error=session_failed&provider=x", baseUrl)
      );
    }

    console.log(`[X Login] [${requestId}] Session established successfully`);

    // Trigger social sync only if consent was given (fire and forget)
    if (hasConsent) {
      const syncUrl = `${baseUrl}/api/social/sync`;
      fetch(syncUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
        body: JSON.stringify({
          userId,
          provider: "x",
        }),
      }).catch((err) => {
        console.error("[X Login] Failed to trigger sync:", err.message);
      });
    }

    // Determine redirect destination
    let destination = storedState.returnTo || "/join";

    // For existing users, redirect to sanctuary if they were going to /join
    if (!isNewUser && destination === "/join") {
      destination = "/sanctuary";
    }

    console.log(`[X Login] [${requestId}] === SUCCESS === Redirecting to ${destination}`);

    // Redirect to destination with success indicator
    const redirectUrl = new URL(destination, baseUrl);
    redirectUrl.searchParams.set("social", "connected");
    redirectUrl.searchParams.set("provider", "x");

    const response = NextResponse.redirect(redirectUrl);

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
  } catch (error: any) {
    console.error(`[X Login] [${requestId}] === EXCEPTION ===`);
    console.error(`[X Login] [${requestId}] Message:`, error.message);
    console.error(`[X Login] [${requestId}] Stack:`, error.stack);
    return NextResponse.redirect(
      new URL("/sign-in?error=oauth_error&provider=x", baseUrl)
    );
  }
}
