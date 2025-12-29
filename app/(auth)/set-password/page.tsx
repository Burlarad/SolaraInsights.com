"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

/**
 * /set-password - Password Setup Page
 *
 * Purpose: Set password after email verification
 *
 * Flow:
 * - User clicks email verification link
 * - Lands here with active session (email verified)
 * - Sets their password
 * - Redirects to /onboarding
 *
 * Edge cases:
 * - No session → redirect to /sign-in
 * - Already has password set → redirect to /onboarding
 */

function SetPasswordContent() {
  const router = useRouter();

  // Auth state
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for existing session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          // No session - redirect to sign in
          router.push("/sign-in");
          return;
        }

        setUser(user);
      } catch {
        router.push("/sign-in");
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, [router]);

  const handleSetPassword = async () => {
    // Validate
    if (!password || !confirmPassword) {
      setError("Please enter and confirm your password");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Update user password AND set has_password metadata flag
      // The metadata flag ensures hasPasswordCredential() returns true
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { has_password: true },
      });

      if (updateError) {
        throw updateError;
      }

      // Success - redirect to onboarding
      router.push("/onboarding");
    } catch (err: any) {
      console.error("Set password error:", err);
      setError(err.message || "Failed to set password. Please try again.");
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-accent-ink/60">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <Card className="border-border-subtle">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Set your password</CardTitle>
          <p className="text-center text-sm text-accent-ink/60 mt-2">
            Create a password for your Solara account
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {user?.email && (
            <div className="text-center p-3 bg-accent-gold/10 rounded-lg">
              <p className="text-sm text-accent-ink/80">
                Setting password for <strong>{user.email}</strong>
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-danger-soft/20 border border-danger-soft text-sm text-accent-ink">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSetPassword()}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSetPassword()}
              />
            </div>

            <Button
              variant="gold"
              onClick={handleSetPassword}
              disabled={isSubmitting || !password || !confirmPassword}
              className="w-full"
            >
              {isSubmitting ? "Setting password..." : "Continue to onboarding"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-accent-ink/60">Loading...</p>
        </div>
      }
    >
      <SetPasswordContent />
    </Suspense>
  );
}
