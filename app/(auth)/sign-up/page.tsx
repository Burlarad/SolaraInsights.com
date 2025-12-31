"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { setupOauthSession } from "@/lib/auth/oauthSession";
import { getOauthCallbackUrl } from "@/lib/url/base";

export default function SignUpPage() {
  const router = useRouter();
  const t = useTranslations("auth.signUp");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t("passwordsDontMatch"));
      return;
    }

    if (password.length < 8) {
      setError(t("passwordTooShort"));
      return;
    }

    setIsLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (data.user) {
        // On success, redirect to join to select a plan
        router.push("/join");
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      console.error("Sign up error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFacebookSignUp = async () => {
    try {
      // Set up OAuth session state using shared helper
      setupOauthSession("/join", "auto_connect:facebook");

      // Get callback URL using shared helper
      const redirectTo = getOauthCallbackUrl();
      console.log(`[SignUp] OAuth redirectTo: ${redirectTo}`);

      await supabase.auth.signInWithOAuth({
        provider: "facebook",
        options: {
          redirectTo,
        },
      });
    } catch (err) {
      console.error("Facebook sign up error:", err);
      setError("Unable to sign up with Facebook. Please try again.");
    }
  };

  return (
    <div className="max-w-md mx-auto">
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
            <Label htmlFor="name">{t("fullName")}</Label>
            <Input
              id="name"
              type="text"
              placeholder={t("namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

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
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              type="password"
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
            <Input
              id="confirmPassword"
              type="password"
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
            {isLoading ? t("creatingAccount") : t("createAccountButton")}
          </Button>

          <p className="text-xs text-center text-accent-ink/60 leading-relaxed">
            {t("terms")}
          </p>
        </form>

        <div className="my-6 flex items-center">
          <div className="flex-1 border-t border-border-subtle"></div>
          <span className="px-4 text-xs text-accent-ink/40 uppercase">{t("or")}</span>
          <div className="flex-1 border-t border-border-subtle"></div>
        </div>

        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleFacebookSignUp}
          >
            {t("continueWithFacebook")}
          </Button>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              window.location.href = "/api/auth/login/tiktok?return_to=/join";
            }}
          >
            {t("continueWithTikTok")}
          </Button>
        </div>

        <div className="mt-6 text-center text-sm">
          <span className="text-accent-ink/60">{t("hasAccount")} </span>
          <Link href="/sign-in" className="text-accent-gold hover:underline">
            {t("signIn")}
          </Link>
        </div>
      </CardContent>
    </Card>
    </div>
  );
}
