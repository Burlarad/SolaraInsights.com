"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { getOauthCallbackUrl } from "@/lib/url/base";
import { SocialConsentModal } from "@/components/auth/SocialConsentModal";
import { persistOauthContext, setCheckoutSessionCookie } from "@/lib/auth/socialConsent";

/**
 * WelcomeContent - Client Component for Account Registration
 *
 * Purpose: First-time user registration after Stripe checkout
 *
 * Flow:
 * - OAuth: Click provider → OAuth → auto-enable social insights → /onboarding
 * - Email: Enter email → verify → /set-password → /onboarding
 *
 * Props:
 * - initialSessionId: session_id from server-side searchParams (Safari-safe)
 */

interface WelcomeContentProps {
  initialSessionId: string;
}

export function WelcomeContent({ initialSessionId }: WelcomeContentProps) {
  const router = useRouter();

  // Auth state
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  // sessionId is initialized from server-provided props (Safari-safe)
  // "" means no session_id was provided
  const [sessionId] = useState(initialSessionId);

  // Email flow state
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [stripeEmail, setStripeEmail] = useState<string | null>(null);
  const [stripeEmailLoading, setStripeEmailLoading] = useState(false);

  // Verification state
  const [verificationSent, setVerificationSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resend state
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Consent modal state
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<"facebook" | "tiktok" | null>(null);

  // Check if user already has a session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setHasSession(!!user);
      } catch {
        setHasSession(false);
      } finally {
        setSessionLoading(false);
      }
    };
    checkSession();
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (hasSession === true) {
      router.replace("/sanctuary");
    }
  }, [hasSession, router]);

  // Redirect if no session_id (didn't come from Stripe)
  useEffect(() => {
    if (sessionId === "" && !sessionLoading && hasSession === false) {
      router.replace("/join");
    }
  }, [sessionLoading, hasSession, sessionId, router]);

  // Fetch email from Stripe session
  useEffect(() => {
    if (sessionId && sessionId.startsWith("cs_")) {
      setStripeEmailLoading(true);
      fetch(`/api/stripe/session-info?session_id=${encodeURIComponent(sessionId)}`)
        .then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            setStripeEmail(data.email);
            setEmail(data.email);
          }
        })
        .catch(() => {})
        .finally(() => setStripeEmailLoading(false));
    }
  }, [sessionId]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

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

    // Persist OAuth context (destination, consent, checkout session)
    persistOauthContext({
      nextPath: "/onboarding",
      provider,
      consentChecked,
      checkoutSessionId: sessionId || undefined,
    });

    if (provider === "tiktok") {
      // TikTok uses custom OAuth flow - pass consent via cookie (already set by persistOauthContext)
      window.location.href = "/api/auth/login/tiktok?return_to=/onboarding";
      return;
    }

    // Supabase OAuth for Facebook
    const redirectTo = getOauthCallbackUrl();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });
  };

  // Close consent modal
  const handleConsentClose = () => {
    setConsentModalOpen(false);
    setPendingProvider(null);
  };

  // Handle email verification request
  const handleSendVerification = async () => {
    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }

    if (!sessionId) {
      setError("Missing checkout session");
      return;
    }

    // Set checkout session cookie BEFORE sending verification email
    // This ensures the session can be claimed after email verification
    setCheckoutSessionCookie(sessionId);

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/complete-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          session_id: sessionId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send verification email");
      }

      setVerificationSent(true);
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle resend
  const handleResend = useCallback(async () => {
    if (!email || !sessionId || resendCooldown > 0) return;

    setIsResending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/resend-signup-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), session_id: sessionId }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          setResendCooldown(data.retryAfterSeconds || 60);
        }
        throw new Error(data.error || "Failed to resend");
      }

      setResendCooldown(60);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsResending(false);
    }
  }, [email, sessionId, resendCooldown]);

  // Loading state - wait for session check to complete
  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-accent-ink/60">Loading...</p>
      </div>
    );
  }

  // Verification sent - show check email UI
  if (verificationSent) {
    return (
      <div className="max-w-md mx-auto">
        <Card className="border-border-subtle">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Check your email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-accent-gold/20 flex items-center justify-center mb-4">
                <span className="text-3xl">📧</span>
              </div>
              <p className="text-accent-ink/80">
                We sent a verification link to <strong>{email}</strong>
              </p>
              <p className="text-sm text-accent-ink/60 mt-2">
                Click the link to verify your email and set your password.
              </p>
            </div>

            {error && (
              <p className="text-sm text-danger-soft text-center">{error}</p>
            )}

            <div className="space-y-3">
              <Button
                variant="outline"
                onClick={handleResend}
                disabled={isResending || resendCooldown > 0}
                className="w-full"
              >
                {isResending
                  ? "Sending..."
                  : resendCooldown > 0
                  ? `Resend email (${resendCooldown}s)`
                  : "Resend email"}
              </Button>

              <p className="text-xs text-accent-ink/50 text-center">
                Didn&apos;t receive it? Check your spam folder.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main registration UI
  return (
    <div className="max-w-md mx-auto">
      <Card className="border-border-subtle">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Create your account</CardTitle>
          <p className="text-center text-sm text-accent-ink/60 mt-2">
            Choose how you&apos;d like to sign in to Solara
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-danger-soft/20 border border-danger-soft text-sm text-accent-ink">
              {error}
            </div>
          )}

          {/* OAuth Buttons - Prominent */}
          <div className="space-y-3">
            <p className="text-center text-sm text-accent-ink/60">Register with</p>
            <div className="flex justify-center gap-3">
              {/* Facebook */}
              <button
                type="button"
                onClick={() => handleProviderClick("facebook")}
                className="w-12 h-12 rounded-full bg-[#1877F2] hover:bg-[#166FE5] transition-colors flex items-center justify-center text-white font-semibold"
                title="Continue with Facebook"
              >
                F
              </button>

              {/* TikTok */}
              <button
                type="button"
                onClick={() => handleProviderClick("tiktok")}
                className="w-12 h-12 rounded-full bg-black hover:bg-gray-800 transition-colors flex items-center justify-center text-white font-semibold"
                title="Continue with TikTok"
              >
                T
              </button>

              {/* Reddit - Coming Soon */}
              <button
                type="button"
                onClick={() => setError("Reddit coming soon")}
                className="w-12 h-12 rounded-full bg-[#FF4500] hover:bg-[#E63E00] transition-colors flex items-center justify-center text-white font-semibold opacity-50"
                title="Reddit (Coming Soon)"
              >
                R
              </button>

              {/* X - Coming Soon */}
              <button
                type="button"
                onClick={() => setError("X coming soon")}
                className="w-12 h-12 rounded-full bg-black hover:bg-gray-800 transition-colors flex items-center justify-center text-white font-semibold opacity-50"
                title="X (Coming Soon)"
              >
                X
              </button>
            </div>
          </div>

          <div className="flex items-center">
            <div className="flex-1 border-t border-border-subtle"></div>
            <span className="px-4 text-xs text-accent-ink/40 uppercase">or</span>
            <div className="flex-1 border-t border-border-subtle"></div>
          </div>

          {/* Email + Password Option */}
          {!showEmailForm ? (
            <Button
              variant="outline"
              onClick={() => setShowEmailForm(true)}
              className="w-full"
            >
              Continue with Email
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={stripeEmailLoading}
                />
                {stripeEmailLoading && (
                  <p className="text-xs text-accent-ink/50">Loading...</p>
                )}
                {stripeEmail && email === stripeEmail && (
                  <p className="text-xs text-accent-gold">From your checkout</p>
                )}
              </div>

              <Button
                variant="gold"
                onClick={handleSendVerification}
                disabled={isSubmitting || !email.trim()}
                className="w-full"
              >
                {isSubmitting ? "Sending..." : "Send verification email"}
              </Button>

              <button
                type="button"
                onClick={() => setShowEmailForm(false)}
                className="w-full text-sm text-accent-ink/60 hover:text-accent-ink"
              >
                ← Back to options
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Social Consent Modal */}
      <SocialConsentModal
        provider={pendingProvider || "facebook"}
        isOpen={consentModalOpen}
        defaultChecked={true}
        onContinue={handleConsentContinue}
        onClose={handleConsentClose}
      />
    </div>
  );
}
