"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        // Log the full error for debugging
        console.error("Password update error:", updateError);

        // Show user-friendly message
        setError(
          "We couldn't update your password. The link may have expired. Please try requesting a new reset email."
        );
        return;
      }

      if (data.user) {
        // Success!
        setIsSuccess(true);

        // Redirect to sign-in after 3 seconds
        setTimeout(() => {
          router.push("/sign-in");
        }, 3000);
      }
    } catch (err) {
      // Log unexpected errors for debugging
      console.error("Unexpected password update error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <Card className="border-border-subtle">
        <CardHeader className="space-y-1">
          <div className="text-center mb-4">
            <span className="text-5xl">✓</span>
          </div>
          <CardTitle className="text-2xl text-center">Password updated</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-accent-ink/70 leading-relaxed">
            Your password has been updated successfully. You can now sign in with your new password.
          </p>

          <div className="text-center">
            <Button
              variant="gold"
              className="w-full"
              onClick={() => router.push("/sign-in")}
            >
              Continue to sign in
            </Button>
          </div>

          <p className="text-center text-sm text-accent-ink/50">
            You will be redirected automatically in a few seconds...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border-subtle">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Set new password</CardTitle>
        <p className="text-center text-sm text-accent-ink/60">
          Enter your new password below
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
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Re-enter your password"
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
            {isLoading ? "Updating password..." : "Update password"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link href="/sign-in" className="text-accent-gold hover:underline">
            Back to sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
