import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/social/oauth";
import { retrieveCodeVerifier } from "@/lib/oauth/pkce";
import { setReauth } from "@/lib/auth/reauth";

const debug = process.env.OAUTH_DEBUG_LOGS === "true";

/**
 * GET /api/auth/reauth/tiktok/callback
 *
 * Handles TikTok OAuth callback for REAUTH flow:
 * 1. Validates state + PKCE
 * 2. Exchanges code for tokens
 * 3. Verifies open_id matches user's stored identity
 * 4. Sets reauth_ok cookie (5 minutes)
 * 5. Redirects to /settings with success
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
    const stateCookie = cookieStore.get("tiktok_reauth_state");
    const intentCookie = cookieStore.get("reauth_intent");

    if (debug) {
      console.log(`[TikTok Reauth] [${requestId}] === CALLBACK ENTRY ===`);
      console.log(`[TikTok Reauth] [${requestId}] code present: ${!!code}`);
      console.log(`[TikTok Reauth] [${requestId}] state present: ${!!state}`);
      console.log(`[TikTok Reauth] [${requestId}] error: ${error || "(none)"}`);
    }

    // Handle OAuth errors
    if (error) {
      console.error(`[TikTok Reauth] [${requestId}] Provider error: ${error}`);
      return NextResponse.redirect(
        new URL("/settings?error=reauth_failed&provider=tiktok", baseUrl)
      );
    }

    // Validate code and state
    if (!code || !state) {
      console.error(`[TikTok Reauth] [${requestId}] Missing code or state`);
      return NextResponse.redirect(
        new URL("/settings?error=missing_params", baseUrl)
      );
    }

    // Validate state cookie
    if (!stateCookie) {
      console.error(`[TikTok Reauth] [${requestId}] State cookie missing`);
      return NextResponse.redirect(
        new URL("/settings?error=state_expired", baseUrl)
      );
    }

    let storedState: {
      state: string;
      provider: string;
      flow: string;
      userId: string;
      intent: "delete" | "hibernate" | "reactivate";
      timestamp: number;
    };

    try {
      storedState = JSON.parse(stateCookie.value);
    } catch {
      console.error(`[TikTok Reauth] [${requestId}] Invalid state cookie`);
      return NextResponse.redirect(
        new URL("/settings?error=invalid_state", baseUrl)
      );
    }

    // Validate state matches and flow is reauth
    if (storedState.state !== state || storedState.flow !== "reauth") {
      console.error(`[TikTok Reauth] [${requestId}] State mismatch`);
      return NextResponse.redirect(
        new URL("/settings?error=state_mismatch", baseUrl)
      );
    }

    // Check state hasn't expired (10 minutes)
    const stateAgeMs = Date.now() - storedState.timestamp;
    if (stateAgeMs > 10 * 60 * 1000) {
      console.error(`[TikTok Reauth] [${requestId}] State expired`);
      return NextResponse.redirect(
        new URL("/settings?error=state_expired", baseUrl)
      );
    }

    // Clear state cookie
    cookieStore.delete("tiktok_reauth_state");

    // Verify intent cookie matches
    if (!intentCookie) {
      console.error(`[TikTok Reauth] [${requestId}] Intent cookie missing`);
      return NextResponse.redirect(
        new URL("/settings?error=intent_expired", baseUrl)
      );
    }

    let intentData: { intent: string; userId: string };
    try {
      intentData = JSON.parse(intentCookie.value);
    } catch {
      console.error(`[TikTok Reauth] [${requestId}] Invalid intent cookie`);
      return NextResponse.redirect(
        new URL("/settings?error=invalid_intent", baseUrl)
      );
    }

    // Verify user IDs match
    if (intentData.userId !== storedState.userId) {
      console.error(`[TikTok Reauth] [${requestId}] User ID mismatch`);
      return NextResponse.redirect(
        new URL("/settings?error=user_mismatch", baseUrl)
      );
    }

    // Retrieve PKCE verifier
    const codeVerifier = await retrieveCodeVerifier("tiktok", state);
    if (!codeVerifier) {
      console.error(`[TikTok Reauth] [${requestId}] PKCE verifier missing`);
      return NextResponse.redirect(
        new URL("/settings?error=pkce_missing", baseUrl)
      );
    }

    if (debug) console.log(`[TikTok Reauth] [${requestId}] Exchanging code...`);

    // Exchange code for tokens
    const redirectUri = `${baseUrl}/api/auth/reauth/tiktok/callback`;
    const tokens = await exchangeCodeForTokens("tiktok", code, redirectUri, codeVerifier);

    if (!tokens.userId) {
      console.error(`[TikTok Reauth] [${requestId}] No open_id in token response`);
      return NextResponse.redirect(
        new URL("/settings?error=no_user_id", baseUrl)
      );
    }

    const openId = tokens.userId;

    // Verify the open_id matches what's stored in social_identities for this user
    const supabase = await createServerSupabaseClient();
    const { data: identity } = await supabase
      .from("social_identities")
      .select("external_user_id")
      .eq("user_id", storedState.userId)
      .eq("provider", "tiktok")
      .single();

    if (!identity || identity.external_user_id !== openId) {
      console.error(`[TikTok Reauth] [${requestId}] Open ID mismatch - potential account takeover attempt`);
      return NextResponse.redirect(
        new URL("/settings?error=identity_mismatch", baseUrl)
      );
    }

    console.log(`[TikTok Reauth] [${requestId}] Identity verified for user ${storedState.userId}`);

    // Clear intent cookie
    cookieStore.delete("reauth_intent");

    // Set reauth_ok cookie (5 minutes)
    await setReauth(storedState.userId, storedState.intent);

    console.log(`[TikTok Reauth] [${requestId}] === SUCCESS === reauth_ok set for intent: ${storedState.intent}`);

    // Redirect to settings with success
    return NextResponse.redirect(
      new URL(`/settings?reauth_success=${storedState.intent}`, baseUrl)
    );
  } catch (error: any) {
    console.error(`[TikTok Reauth] [${requestId}] Exception:`, error.message);
    return NextResponse.redirect(
      new URL("/settings?error=reauth_failed", baseUrl)
    );
  }
}
