import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isOAuthOnly, getLinkedOAuthProviders } from "@/lib/auth/helpers";
import { cookies } from "next/headers";
import { generateAuthUrl, generateOAuthState } from "@/lib/social/oauth";
import { generatePKCEPair, storeCodeVerifier } from "@/lib/oauth/pkce";

// Custom OAuth providers (not supported by Supabase natively)
const CUSTOM_OAUTH_PROVIDERS = ["tiktok", "x"];

/**
 * POST /api/auth/reauth/prepare
 *
 * Prepares a reauth flow for OAuth-only users performing sensitive operations.
 * Sets a reauth_intent cookie and returns the OAuth URL to redirect to.
 *
 * Request body:
 * - intent: "delete" | "hibernate" | "reactivate"
 * - provider: OAuth provider to use for reauth (must be linked to user)
 *
 * Returns:
 * - redirectUrl: The OAuth URL to redirect to
 */

const VALID_INTENTS = ["delete", "hibernate", "reactivate"] as const;
type ReauthIntent = (typeof VALID_INTENTS)[number];

// Cookie expires in 10 minutes (max time for OAuth flow)
const INTENT_COOKIE_MAX_AGE = 10 * 60;

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in." },
        { status: 401 }
      );
    }

    // Parse request
    const { intent, provider } = await req.json();

    // Validate intent
    if (!intent || !VALID_INTENTS.includes(intent)) {
      return NextResponse.json(
        { error: "InvalidIntent", message: "Invalid reauth intent." },
        { status: 400 }
      );
    }

    // Validate provider
    if (!provider) {
      return NextResponse.json(
        { error: "MissingProvider", message: "Provider is required." },
        { status: 400 }
      );
    }

    // Verify user is OAuth-only (password users should use password flow)
    if (!isOAuthOnly(user)) {
      return NextResponse.json(
        {
          error: "NotOAuthOnly",
          message: "You have a password. Please use password verification instead.",
        },
        { status: 400 }
      );
    }

    // Check if this is a custom OAuth provider (like TikTok)
    const isCustomProvider = CUSTOM_OAUTH_PROVIDERS.includes(provider);

    // Verify provider is linked to user
    if (isCustomProvider) {
      // For custom OAuth providers, check social_identities table
      const { data: identity } = await supabase
        .from("social_identities")
        .select("external_user_id")
        .eq("user_id", user.id)
        .eq("provider", provider)
        .single();

      if (!identity) {
        return NextResponse.json(
          {
            error: "ProviderNotLinked",
            message: `Provider ${provider} is not linked to your account.`,
          },
          { status: 400 }
        );
      }
    } else {
      // For Supabase-native providers, check user.identities
      const linkedProviders = getLinkedOAuthProviders(user);
      if (!linkedProviders.includes(provider)) {
        return NextResponse.json(
          {
            error: "ProviderNotLinked",
            message: `Provider ${provider} is not linked to your account.`,
          },
          { status: 400 }
        );
      }
    }

    // Set reauth_intent cookie
    const cookieStore = await cookies();
    const intentData = {
      intent: intent as ReauthIntent,
      provider,
      userId: user.id,
      createdAt: Date.now(),
    };

    cookieStore.set("reauth_intent", JSON.stringify(intentData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: INTENT_COOKIE_MAX_AGE,
      path: "/",
    });

    console.log(`[Reauth/Prepare] Intent set for user ${user.id}: ${intent} via ${provider}`);

    // Get base URL for redirect
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;

    let redirectUrl: string;

    if (isCustomProvider) {
      // For custom OAuth (TikTok), build URL using our custom OAuth system
      const pkce = generatePKCEPair();
      const state = generateOAuthState();

      // Store state with reauth flow marker
      const stateData = JSON.stringify({
        state,
        provider,
        flow: "reauth",
        userId: user.id,
        intent: intent as ReauthIntent,
        timestamp: Date.now(),
      });

      cookieStore.set(`${provider}_reauth_state`, stateData, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: INTENT_COOKIE_MAX_AGE,
        path: "/",
      });

      // Store PKCE verifier
      await storeCodeVerifier(provider, state, pkce.verifier);

      // Build OAuth URL with reauth-specific callback
      const callbackUrl = `${baseUrl}/api/auth/reauth/${provider}/callback`;
      redirectUrl = generateAuthUrl(provider, callbackUrl, state, pkce.challenge);

      console.log(`[Reauth/Prepare] Custom OAuth URL generated for ${provider}`);
    } else {
      // For Supabase-native providers, use Supabase OAuth
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider as any,
        options: {
          redirectTo: `${baseUrl}/auth/callback?type=reauth`,
          skipBrowserRedirect: true,
        },
      });

      if (error || !data.url) {
        console.error("[Reauth/Prepare] OAuth URL generation failed:", error);
        return NextResponse.json(
          { error: "OAuthFailed", message: "Failed to generate OAuth URL." },
          { status: 500 }
        );
      }

      redirectUrl = data.url;
    }

    return NextResponse.json({
      success: true,
      redirectUrl,
    });
  } catch (error: any) {
    console.error("[Reauth/Prepare] Error:", error);
    return NextResponse.json(
      { error: "PrepareFailed", message: error.message || "Failed to prepare reauth." },
      { status: 500 }
    );
  }
}
