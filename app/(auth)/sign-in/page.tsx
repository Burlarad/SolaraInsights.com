"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

export default function SignInPage() {
  const router = useRouter();
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
        // Redirect to sanctuary on success
        router.push("/sanctuary");
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
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/sanctuary`,
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
          Enter your email to access your sanctuary
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

        <div className="my-6 flex items-center">
          <div className="flex-1 border-t border-border-subtle"></div>
          <span className="px-4 text-xs text-accent-ink/40 uppercase">or</span>
          <div className="flex-1 border-t border-border-subtle"></div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleFacebookSignIn}
        >
          Continue with Facebook
        </Button>

        <div className="mt-6 text-center text-sm">
          <span className="text-accent-ink/60">Don&apos;t have an account? </span>
          <Link href="/sign-up" className="text-accent-gold hover:underline">
            Sign up
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
