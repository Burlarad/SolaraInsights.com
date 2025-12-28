"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Use our custom API that sends via Resend with branded template
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Password reset error:", data.error);
        setError(data.error || "Unable to send reset link. Please try again.");
        return;
      }

      // Always show success (don't reveal if email exists)
      setIsSubmitted(true);
    } catch (err) {
      console.error("Unexpected password reset error:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="max-w-md mx-auto">
      <Card className="border-border-subtle">
        <CardHeader className="space-y-1">
          <div className="text-center mb-4">
            <span className="text-5xl">✉️</span>
          </div>
          <CardTitle className="text-2xl text-center">Check your email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-accent-ink/70 leading-relaxed">
            We&apos;ve sent a password reset link to <strong>{email}</strong>.
            Click the link in the email to create a new password.
          </p>

          <div className="text-center text-sm">
            <Link href="/sign-in" className="text-accent-gold hover:underline">
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
    <Card className="border-border-subtle">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Reset your password</CardTitle>
        <p className="text-center text-sm text-accent-ink/60">
          Enter your email and we&apos;ll send you a reset link
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

          <Button
            type="submit"
            variant="gold"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? "Sending..." : "Send reset link"}
          </Button>
        </form>

        <div className="mt-6 text-center text-sm">
          <Link href="/sign-in" className="text-accent-gold hover:underline">
            Back to sign in
          </Link>
        </div>
      </CardContent>
    </Card>
    </div>
  );
}
