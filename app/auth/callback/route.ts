import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { claimCheckoutSession } from "@/lib/stripe/claimCheckoutSession";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { encryptToken } from "@/lib/social/crypto";
import { SocialProvider } from "@/types";

/**
 * Get the correct base URL for redirects.
 *
 * IMPORTANT: In reverse proxy/tunnel environments (Cloudflare, ngrok, etc.),
 * request.url will show the internal URL (e.g., localhost:3000) not the
 * external URL the user accessed. We MUST use NEXT_PUBLIC_SITE_URL instead.
 */
function getBaseUrl(request: NextRequest): string {
  // First priority: Use configured site URL (required for tunnels/proxies)
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredUrl) {
    return configuredUrl;
  }

  // Fallback: Try to detect from X-Forwarded headers (reverse proxy standard)
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  // Last resort: Use request URL (only works without proxy/tunnel)
  const requestUrl = new URL(request.url);
  return requestUrl.origin;
}

// Reauth cookie validity: 5 minutes
const REAUTH_OK_MAX_AGE = 5 * 60;

// Supported social providers for auto-connect
const SOCIAL_PROVIDERS: SocialProvider[] = ["facebook", "instagram", "tiktok", "x", "reddit"];

/**
 * Detect OAuth provider from Supabase user data.
 * Uses multiple sources for reliability:
 * 1. app_metadata.provider (most reliable for current login)
 * 2. First social identity in identities array
 *
 * Returns the provider if it's a supported social provider, null otherwise.
 */
function detectSocialProvider(user: {
  app_metadata?: { provider?: string; providers?: string[] };
  identities?: Array<{ provider: string }>;
}): SocialProvider | null {
  // 1. Check app_metadata.provider (set by Supabase on OAuth login)
  const metaProvider = user.app_metadata?.provider;
  if (metaProvider && SOCIAL_PROVIDERS.includes(metaProvider as SocialProvider)) {
    return metaProvider as SocialProvider;
  }

  // 2. Check app_metadata.providers array (last one is usually most recent)
  const providers = user.app_metadata?.providers;
  if (providers && providers.length > 0) {
    for (let i = providers.length - 1; i >= 0; i--) {
      if (SOCIAL_PROVIDERS.includes(providers[i] as SocialProvider)) {
        return providers[i] as SocialProvider;
      }
    }
  }

  // 3. Fallback to identities array
  if (user.identities && user.identities.length > 0) {
    for (const identity of user.identities) {
      if (SOCIAL_PROVIDERS.includes(identity.provider as SocialProvider)) {
        return identity.provider as SocialProvider;
      }
    }
  }

  return null;
}

/**
 * Fetch external user ID from provider API.
 * Currently supports Facebook. Other providers return user ID in token response.
 * Returns null on failure (non-blocking).
 */
async function fetchExternalUserId(
  provider: SocialProvider,
  accessToken: string
): Promise<string | null> {
  try {
    if (provider === "facebook") {
      const response = await fetch(
        `https://graph.facebook.com/me?fields=id&access_token=${encodeURIComponent(accessToken)}`
      );
      if (!response.ok) {
        console.error(`[AuthCallback] ${provider} API /me failed: ${response.status}`);
        return null;
      }
      const data = await response.json();
      return data.id || null;
    }

    if (provider === "instagram") {
      const response = await fetch(
        `https://graph.instagram.com/me?fields=id&access_token=${encodeURIComponent(accessToken)}`
      );
      if (!response.ok) {
        console.error(`[AuthCallback] ${provider} API /me failed: ${response.status}`);
        return null;
      }
      const data = await response.json();
      return data.id || null;
    }

    // For other providers, external_user_id may come from identity
    // Return null - caller should try to get it from user.identities
    return null;
  } catch (err: any) {
    console.error(`[AuthCallback] ${provider} user fetch failed: ${err.message}`);
    return null;
  }
}

/**
 * Get external user ID from Supabase identities array.
 */
function getExternalUserIdFromIdentities(
  user: { identities?: Array<{ provider: string; id?: string }> },
  provider: SocialProvider
): string | null {
  if (!user.identities) return null;

  const identity = user.identities.find((i) => i.provider === provider);
  return identity?.id || null;
}

/**
 * Check if user has consent for social insights.
 *
 * CONSENT LOGIC (quiet mode):
 * - Cookie present with value "true" = explicit consent this session
 * - DB flag profiles.social_insights_enabled = true = previously consented (returning user)
 *
 * This ensures returning users don't need cookie (quiet mode).
 */
async function checkSocialInsightsConsent(
  userId: string,
  provider: SocialProvider,
  cookieStore: Awaited<ReturnType<typeof cookies>>
): Promise<boolean> {
  // 1. Check consent cookie for this provider
  const consentCookie = cookieStore.get(`oauth_consent_${provider}`);
  if (consentCookie?.value === "true") {
    return true;
  }

  // 2. DB fallback: check if already enabled (returning user)
  try {
    const serviceSupabase = createServiceSupabaseClient();
    const { data: profile } = await serviceSupabase
      .from("profiles")
      .select("social_insights_enabled")
      .eq("id", userId)
      .single();

    if (profile?.social_insights_enabled === true) {
      return true;
    }
  } catch (err: any) {
    console.error(`[AuthCallback] Consent DB check failed: ${err.message}`);
  }

  return false;
}

/**
 * Handle social provider auto-connect when provider_token is available.
 * Stores encrypted token, enables social insights, triggers sync.
 *
 * This is a "quiet" operation - errors are logged but don't fail auth.
 * Supports all social providers (Facebook, Instagram, TikTok, X, Reddit).
 */
async function handleSocialAutoConnect(
  userId: string,
  provider: SocialProvider,
  providerToken: string,
  user: { identities?: Array<{ provider: string; id?: string }> },
  baseUrl: string
): Promise<boolean> {
  try {
    // Get external user ID (try API first, then identities)
    let externalUserId = await fetchExternalUserId(provider, providerToken);

    if (!externalUserId) {
      // Fallback to identities array
      externalUserId = getExternalUserIdFromIdentities(user, provider);
    }

    if (!externalUserId) {
      // Generate a placeholder - some providers don't expose user ID easily
      // We still want to store the token for insights
      console.warn(`[AuthCallback] ${provider} auto-connect: no external_user_id, using placeholder`);
      externalUserId = `unknown_${provider}_${Date.now()}`;
    }

    // Encrypt token before storing (AES-256-GCM)
    const encryptedToken = encryptToken(providerToken);

    // Use service role to write to social_accounts (bypasses RLS)
    const serviceSupabase = createServiceSupabaseClient();

    // Upsert to social_accounts
    const { error: upsertError } = await serviceSupabase
      .from("social_accounts")
      .upsert(
        {
          user_id: userId,
          provider,
          external_user_id: externalUserId,
          access_token: encryptedToken,
          refresh_token: null, // Most social providers don't use refresh tokens via Supabase OAuth
          expires_at: null, // Short-lived tokens - will need reauth eventually
        },
        { onConflict: "user_id,provider" }
      );

    if (upsertError) {
      console.error(`[AuthCallback] ${provider} auto-connect: social_accounts upsert failed:`, upsertError.message);
      return false;
    }

    // Upsert to social_identities (for compliance - Meta Data Deletion, etc.)
    await serviceSupabase
      .from("social_identities")
      .upsert(
        {
          user_id: userId,
          provider,
          external_user_id: externalUserId,
        },
        { onConflict: "user_id,provider" }
      );

    // Enable social insights on profile (if not already activated)
    const { data: profile } = await serviceSupabase
      .from("profiles")
      .select("social_insights_activated_at")
      .eq("id", userId)
      .single();

    if (profile && !profile.social_insights_activated_at) {
      await serviceSupabase
        .from("profiles")
        .update({
          social_insights_enabled: true,
          social_insights_activated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    }

    // Trigger sync ONLY for THIS provider (fire-and-forget)
    // NOTE: Cron handles other connected providers daily
    triggerSocialSync(userId, provider, baseUrl);

    console.log(`[AuthCallback] ${provider} auto-connect complete for user: ${userId}`);
    return true;
  } catch (err: any) {
    console.error(`[AuthCallback] ${provider} auto-connect failed:`, err.message);
    return false;
  }
}

/**
 * Fire-and-forget sync trigger for a SINGLE provider.
 * Calls /api/social/sync with CRON_SECRET auth.
 *
 * NOTE: On login, we ONLY sync the login provider. Cron handles rest.
 */
function triggerSocialSync(
  userId: string,
  provider: SocialProvider,
  baseUrl: string
): void {
  const syncUrl = `${baseUrl}/api/social/sync`;

  fetch(syncUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
    body: JSON.stringify({
      userId,
      provider,
    }),
  }).catch((err) => {
    console.error(`[AuthCallback] Sync trigger failed for ${provider}:`, err.message);
  });
}

/**
 * Auth callback route handler
 *
 * Handles Supabase auth callbacks for:
 * - OAuth sign-in (Facebook, TikTok, X, etc.)
 * - Email verification
 * - Password reset (PKCE flow)
 * - Reauth flow for OAuth-only users (type=reauth)
 *
 * The callback receives a `code` parameter which is exchanged for a session.
 *
 * SOCIAL AUTO-CONNECT (Quiet Mode):
 * When a user logs in with a social provider and has consented to Social Insights
 * (via cookie OR DB flag), we capture the provider_token and auto-connect.
 * This eliminates the need for a second OAuth flow.
 *
 * SYNC RULE: On login, we ONLY sync the login provider. Cron handles other providers daily.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type"); // recovery, signup, etc.

  // Get the correct base URL (handles reverse proxy/tunnel scenarios)
  const baseUrl = getBaseUrl(request);

  // Minimal debug logging (no secrets, no code param)
  console.log(`[AuthCallback] Request received - baseUrl: ${baseUrl}, type: ${type || "(none)"}, code: ${code ? "present" : "missing"}`);

  if (code) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error("[AuthCallback] Code exchange failed:", error.message);

        // Redirect to appropriate error page based on type
        if (type === "recovery") {
          return NextResponse.redirect(
            new URL("/reset-password?error=expired", baseUrl)
          );
        }

        return NextResponse.redirect(
          new URL("/sign-in?error=auth_callback_failed", baseUrl)
        );
      }

      const userId = data.user?.id;
      console.log(`[AuthCallback] Session established for user: ${userId}`);

      // =========================================================
      // SOCIAL AUTO-CONNECT: Capture provider_token if available
      // =========================================================
      const providerToken = data.session?.provider_token;
      const cookieStore = await cookies();

      // Track the login provider for sync (only sync THIS provider on login)
      let loginProvider: SocialProvider | null = null;

      if (data.user) {
        // Detect which social provider this login is from
        loginProvider = detectSocialProvider(data.user);

        if (loginProvider) {
          console.log(`[AuthCallback] Social login detected: ${loginProvider}`);

          // Check consent (cookie OR DB flag for returning users)
          const hasConsent = await checkSocialInsightsConsent(
            data.user.id,
            loginProvider,
            cookieStore
          );

          console.log(`[AuthCallback] ${loginProvider} consent: ${hasConsent}, provider_token: ${providerToken ? "present" : "missing"}`);

          if (hasConsent && providerToken) {
            // Auto-connect this provider (quiet operation)
            await handleSocialAutoConnect(
              data.user.id,
              loginProvider,
              providerToken,
              data.user,
              baseUrl
            );
          } else if (hasConsent && !providerToken) {
            // Consent given but no token (Supabase didn't return it)
            // This can happen - user may need to reconnect via Settings
            console.log(`[AuthCallback] ${loginProvider}: consent=true but no provider_token from Supabase`);
          } else {
            console.log(`[AuthCallback] Skipping ${loginProvider} auto-connect (no consent)`);
          }
        }
      }

      // Track if checkout claim succeeded (for conditional cookie clearing)
      let checkoutClaimed = false;

      // Ensure profile exists (prevents bounce to /join due to missing profile)
      // This is critical for OAuth flows where Supabase creates auth user but not profile
      if (data.user) {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", data.user.id)
          .single();

        if (!existingProfile) {
          console.log(`[AuthCallback] Creating minimal profile for user: ${data.user.id}`);

          // Detect timezone from request headers if possible
          const timezone = Intl.DateTimeFormat().resolvedOptions?.().timeZone || "America/Los_Angeles";

          const { error: insertError } = await supabase.from("profiles").insert({
            id: data.user.id,
            email: data.user.email || "",
            timezone,
            language: "en",
            is_onboarded: false,
            social_insights_enabled: false,
            is_hibernated: false,
            role: "user",
            membership_plan: "none",
          });

          if (insertError) {
            console.error(`[AuthCallback] Profile creation failed:`, insertError.message);
            // Continue anyway - SettingsProvider will create profile as fallback
          } else {
            console.log(`[AuthCallback] Profile created successfully`);
          }
        } else {
          // Returning user - sync ONLY the login provider (if social login)
          // NOTE: Do NOT sync all providers here. Cron handles that daily.
          if (loginProvider) {
            // Already handled above in auto-connect if token was present
            // If no token but returning user with existing connection, trigger sync
            const serviceSupabase = createServiceSupabaseClient();
            const { data: existingAccount } = await serviceSupabase
              .from("social_accounts")
              .select("id")
              .eq("user_id", data.user.id)
              .eq("provider", loginProvider)
              .single();

            if (existingAccount && !providerToken) {
              // Has existing connection but no new token - still trigger sync
              console.log(`[AuthCallback] Returning user, triggering sync for ${loginProvider}`);
              triggerSocialSync(data.user.id, loginProvider, baseUrl);
            }
          }
        }

        // Claim Stripe checkout session if cookie is present
        // This links the payment to the current user by ID (not email)
        const checkoutSessionCookie = cookieStore.get("solara_checkout_session");

        if (checkoutSessionCookie?.value?.startsWith("cs_")) {
          console.log(`[AuthCallback] Found checkout session cookie, attempting to claim...`);

          const adminSupabase = createAdminSupabaseClient();
          const claimResult = await claimCheckoutSession(
            checkoutSessionCookie.value,
            data.user.id,
            adminSupabase
          );

          console.log(`[AuthCallback] Claim result: ${JSON.stringify(claimResult)}`);
          checkoutClaimed = claimResult.claimed;

          if (!claimResult.claimed) {
            console.warn(`[AuthCallback] Checkout claim failed: ${claimResult.reason}`);
          }
        }
      }

      // Handle recovery flow - redirect to reset password page
      if (type === "recovery") {
        console.log(`[AuthCallback] Recovery flow - redirecting to /reset-password`);
        return NextResponse.redirect(new URL("/reset-password", baseUrl));
      }

      // Handle reauth flow for OAuth-only users
      if (type === "reauth") {
        const intentCookie = cookieStore.get("reauth_intent");

        if (!intentCookie) {
          console.warn("[AuthCallback] Reauth flow but no intent cookie found");
          return NextResponse.redirect(new URL("/settings?error=reauth_expired", baseUrl));
        }

        try {
          const intentData = JSON.parse(intentCookie.value);

          // Verify user matches intent
          if (intentData.userId !== data.user?.id) {
            console.error("[AuthCallback] Reauth user mismatch");
            cookieStore.delete("reauth_intent");
            return NextResponse.redirect(new URL("/settings?error=reauth_mismatch", baseUrl));
          }

          // Check intent hasn't expired (10 min max)
          const intentAge = Date.now() - intentData.createdAt;
          if (intentAge > 10 * 60 * 1000) {
            console.warn("[AuthCallback] Reauth intent expired");
            cookieStore.delete("reauth_intent");
            return NextResponse.redirect(new URL("/settings?error=reauth_expired", baseUrl));
          }

          // Set reauth_ok cookie (5-minute validity)
          const reauthOkData = {
            intent: intentData.intent,
            userId: data.user?.id,
            provider: intentData.provider,
            completedAt: Date.now(),
          };

          cookieStore.set("reauth_ok", JSON.stringify(reauthOkData), {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: REAUTH_OK_MAX_AGE,
            path: "/",
          });

          // Clear intent cookie
          cookieStore.delete("reauth_intent");

          console.log(`[AuthCallback] Reauth successful, intent: ${intentData.intent}`);

          // Redirect to settings with success param
          return NextResponse.redirect(
            new URL(`/settings?reauth_success=${intentData.intent}`, baseUrl)
          );
        } catch (parseError) {
          console.error("[AuthCallback] Failed to parse reauth intent");
          cookieStore.delete("reauth_intent");
          return NextResponse.redirect(new URL("/settings?error=reauth_invalid", baseUrl));
        }
      }

      // Check for `next` query param (used by magiclink flows from complete-signup/resend)
      // SECURITY: Allowlist-only to prevent open redirect attacks
      const ALLOWED_NEXT = new Set([
        "/onboarding",
        "/set-password",
        "/settings?refresh=1",
        "/sanctuary",
        "/welcome",
      ]);

      const nextPath = requestUrl.searchParams.get("next");
      if (nextPath) {
        // Defense-in-depth: reject obviously malicious patterns
        const isMalicious = nextPath.includes("://") || nextPath.startsWith("//") || nextPath.includes("\\");

        if (!isMalicious && ALLOWED_NEXT.has(nextPath)) {
          console.log(`[AuthCallback] Magiclink flow - redirecting to: ${nextPath}`);
          return NextResponse.redirect(new URL(nextPath, baseUrl));
        }
        console.warn(`[AuthCallback] Rejected next param (not in allowlist)`);
      }

      // For OAuth flows, redirect to post-callback page which reads destination from sessionStorage
      // This works around Supabase stripping query params from redirectTo
      console.log(`[AuthCallback] SUCCESS - Redirecting to /auth/post-callback`);

      const response = NextResponse.redirect(new URL("/auth/post-callback", baseUrl));

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
    } catch (err) {
      console.error("[AuthCallback] Unexpected error:", err);
      return NextResponse.redirect(
        new URL("/sign-in?error=unexpected", baseUrl)
      );
    }
  }

  // No code provided - redirect to sign-in
  console.warn("[AuthCallback] No code parameter provided");
  return NextResponse.redirect(new URL("/sign-in", baseUrl));
}
