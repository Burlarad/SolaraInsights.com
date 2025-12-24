"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/lib/supabase/client";
import { useSettings } from "@/providers/SettingsProvider";

function WelcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isHibernated = searchParams.get("hibernated") === "true";
  const { profile, loading: profileLoading, refreshProfile } = useSettings();
  const [method, setMethod] = useState<"social" | "email" | null>(null);

  // Email setup state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Reactivation state
  const [reactivatePassword, setReactivatePassword] = useState("");
  const [isReactivating, setIsReactivating] = useState(false);
  const [reactivateError, setReactivateError] = useState<string | null>(null);

  // Social personalization state (for each provider)
  const [facebookPersonalization, setFacebookPersonalization] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check membership status (skip if hibernated - they're here to reactivate)
  useEffect(() => {
    if (!profileLoading && profile && !isHibernated) {
      const hasActiveMembership =
        (profile.membership_plan === "individual" || profile.membership_plan === "family") &&
        (profile.subscription_status === "trialing" || profile.subscription_status === "active");

      if (!hasActiveMembership) {
        // No active membership - redirect to join
        router.push("/join");
      }
    }
  }, [profile, profileLoading, router, isHibernated]);

  const handleReactivate = async () => {
    if (!reactivatePassword) {
      setReactivateError("Please enter your password.");
      return;
    }

    setIsReactivating(true);
    setReactivateError(null);

    try {
      const response = await fetch("/api/account/reactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: reactivatePassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to reactivate account");
      }

      // Refresh profile and redirect to sanctuary
      await refreshProfile();
      router.push("/sanctuary");
    } catch (err: any) {
      setReactivateError(err.message || "Failed to reactivate account");
    } finally {
      setIsReactivating(false);
    }
  };

  const handleSocialConnect = async (provider: "facebook") => {
    setIsLoading(true);
    setError(null);

    try {
      // Store personalization preference
      if (provider === "facebook") {
        sessionStorage.setItem("facebookPersonalization", facebookPersonalization.toString());
      }

      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/onboarding`,
        },
      });
    } catch (err: any) {
      console.error("Social connect error:", err);
      setError("Unable to connect. Please try again.");
      setIsLoading(false);
    }
  };

  const handleEmailSetup = async () => {
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

    setIsLoading(true);
    setError(null);

    try {
      // Update user password
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        throw updateError;
      }

      // Redirect to onboarding
      router.push("/onboarding");
    } catch (err: any) {
      console.error("Password setup error:", err);
      setError(err.message || "Failed to set password. Please try again.");
      setIsLoading(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-accent-ink/60">Loading...</p>
      </div>
    );
  }

  // Hibernated account reactivation UI
  if (isHibernated) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-border-subtle">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              Welcome back
            </CardTitle>
            <p className="text-center text-sm text-accent-ink/60 mt-2">
              Your account is currently hibernated. Enter your password to reactivate
              and resume your subscription.
            </p>
          </CardHeader>
          <CardContent>
            {reactivateError && (
              <div className="mb-4 p-3 rounded-lg bg-danger-soft/20 border border-danger-soft text-sm text-accent-ink">
                {reactivateError}
              </div>
            )}

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="reactivatePassword">Your password</Label>
                <Input
                  id="reactivatePassword"
                  type="password"
                  placeholder="Enter your password"
                  value={reactivatePassword}
                  onChange={(e) => setReactivatePassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleReactivate()}
                />
              </div>

              <Button
                variant="gold"
                onClick={handleReactivate}
                disabled={isReactivating || !reactivatePassword}
                className="w-full"
              >
                {isReactivating ? "Reactivating..." : "Reactivate my account"}
              </Button>

              <p className="text-xs text-center text-accent-ink/50">
                Your subscription billing will resume once reactivated.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="border-border-subtle">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            Your membership is active
          </CardTitle>
          <p className="text-center text-sm text-accent-ink/60 mt-2">
            How would you like to sign in to Solara?
          </p>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-danger-soft/20 border border-danger-soft text-sm text-accent-ink">
              {error}
            </div>
          )}

          {/* Method selection (if not chosen yet) */}
          {!method && (
            <div className="space-y-6">
              {/* Social options */}
              <div className="space-y-3">
                <p className="text-center text-sm text-accent-ink/60">Connect with social</p>
                <div className="flex items-center justify-center gap-3">
                  {/* Facebook - Wired */}
                  <button
                    type="button"
                    onClick={() => setMethod("social")}
                    className="w-12 h-12 rounded-full bg-[#1877F2] hover:bg-[#166FE5] transition-colors flex items-center justify-center text-white font-semibold"
                    title="Connect with Facebook"
                  >
                    F
                  </button>

                  {/* TikTok - Connect for Social Insights */}
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = "/api/social/oauth/tiktok/connect?return_to=/welcome";
                    }}
                    className="w-12 h-12 rounded-full bg-black hover:bg-gray-800 transition-colors flex items-center justify-center text-white font-semibold"
                    title="Connect TikTok for Social Insights"
                  >
                    T
                  </button>

                  <button
                    type="button"
                    onClick={() => setError("X coming soon")}
                    className="w-12 h-12 rounded-full bg-black hover:bg-gray-800 transition-colors flex items-center justify-center text-white font-semibold"
                    title="Connect with X (Coming Soon)"
                  >
                    X
                  </button>

                  <button
                    type="button"
                    onClick={() => setError("Reddit coming soon")}
                    className="w-12 h-12 rounded-full bg-[#FF4500] hover:bg-[#E63E00] transition-colors flex items-center justify-center text-white font-semibold"
                    title="Connect with Reddit (Coming Soon)"
                  >
                    R
                  </button>
                </div>
              </div>

              <div className="flex items-center">
                <div className="flex-1 border-t border-border-subtle"></div>
                <span className="px-4 text-xs text-accent-ink/40 uppercase">or</span>
                <div className="flex-1 border-t border-border-subtle"></div>
              </div>

              {/* Email option */}
              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={() => setMethod("email")}
                  className="w-full"
                >
                  Set an email + password
                </Button>
              </div>
            </div>
          )}

          {/* Social method - Facebook personalization */}
          {method === "social" && (
            <div className="space-y-6">
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => handleSocialConnect("facebook")}
                  disabled={isLoading}
                  className="w-16 h-16 rounded-full bg-[#1877F2] hover:bg-[#166FE5] transition-colors flex items-center justify-center text-white font-semibold text-xl mx-auto disabled:opacity-50"
                  title="Connect with Facebook"
                >
                  F
                </button>
                <p className="mt-3 text-sm font-medium">Connect with Facebook</p>
              </div>

              <div className="flex items-center space-x-2 p-3 bg-accent-muted/20 rounded-lg">
                <Checkbox
                  id="facebook-personalization"
                  checked={facebookPersonalization}
                  onCheckedChange={(checked) => setFacebookPersonalization(checked === true)}
                />
                <label
                  htmlFor="facebook-personalization"
                  className="text-sm text-accent-ink/80 cursor-pointer"
                >
                  Use Facebook to improve my experience
                </label>
              </div>

              <Button
                variant="gold"
                onClick={() => handleSocialConnect("facebook")}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Connecting..." : "Continue with Facebook"}
              </Button>

              <div className="text-center">
                <button
                  onClick={() => setMethod(null)}
                  className="text-sm text-accent-ink/60 hover:text-accent-ink"
                >
                  ← Choose different method
                </button>
              </div>
            </div>
          )}

          {/* Email method - password setup */}
          {method === "email" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="password">Set your password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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
                  required
                />
              </div>

              <Button
                variant="gold"
                onClick={handleEmailSetup}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Setting up..." : "Continue to onboarding"}
              </Button>

              <div className="text-center">
                <button
                  onClick={() => setMethod(null)}
                  className="text-sm text-accent-ink/60 hover:text-accent-ink"
                >
                  ← Choose different method
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-accent-ink/60">Loading...</p>
        </div>
      }
    >
      <WelcomeContent />
    </Suspense>
  );
}
