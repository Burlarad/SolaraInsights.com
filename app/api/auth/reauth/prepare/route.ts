import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isOAuthOnly, getLinkedOAuthProviders } from "@/lib/auth/helpers";
import { cookies } from "next/headers";

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

    // Verify provider is linked to user
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

    // Build Supabase OAuth URL
    // We redirect back to our callback which will detect the reauth_intent cookie
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider as any,
      options: {
        redirectTo: `${baseUrl}/auth/callback?type=reauth`,
        skipBrowserRedirect: true, // We return URL, client redirects
      },
    });

    if (error || !data.url) {
      console.error("[Reauth/Prepare] OAuth URL generation failed:", error);
      return NextResponse.json(
        { error: "OAuthFailed", message: "Failed to generate OAuth URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      redirectUrl: data.url,
    });
  } catch (error: any) {
    console.error("[Reauth/Prepare] Error:", error);
    return NextResponse.json(
      { error: "PrepareFailed", message: error.message || "Failed to prepare reauth." },
      { status: 500 }
    );
  }
}
