import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/social/oauth";
import { retrieveCodeVerifier } from "@/lib/oauth/pkce";
import { encryptToken } from "@/lib/social/crypto";
import { generateTikTokPlaceholderEmail } from "@/lib/auth/placeholder";
import { claimCheckoutSession } from "@/lib/stripe/claimCheckoutSession";

// Debug mode controlled by environment variable
const debug = process.env.OAUTH_DEBUG_LOGS === "true";

/**
 * GET /api/auth/login/tiktok/callback
 *
 * Handles TikTok OAuth callback for LOGIN flow:
 * 1. Validates state + PKCE
 * 2. Exchanges code for tokens
 * 3. Looks up or creates Supabase user
 * 4. Mints session (sets auth cookies)
 * 5. Stores tokens in social_accounts (auto-connect)
 * 6. Redirects to destination
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
    const stateCookie = cookieStore.get("tiktok_login_state");

    if (debug) {
      console.log(`[TikTok Login] [${requestId}] === CALLBACK ENTRY ===`);
      console.log(`[TikTok Login] [${requestId}] code present: ${!!code}`);
      console.log(`[TikTok Login] [${requestId}] state present: ${!!state}`);
      console.log(`[TikTok Login] [${requestId}] error: ${error || "(none)"}`);
      console.log(`[TikTok Login] [${requestId}] state cookie present: ${!!stateCookie}`);
    }

    // Handle OAuth errors
    if (error) {
      console.error(`[TikTok Login] [${requestId}] Provider error: ${error}`);
      return NextResponse.redirect(
        new URL(`/sign-in?error=access_denied&provider=tiktok`, baseUrl)
      );
    }

    // Validate code and state
    if (!code || !state) {
      console.error(`[TikTok Login] [${requestId}] Missing code or state`);
      return NextResponse.redirect(
        new URL("/sign-in?error=missing_params&provider=tiktok", baseUrl)
      );
    }

    // Validate state cookie
    if (!stateCookie) {
      console.error(`[TikTok Login] [${requestId}] State cookie missing`);
      return NextResponse.redirect(
        new URL("/sign-in?error=state_expired&provider=tiktok", baseUrl)
      );
    }

    let storedState: {
      state: string;
      provider: string;
      flow: string;
      timestamp: number;
      returnTo: string;
    };

    try {
      storedState = JSON.parse(stateCookie.value);
    } catch {
      console.error(`[TikTok Login] [${requestId}] Invalid state cookie`);
      return NextResponse.redirect(
        new URL("/sign-in?error=invalid_state&provider=tiktok", baseUrl)
      );
    }

    // Validate state matches
    if (storedState.state !== state || storedState.flow !== "login") {
      console.error(`[TikTok Login] [${requestId}] State mismatch`);
      return NextResponse.redirect(
        new URL("/sign-in?error=state_mismatch&provider=tiktok", baseUrl)
      );
    }

    // Check state hasn't expired (10 minutes)
    const stateAgeMs = Date.now() - storedState.timestamp;
    if (stateAgeMs > 10 * 60 * 1000) {
      console.error(`[TikTok Login] [${requestId}] State expired (age: ${Math.round(stateAgeMs / 1000)}s)`);
      return NextResponse.redirect(
        new URL("/sign-in?error=state_expired&provider=tiktok", baseUrl)
      );
    }

    // Clear state cookie
    cookieStore.delete("tiktok_login_state");

    // Check consent cookie (set by client before OAuth redirect)
    const consentCookie = cookieStore.get("oauth_consent_tiktok");
    const hasConsent = consentCookie?.value === "true";
    if (debug) console.log(`[TikTok Login] [${requestId}] Consent: ${hasConsent}`);

    // Retrieve PKCE verifier
    const codeVerifier = await retrieveCodeVerifier("tiktok", state);
    if (!codeVerifier) {
      console.error(`[TikTok Login] [${requestId}] PKCE verifier missing`);
      return NextResponse.redirect(
        new URL("/sign-in?error=pkce_missing&provider=tiktok", baseUrl)
      );
    }

    console.log(`[TikTok Login] [${requestId}] State validated, exchanging code...`);
    console.log(`[TikTok Login] [${requestId}] baseUrl: ${baseUrl}`);

    // Exchange code for tokens
    const redirectUri = `${baseUrl}/api/auth/login/tiktok/callback`;
    console.log(`[TikTok Login] [${requestId}] redirectUri for token exchange: ${redirectUri}`);

    let tokens;
    try {
      tokens = await exchangeCodeForTokens("tiktok", code, redirectUri, codeVerifier);
      console.log(`[TikTok Login] [${requestId}] Token exchange successful`);
    } catch (tokenError: any) {
      console.error(`[TikTok Login] [${requestId}] Token exchange FAILED:`, tokenError.message);
      throw tokenError;
    }

    if (!tokens.userId) {
      console.error(`[TikTok Login] [${requestId}] No open_id in token response`);
      return NextResponse.redirect(
        new URL("/sign-in?error=no_user_id&provider=tiktok", baseUrl)
      );
    }

    const openId = tokens.userId;
    if (debug) console.log(`[TikTok Login] [${requestId}] Token exchange success, open_id present`);

    // Use admin client for user lookup/creation
    const admin = createAdminSupabaseClient();

    // Look up existing user by TikTok open_id in social_identities
    const { data: existingIdentity } = await admin
      .from("social_identities")
      .select("user_id")
      .eq("provider", "tiktok")
      .eq("external_user_id", openId)
      .single();

    let userId: string;
    let isNewUser = false;

    if (existingIdentity) {
      // Existing user - use their ID
      userId = existingIdentity.user_id;
      console.log(`[TikTok Login] [${requestId}] Existing user found: ${userId}`);
    } else {
      // New user - create Supabase auth user with placeholder email
      isNewUser = true;
      const placeholderEmail = generateTikTokPlaceholderEmail(openId);

      if (debug) console.log(`[TikTok Login] [${requestId}] Creating new user with placeholder email`);

      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: placeholderEmail,
        email_confirm: true, // Skip email verification
        user_metadata: {
          placeholder_email: true,
          oauth_provider: "tiktok",
          tiktok_open_id: openId,
        },
      });

      if (createError || !newUser.user) {
        console.error(`[TikTok Login] [${requestId}] Failed to create user:`, createError);
        return NextResponse.redirect(
          new URL("/sign-in?error=user_creation_failed&provider=tiktok", baseUrl)
        );
      }

      userId = newUser.user.id;
      console.log(`[TikTok Login] [${requestId}] New user created: ${userId}`);

      // Insert social_identities mapping (for future logins)
      await admin.from("social_identities").insert({
        user_id: userId,
        provider: "tiktok",
        external_user_id: openId,
      });

      // Create profile for new user (match fields from /auth/callback)
      await admin.from("profiles").insert({
        id: userId,
        email: placeholderEmail,
        full_name: null,
        timezone: "America/Los_Angeles", // Default
        language: "en",
        is_onboarded: false,
        role: null,
        membership_plan: "none",
        social_insights_enabled: false,
        is_hibernated: false,
      });

      if (debug) console.log(`[TikTok Login] [${requestId}] Profile created`);
    }

    // Claim Stripe checkout session if cookie exists (links payment to this user by ID)
    const checkoutCookie = cookieStore.get("solara_checkout_session");
    if (checkoutCookie?.value?.startsWith("cs_")) {
      console.log(`[TikTok Login] [${requestId}] Found checkout session cookie, claiming...`);
      const claimResult = await claimCheckoutSession(checkoutCookie.value, userId, admin);
      console.log(`[TikTok Login] [${requestId}] Claim result: ${JSON.stringify(claimResult)}`);
    }

    // Only store tokens and enable social insights if user consented
    if (hasConsent) {
      // Store/update tokens in social_accounts (auto-connect)
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
          provider: "tiktok",
          external_user_id: openId,
          access_token: accessTokenEncrypted,
          refresh_token: refreshTokenEncrypted,
          expires_at: tokenExpiresAt,
        },
        { onConflict: "user_id,provider" }
      );

      if (debug) console.log(`[TikTok Login] [${requestId}] Tokens stored in social_accounts`);

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

        if (debug) console.log(`[TikTok Login] [${requestId}] Social insights activated`);
      }
    } else {
      if (debug) console.log(`[TikTok Login] [${requestId}] Skipping auto-connect (no consent)`);
    }

    // MINT SESSION: Generate magic link and verify it to establish session
    // This sets the auth cookies without sending any email
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: (await admin.auth.admin.getUserById(userId)).data.user?.email || "",
    });

    if (linkError || !linkData.properties?.hashed_token) {
      console.error(`[TikTok Login] [${requestId}] Failed to generate session link:`, linkError);
      return NextResponse.redirect(
        new URL("/sign-in?error=session_failed&provider=tiktok", baseUrl)
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
      console.error(`[TikTok Login] [${requestId}] Failed to verify OTP:`, verifyError);
      return NextResponse.redirect(
        new URL("/sign-in?error=session_failed&provider=tiktok", baseUrl)
      );
    }

    console.log(`[TikTok Login] [${requestId}] Session established successfully`);

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
          provider: "tiktok",
        }),
      }).catch((err) => {
        console.error("[TikTok Login] Failed to trigger sync:", err.message);
      });
    }

    // Determine redirect destination
    let destination = storedState.returnTo || "/join";

    // For existing users, redirect to sanctuary if they were going to /join
    if (!isNewUser && destination === "/join") {
      destination = "/sanctuary";
    }

    console.log(`[TikTok Login] [${requestId}] === SUCCESS === Redirecting to ${destination}`);

    // Redirect to destination with success indicator
    const redirectUrl = new URL(destination, baseUrl);
    redirectUrl.searchParams.set("social", "connected");
    redirectUrl.searchParams.set("provider", "tiktok");

    const response = NextResponse.redirect(redirectUrl);

    // Clear checkout session cookie (it's been claimed or doesn't exist)
    response.cookies.set("solara_checkout_session", "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });

    return response;
  } catch (error: any) {
    console.error(`[TikTok Login] [${requestId}] === EXCEPTION ===`);
    console.error(`[TikTok Login] [${requestId}] Message:`, error.message);
    console.error(`[TikTok Login] [${requestId}] Stack:`, error.stack);
    return NextResponse.redirect(
      new URL("/sign-in?error=oauth_error&provider=tiktok", baseUrl)
    );
  }
}
