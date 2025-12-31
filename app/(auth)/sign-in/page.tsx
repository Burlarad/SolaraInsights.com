"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { toSafeInternalPath } from "@/lib/validation/internalUrl";
import { getOauthCallbackUrl } from "@/lib/url/base";
import { SocialConsentModal } from "@/components/auth/SocialConsentModal";
import { persistOauthContext } from "@/lib/auth/socialConsent";
import { useTranslations } from "next-intl";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("auth.signIn");
  const tCommon = useTranslations("common");

  // Get returnUrl from query params with security validation
  const returnUrl = toSafeInternalPath(searchParams.get("returnUrl"));

  // OAuth error from callback redirect
  const oauthError = searchParams.get("error");
  const oauthProvider = searchParams.get("provider");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Consent modal state
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<"facebook" | "tiktok" | null>(null);

  // Map OAuth error codes to user-friendly messages
  const getOAuthErrorMessage = (code: string, provider: string): string => {
    const messages: Record<string, string> = {
      access_denied: `${provider} authorization was denied or canceled.`,
      missing_params: `Missing authorization data from ${provider}.`,
      state_expired: `Session expired. Please try again.`,
      invalid_state: `Invalid session. Please try again.`,
      state_mismatch: `Security check failed. Please try again.`,
      pkce_missing: `Security verification failed. Please try again.`,
      no_user_id: `Could not retrieve your ${provider} account info.`,
      user_creation_failed: `Failed to create account. Please try again.`,
      session_failed: `Failed to establish session. Please try again.`,
      oauth_error: `An error occurred with ${provider} sign-in.`,
      provider_disabled: `${provider} sign-in is currently unavailable.`,
      not_configured: `${provider} sign-in is not configured.`,
    };
    return messages[code] || `Sign-in failed: ${code}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // Log the full error for debugging
        console.error("Sign-in error:", signInError);

        // Show user-friendly message
        setError(t("signInError"));
        return;
      }

      if (data.user) {
        // Redirect to returnUrl (validated) or sanctuary on success
        router.push(returnUrl);
        router.refresh();
      }
    } catch (err) {
      // Log unexpected errors for debugging
      console.error("Unexpected sign-in error:", err);
      setError(t("unexpectedError"));
    } finally {
      setIsLoading(false);
    }
  };

  // Open consent modal for provider
  const handleProviderClick = (provider: "facebook" | "tiktok") => {
    setError(null);
    setPendingProvider(provider);
    setConsentModalOpen(true);
  };

  // Handle OAuth after consent
  const handleConsentContinue = async (consentChecked: boolean) => {
    if (!pendingProvider) return;

    const provider = pendingProvider;
    setConsentModalOpen(false);
    setPendingProvider(null);

    // Persist OAuth context - for sign-in, still go to /onboarding per routing rule
    persistOauthContext({
      nextPath: "/onboarding",
      provider,
      consentChecked,
    });

    if (provider === "tiktok") {
      // TikTok uses custom OAuth flow
      window.location.href = "/api/auth/login/tiktok?return_to=/onboarding";
      return;
    }

    // Supabase OAuth for Facebook
    try {
      const redirectTo = getOauthCallbackUrl();
      console.log(`[SignIn] OAuth redirectTo: ${redirectTo}`);

      await supabase.auth.signInWithOAuth({
        provider: "facebook",
        options: { redirectTo },
      });
    } catch (err) {
      console.error("Facebook sign in error:", err);
      setError("Unable to sign in with Facebook. Please try again.");
    }
  };

  // Close consent modal
  const handleConsentClose = () => {
    setConsentModalOpen(false);
    setPendingProvider(null);
  };

  return (
    <Card className="border-border-subtle">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">{t("title")}</CardTitle>
        <p className="text-center text-sm text-accent-ink/60">
          {t("subtitle")}
        </p>
      </CardHeader>
      <CardContent>
        {/* OAuth error from redirect */}
        {oauthError && oauthProvider && (
          <div className="mb-4 p-3 rounded-lg bg-danger-soft/20 border border-danger-soft text-sm text-accent-ink">
            {getOAuthErrorMessage(oauthError, oauthProvider)}
            <span className="block mt-1 text-xs text-accent-ink/50">
              Error code: {oauthError}
            </span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-danger-soft/20 border border-danger-soft text-sm text-accent-ink">
            {error}
          </div>
        )}

        {/* Social sign-in options */}
        <div className="space-y-3 mb-6">
          <p className="text-center text-sm text-accent-ink/60">{t("signInWith")}</p>
          <div className="flex items-center justify-center gap-3">
            {/* Facebook */}
            <button
              type="button"
              onClick={() => handleProviderClick("facebook")}
              className="w-12 h-12 rounded-full bg-[#1877F2] hover:bg-[#166FE5] transition-colors flex items-center justify-center text-white font-semibold"
              title="Sign in with Facebook"
            >
              F
            </button>

            {/* TikTok */}
            <button
              type="button"
              onClick={() => handleProviderClick("tiktok")}
              className="w-12 h-12 rounded-full bg-black hover:bg-gray-800 transition-colors flex items-center justify-center text-white font-semibold"
              title="Sign in with TikTok"
            >
              T
            </button>

            {/* X OAuth disabled - requires X Basic tier ($100/mo)
                To re-enable: uncomment this and set X_OAUTH_ENABLED=true
            <button
              type="button"
              onClick={() => handleProviderClick("x")}
              className="w-12 h-12 rounded-full bg-black hover:bg-gray-800 transition-colors flex items-center justify-center text-white font-semibold"
              title="Sign in with X"
            >
              X
            </button>
            */}

            {/* Reddit - Stub (TODO) */}
            <button
              type="button"
              onClick={() => setError("Reddit sign-in coming soon")}
              className="w-12 h-12 rounded-full bg-[#FF4500] hover:bg-[#E63E00] transition-colors flex items-center justify-center text-white font-semibold"
              title="Sign in with Reddit (Coming Soon)"
            >
              R
            </button>
          </div>
        </div>

        <div className="my-6 flex items-center">
          <div className="flex-1 border-t border-border-subtle"></div>
          <span className="px-4 text-xs text-accent-ink/40 uppercase">
            {t("orSignInWithEmail")}
          </span>
          <div className="flex-1 border-t border-border-subtle"></div>
        </div>

        {/* Email/password form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t("password")}</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-accent-gold hover:underline"
              >
                {t("forgot")}
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            variant="gold"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? t("signingIn") : t("signInButton")}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-accent-ink/60">{t("noAccount")} </span>
          <Link href="/join" className="text-accent-gold hover:underline">
            {t("createAccount")}
          </Link>
        </div>
      </CardContent>

      {/* Social Consent Modal */}
      <SocialConsentModal
        provider={pendingProvider || "facebook"}
        isOpen={consentModalOpen}
        defaultChecked={true}
        onContinue={handleConsentContinue}
        onClose={handleConsentClose}
      />
    </Card>
  );
}

function SignInLoading() {
  const tCommon = useTranslations("common");
  return (
    <Card className="border-border-subtle">
      <CardContent className="p-12 text-center text-accent-ink/60">
        {tCommon("loading")}
      </CardContent>
    </Card>
  );
}

export default function SignInPage() {
  return (
    <div className="max-w-md mx-auto">
      <Suspense fallback={<SignInLoading />}>
        <SignInContent />
      </Suspense>
    </div>
  );
}
