"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

/**
 * Validate returnUrl for open redirect protection.
 * Only allows relative paths starting with "/" that don't redirect to external domains.
 */
function isValidReturnUrl(url: string | null): url is string {
  if (!url) return false;
  // Must start with "/" and not start with "//" (protocol-relative URL)
  if (!url.startsWith("/") || url.startsWith("//")) return false;
  // Must not contain protocol indicators
  if (url.toLowerCase().includes("http:") || url.toLowerCase().includes("https:")) return false;
  // Must not contain encoded slashes that could bypass checks
  if (url.includes("%2f") || url.includes("%2F")) return false;
  return true;
}

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get returnUrl from query params with security validation
  const returnUrlParam = searchParams.get("returnUrl");
  const returnUrl = isValidReturnUrl(returnUrlParam) ? returnUrlParam : "/sanctuary";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setError(
          "We couldn't sign you in with those details. Please check your email and password, or reset your password."
        );
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
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFacebookSignIn = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: "facebook",
        options: {
          // Use validated returnUrl for OAuth redirect
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}${returnUrl}`,
        },
      });
    } catch (err) {
      console.error("Facebook sign in error:", err);
      setError("Unable to sign in with Facebook. Please try again.");
    }
  };

  return (
    <Card className="border-border-subtle">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Welcome back</CardTitle>
        <p className="text-center text-sm text-accent-ink/60">
          Sign in to access your sanctuary
        </p>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-danger-soft/20 border border-danger-soft text-sm text-accent-ink">
            {error}
          </div>
        )}

        {/* Social sign-in options */}
        <div className="space-y-3 mb-6">
          <p className="text-center text-sm text-accent-ink/60">Sign in with</p>
          <div className="flex items-center justify-center gap-3">
            {/* Facebook - Wired */}
            <button
              type="button"
              onClick={handleFacebookSignIn}
              className="w-12 h-12 rounded-full bg-[#1877F2] hover:bg-[#166FE5] transition-colors flex items-center justify-center text-white font-semibold"
              title="Sign in with Facebook"
            >
              F
            </button>

            {/* TikTok - Connect for Social Insights */}
            <button
              type="button"
              onClick={() => {
                window.location.href = "/api/social/oauth/tiktok/connect?return_to=/sign-in";
              }}
              className="w-12 h-12 rounded-full bg-black hover:bg-gray-800 transition-colors flex items-center justify-center text-white font-semibold"
              title="Connect TikTok for Social Insights"
            >
              T
            </button>

            {/* X/Twitter - Stub (TODO) */}
            <button
              type="button"
              onClick={() => setError("X sign-in coming soon")}
              className="w-12 h-12 rounded-full bg-black hover:bg-gray-800 transition-colors flex items-center justify-center text-white font-semibold"
              title="Sign in with X (Coming Soon)"
            >
              X
            </button>

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
            Or sign in with email
          </span>
          <div className="flex-1 border-t border-border-subtle"></div>
        </div>

        {/* Email/password form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-accent-gold hover:underline"
              >
                Forgot?
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
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-accent-ink/60">Don&apos;t have an account? </span>
          <Link href="/join" className="text-accent-gold hover:underline">
            Create account
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <Card className="border-border-subtle">
          <CardContent className="p-12 text-center text-accent-ink/60">
            Loading...
          </CardContent>
        </Card>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
