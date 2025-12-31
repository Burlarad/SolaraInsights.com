"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

function ResetPasswordContent() {
  const t = useTranslations("auth.resetPassword");
  const router = useRouter();
  const searchParams = useSearchParams();

  // State for code exchange
  const [isExchangingCode, setIsExchangingCode] = useState(true);
  const [codeExchangeError, setCodeExchangeError] = useState<string | null>(null);
  const [hasValidSession, setHasValidSession] = useState(false);

  // State for password update
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle PKCE code exchange on mount
  useEffect(() => {
    const exchangeCode = async () => {
      try {
        // Check for code in URL (PKCE flow)
        const code = searchParams.get("code");

        if (code) {
          console.log("[ResetPassword] Found code parameter, exchanging for session...");

          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            console.error("[ResetPassword] Code exchange failed:", exchangeError.message);
            setCodeExchangeError(
              "This reset link has expired or is invalid. Please request a new one."
            );
            setIsExchangingCode(false);
            return;
          }

          if (data.session) {
            console.log("[ResetPassword] Session established successfully");
            setHasValidSession(true);
          }
        } else {
          // No code - check if we already have a recovery session
          const { data: { session } } = await supabase.auth.getSession();

          if (session) {
            console.log("[ResetPassword] Existing session found");
            setHasValidSession(true);
          } else {
            console.log("[ResetPassword] No code and no session");
            setCodeExchangeError(
              "No reset link detected. Please request a password reset from the login page."
            );
          }
        }
      } catch (err) {
        console.error("[ResetPassword] Unexpected error during code exchange:", err);
        setCodeExchangeError("An unexpected error occurred. Please try again.");
      } finally {
        setIsExchangingCode(false);
      }
    };

    exchangeCode();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Client-side validation
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      setIsLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match. Please try again.");
      setIsLoading(false);
      return;
    }

    try {
      // Update the user's password using the recovery session
      // Also set has_password metadata flag to ensure hasPasswordCredential() returns true
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
        data: { has_password: true },
      });

      if (updateError) {
        console.error("[ResetPassword] Password update error:", updateError.message);
        setError(
          "We couldn't update your password. The link may have expired. Please request a new reset email."
        );
        return;
      }

      if (data.user) {
        console.log("[ResetPassword] Password updated successfully");
        setIsSuccess(true);

        // Sign out and redirect to sign-in after 3 seconds
        await supabase.auth.signOut();
        setTimeout(() => {
          router.push("/sign-in");
        }, 3000);
      }
    } catch (err) {
      console.error("[ResetPassword] Unexpected password update error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state while exchanging code
  if (isExchangingCode) {
    return (
      <Card className="border-border-subtle">
        <CardContent className="py-16">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-accent-gold mb-4" />
            <p className="text-accent-ink/60">{t("verifying")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state - invalid/expired link
  if (codeExchangeError) {
    return (
      <Card className="border-border-subtle">
        <CardHeader className="space-y-1">
          <div className="text-center mb-4">
            <span className="text-5xl">⚠️</span>
          </div>
          <CardTitle className="text-2xl text-center">{t("linkExpired.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-accent-ink/70 leading-relaxed">
            {t("linkExpired.message")}
          </p>

          <div className="flex flex-col gap-3">
            <Button
              variant="gold"
              className="w-full"
              onClick={() => router.push("/forgot-password")}
            >
              {t("linkExpired.requestNewLink")}
            </Button>
            <Link
              href="/sign-in"
              className="text-center text-sm text-accent-gold hover:underline"
            >
              {t("backToSignIn")}
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <Card className="border-border-subtle">
        <CardHeader className="space-y-1">
          <div className="text-center mb-4">
            <span className="text-5xl">✓</span>
          </div>
          <CardTitle className="text-2xl text-center">{t("success.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-accent-ink/70 leading-relaxed">
            {t("success.message")}
          </p>

          <div className="text-center">
            <Button
              variant="gold"
              className="w-full"
              onClick={() => router.push("/sign-in")}
            >
              {t("success.continueToSignIn")}
            </Button>
          </div>

          <p className="text-center text-sm text-accent-ink/50">
            {t("success.redirecting")}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Password reset form (only shown if we have a valid session)
  if (!hasValidSession) {
    return (
      <Card className="border-border-subtle">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">{t("sessionRequired.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-accent-ink/70">
            {t("sessionRequired.message")}
          </p>
          <Button
            variant="gold"
            className="w-full"
            onClick={() => router.push("/forgot-password")}
          >
            {t("sessionRequired.requestResetLink")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border-subtle">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">{t("title")}</CardTitle>
        <p className="text-center text-sm text-accent-ink/60">
          {t("subtitle")}
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-danger-soft/20 border border-danger-soft text-sm text-accent-ink">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="newPassword">{t("newPassword")}</Label>
            <Input
              id="newPassword"
              type="password"
              placeholder={t("newPasswordPlaceholder")}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder={t("confirmPasswordPlaceholder")}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            variant="gold"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? t("updating") : t("updatePassword")}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link href="/sign-in" className="text-accent-gold hover:underline">
            {t("backToSignIn")}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

// Loading fallback for Suspense
function ResetPasswordLoading() {
  return (
    <Card className="border-border-subtle">
      <CardContent className="py-16">
        <div className="flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent-gold mb-4" />
          <p className="text-accent-ink/60">Loading...</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Default export wrapped in Suspense for useSearchParams
export default function ResetPasswordPage() {
  return (
    <div className="max-w-md mx-auto">
      <Suspense fallback={<ResetPasswordLoading />}>
        <ResetPasswordContent />
      </Suspense>
    </div>
  );
}
