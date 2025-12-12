"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { useSettings } from "@/providers/SettingsProvider";

export default function JoinPage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useSettings();
  const [selectedPlan, setSelectedPlan] = useState<"individual" | "family">("individual");
  const [signupMethod, setSignupMethod] = useState<"social" | "email" | null>(null);

  // Email signup state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user already has active membership
  useEffect(() => {
    if (!profileLoading && profile) {
      const hasActiveMembership =
        (profile.membership_plan === "individual" || profile.membership_plan === "family") &&
        (profile.subscription_status === "trialing" || profile.subscription_status === "active");

      if (hasActiveMembership) {
        // Already has membership - redirect
        router.push("/sanctuary");
      }
    }
  }, [profile, profileLoading, router]);

  const handleCheckout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Call Stripe checkout API
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: selectedPlan,
          email: email || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create checkout session");
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      setError(err.message || "Failed to start checkout. Please try again.");
      setIsLoading(false);
    }
  };

  const handleSocialSignup = async (provider: "facebook") => {
    setIsLoading(true);
    setError(null);

    try {
      // For social signup, we'll store the selected plan in session storage
      // and retrieve it after OAuth redirect
      sessionStorage.setItem("selectedPlan", selectedPlan);

      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/welcome`,
        },
      });
    } catch (err: any) {
      console.error("Social signup error:", err);
      setError("Unable to sign up with social. Please try again.");
      setIsLoading(false);
    }
  };

  const handleEmailSignup = () => {
    if (!fullName.trim() || !email.trim()) {
      setError("Please enter your name and email");
      return;
    }

    // For email signup, go straight to checkout
    handleCheckout();
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-accent-ink/60">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Plan Selection */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-serif text-accent-ink">Choose your plan</h1>
        <p className="text-accent-ink/70">
          All plans include a 7-day free trial. Cancel anytime.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Individual Plan */}
        <Card
          className={`border-2 cursor-pointer transition-all ${
            selectedPlan === "individual"
              ? "border-accent-gold bg-accent-gold/5"
              : "border-border-subtle hover:border-accent-gold/50"
          }`}
          onClick={() => setSelectedPlan("individual")}
        >
          <CardHeader>
            <CardTitle className="text-xl">Individual</CardTitle>
            <p className="text-sm text-accent-ink/70">For one person</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-accent-ink/80">
                • Full access to your Sanctuary
              </p>
              <p className="text-sm text-accent-ink/80">
                • Daily, weekly, monthly & yearly insights
              </p>
              <p className="text-sm text-accent-ink/80">
                • Complete Soul Path analysis
              </p>
              <p className="text-sm text-accent-ink/80">
                • Relationship insights
              </p>
              <p className="text-sm text-accent-ink/80">
                • Journal with prompts
              </p>
            </div>
            <div className="pt-4 border-t border-border-subtle">
              <p className="text-xs text-accent-gold font-semibold">
                Includes a 7-day free trial
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Family Plan */}
        <Card
          className={`border-2 cursor-pointer transition-all ${
            selectedPlan === "family"
              ? "border-accent-gold bg-accent-gold/5"
              : "border-border-subtle hover:border-accent-gold/50"
          }`}
          onClick={() => setSelectedPlan("family")}
        >
          <CardHeader>
            <CardTitle className="text-xl">Family</CardTitle>
            <p className="text-sm text-accent-ink/70">For you + your family (5 seats)</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-accent-ink/80">
                • Everything in Individual
              </p>
              <p className="text-sm text-accent-ink/80">
                • Up to 5 family member profiles
              </p>
              <p className="text-sm text-accent-ink/80">
                • Shared connection insights
              </p>
              <p className="text-sm text-accent-ink/80">
                • Family dashboard (coming soon)
              </p>
            </div>
            <div className="pt-4 border-t border-border-subtle">
              <p className="text-xs text-accent-gold font-semibold">
                Includes a 7-day free trial
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Identity Selection */}
      <Card className="border-border-subtle">
        <CardHeader>
          <CardTitle className="text-xl text-center">How would you like to sign up?</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-danger-soft/20 border border-danger-soft text-sm text-accent-ink">
              {error}
            </div>
          )}

          {/* Social Signup */}
          {(!signupMethod || signupMethod === "social") && (
            <div className="space-y-3 mb-6">
              <p className="text-center text-sm text-accent-ink/60">Sign up with</p>
              <div className="flex items-center justify-center gap-3">
                {/* Facebook - Wired */}
                <button
                  type="button"
                  onClick={() => handleSocialSignup("facebook")}
                  disabled={isLoading}
                  className="w-12 h-12 rounded-full bg-[#1877F2] hover:bg-[#166FE5] transition-colors flex items-center justify-center text-white font-semibold disabled:opacity-50"
                  title="Sign up with Facebook"
                >
                  F
                </button>

                {/* TikTok - Stub (TODO) */}
                <button
                  type="button"
                  onClick={() => setError("TikTok sign-up coming soon")}
                  className="w-12 h-12 rounded-full bg-black hover:bg-gray-800 transition-colors flex items-center justify-center text-white font-semibold"
                  title="Sign up with TikTok (Coming Soon)"
                >
                  T
                </button>

                {/* X/Twitter - Stub (TODO) */}
                <button
                  type="button"
                  onClick={() => setError("X sign-up coming soon")}
                  className="w-12 h-12 rounded-full bg-black hover:bg-gray-800 transition-colors flex items-center justify-center text-white font-semibold"
                  title="Sign up with X (Coming Soon)"
                >
                  X
                </button>

                {/* Reddit - Stub (TODO) */}
                <button
                  type="button"
                  onClick={() => setError("Reddit sign-up coming soon")}
                  className="w-12 h-12 rounded-full bg-[#FF4500] hover:bg-[#E63E00] transition-colors flex items-center justify-center text-white font-semibold"
                  title="Sign up with Reddit (Coming Soon)"
                >
                  R
                </button>
              </div>
            </div>
          )}

          {signupMethod !== "social" && (
            <>
              <div className="my-6 flex items-center">
                <div className="flex-1 border-t border-border-subtle"></div>
                <span className="px-4 text-xs text-accent-ink/40 uppercase">
                  Or sign up with email
                </span>
                <div className="flex-1 border-t border-border-subtle"></div>
              </div>

              {/* Email Signup Form */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Jane Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

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
                  type="button"
                  variant="gold"
                  className="w-full"
                  onClick={handleEmailSignup}
                  disabled={isLoading}
                >
                  {isLoading ? "Processing..." : "Continue to payment"}
                </Button>
              </div>
            </>
          )}

          {signupMethod === null && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setSignupMethod("email")}
                className="text-sm text-accent-gold hover:underline"
              >
                Use email instead
              </button>
            </div>
          )}

          <div className="mt-6 text-center text-xs text-accent-ink/60">
            <p>
              A portion of your subscription supports families through the Solara Foundation
            </p>
          </div>

          <div className="mt-4 text-center text-sm">
            <span className="text-accent-ink/60">Already have an account? </span>
            <Link href="/sign-in" className="text-accent-gold hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
