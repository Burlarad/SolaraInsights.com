"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/providers/SettingsProvider";
import { PlacePicker, PlaceSelection } from "@/components/shared/PlacePicker";
import { hasActiveMembership } from "@/lib/membership/status";
import {
  hasCheckoutSessionCookie,
  getCheckoutSessionId,
  clearCheckoutSessionCookie,
} from "@/lib/auth/socialConsent";

export default function OnboardingPage() {
  const router = useRouter();
  const { profile, loading: profileLoading, saveProfile, refreshProfile } = useSettings();

  // Form state - split name fields
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nickname, setNickname] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");

  // Location state - pre-resolved from PlacePicker
  const [birthPlace, setBirthPlace] = useState<PlaceSelection | null>(null);
  const [birthPlaceDisplay, setBirthPlaceDisplay] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Payment waiting state (for webhook race condition)
  const [isWaitingForPayment, setIsWaitingForPayment] = useState(false);
  const [paymentTimedOut, setPaymentTimedOut] = useState(false);
  const [claimAttempted, setClaimAttempted] = useState(false);

  // Try claiming checkout session immediately on mount (fallback if callback claim failed)
  useEffect(() => {
    const tryClaimSession = async () => {
      const sessionId = getCheckoutSessionId();
      if (!sessionId || claimAttempted) return;

      setClaimAttempted(true);
      console.log("[Onboarding] Attempting to claim checkout session:", sessionId.slice(0, 10) + "...");

      try {
        const res = await fetch("/api/stripe/claim-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });

        const result = await res.json();
        console.log("[Onboarding] Claim result:", result);

        if (result.success && result.claimed) {
          // Session claimed successfully - refresh profile to get updated membership
          clearCheckoutSessionCookie();
          if (refreshProfile) {
            await refreshProfile();
          }
        }
      } catch (err) {
        console.error("[Onboarding] Claim attempt failed:", err);
        // Will fall back to polling
      }
    };

    tryClaimSession();
  }, [claimAttempted, refreshProfile]);

  // Initialize form with existing profile data
  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || "");
      setMiddleName(profile.middle_name || "");
      setLastName(profile.last_name || "");
      setNickname(profile.preferred_name || "");
      setBirthDate(profile.birth_date || "");
      setBirthTime(profile.birth_time || "");

      // Restore birth place if we have complete location data
      if (profile.birth_city && profile.birth_lat && profile.birth_lon && profile.timezone) {
        const displayParts = [
          profile.birth_city,
          profile.birth_region,
          profile.birth_country,
        ].filter(Boolean);
        setBirthPlaceDisplay(displayParts.join(", "));
        setBirthPlace({
          birth_city: profile.birth_city,
          birth_region: profile.birth_region || "",
          birth_country: profile.birth_country || "",
          birth_lat: profile.birth_lat,
          birth_lon: profile.birth_lon,
          timezone: profile.timezone,
        });
      }

      // If user hasn't started onboarding yet, mark as started
      if (!profile.onboarding_started_at) {
        saveProfile({ onboarding_started_at: new Date().toISOString() } as any);
      }
    }
  }, [profile]);

  // Check membership and onboarding status
  useEffect(() => {
    if (!profileLoading && profile) {
      // Already onboarded - redirect to sanctuary
      if (profile.is_onboarded) {
        router.push("/sanctuary");
        return;
      }

      // Check if user has active membership
      if (hasActiveMembership(profile)) {
        // Clear checkout cookie since membership is now active
        clearCheckoutSessionCookie();
        setIsWaitingForPayment(false);
        return; // Proceed with onboarding form
      }

      // No active membership - check if we should wait for webhook
      if (hasCheckoutSessionCookie()) {
        // User just came from checkout - wait for webhook to process
        setIsWaitingForPayment(true);
      } else if (!isWaitingForPayment) {
        // No checkout session and not already waiting - redirect to join
        router.push("/join");
      }
    }
  }, [profile, profileLoading, router, isWaitingForPayment]);

  // Poll for membership activation while waiting for payment
  useEffect(() => {
    if (!isWaitingForPayment || paymentTimedOut) return;

    const startTime = Date.now();
    const maxWaitTime = 30000; // 30 seconds
    const pollInterval = 2000; // 2 seconds

    const pollForMembership = async () => {
      const elapsed = Date.now() - startTime;

      if (elapsed >= maxWaitTime) {
        // Timeout - redirect to join with message
        setPaymentTimedOut(true);
        setIsWaitingForPayment(false);
        clearCheckoutSessionCookie();
        router.push("/join?error=payment_pending");
        return;
      }

      // Refresh profile to check for membership
      if (refreshProfile) {
        await refreshProfile();
      }
    };

    const timer = setInterval(pollForMembership, pollInterval);

    return () => clearInterval(timer);
  }, [isWaitingForPayment, paymentTimedOut, refreshProfile, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validate required fields - first and last name required for onboarding
      if (!firstName.trim()) {
        throw new Error("First name is required");
      }

      if (!lastName.trim()) {
        throw new Error("Last name is required");
      }

      if (!birthDate) {
        throw new Error("Birth date is required");
      }

      if (!birthPlace) {
        throw new Error("Please select your birth location from the search results");
      }

      // Save profile with split name fields - server will compose full_name
      // Save profile - first_name, middle_name, last_name are used for numerology calculations
      await saveProfile({
        first_name: firstName.trim(),
        middle_name: middleName.trim() || null,
        last_name: lastName.trim(),
        preferred_name: nickname.trim() || null,
        birth_date: birthDate,
        birth_time: birthTime || null,
        // Pre-resolved location from PlacePicker
        birth_city: birthPlace.birth_city,
        birth_region: birthPlace.birth_region,
        birth_country: birthPlace.birth_country,
        birth_lat: birthPlace.birth_lat,
        birth_lon: birthPlace.birth_lon,
        timezone: birthPlace.timezone,
        is_onboarded: true,
        onboarding_completed_at: new Date().toISOString(),
      } as any);

      // All users go to sanctuary after onboarding
      // Social connect is now handled via Settings or Sanctuary modal
      router.push("/sanctuary");
    } catch (err: any) {
      console.error("Onboarding error:", err);
      setError(err.message || "Failed to save profile. Please try again.");
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

  // Show waiting UI while polling for membership activation
  if (isWaitingForPayment) {
    return (
      <div className="max-w-md mx-auto">
        <Card className="border-border-subtle">
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              Confirming your payment...
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full border-4 border-accent-gold/30 border-t-accent-gold animate-spin" />
              <p className="text-center text-accent-ink/60">
                We're confirming your subscription. This usually takes just a few seconds.
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
            Complete your Sanctuary profile
          </CardTitle>
          <p className="text-center text-sm text-accent-ink/60 mt-2">
            We'll use this information to generate your personalized insights
          </p>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-danger-soft/20 border border-danger-soft text-sm text-accent-ink">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">
                  First name <span className="text-danger-soft">*</span>
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Jane"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="middleName">Middle name</Label>
                <Input
                  id="middleName"
                  type="text"
                  placeholder="Optional"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">
                  Last name <span className="text-danger-soft">*</span>
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Nickname */}
            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname (optional)</Label>
              <Input
                id="nickname"
                type="text"
                placeholder="What should we call you?"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
              <p className="text-xs text-accent-ink/60">
                If different from your first name
              </p>
            </div>

            {/* Birth Date */}
            <div className="space-y-2">
              <Label htmlFor="birthDate">
                Birth Date <span className="text-danger-soft">*</span>
              </Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                required
              />
            </div>

            {/* Birth Time */}
            <div className="space-y-2">
              <Label htmlFor="birthTime">Time of Birth (optional)</Label>
              <Input
                id="birthTime"
                type="time"
                value={birthTime}
                onChange={(e) => setBirthTime(e.target.value)}
              />
              <p className="text-xs text-accent-ink/60">
                If you don't know your exact birth time, you can skip now and add it later
                for more accurate charts and personalization.
              </p>
            </div>

            {/* Birth Location */}
            <div className="space-y-2">
              <Label>
                Place of Birth <span className="text-danger-soft">*</span>
              </Label>
              <PlacePicker
                initialValue={birthPlaceDisplay}
                placeholder="Search for your birth city..."
                onSelect={(place) => {
                  setBirthPlace(place);
                  const displayParts = [
                    place.birth_city,
                    place.birth_region,
                    place.birth_country,
                  ].filter(Boolean);
                  setBirthPlaceDisplay(displayParts.join(", "));
                }}
                onClear={() => {
                  setBirthPlace(null);
                  setBirthPlaceDisplay("");
                }}
              />
              {birthPlace && (
                <p className="text-xs text-accent-ink/60">
                  Timezone: {birthPlace.timezone}
                </p>
              )}
              <p className="text-xs text-accent-ink/60">
                Start typing to search, then select from the results
              </p>
            </div>

            {/* Submit Button */}
            <div className="pt-4 space-y-3">
              {!birthPlace && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                  Please search and select your birth location from the dropdown to continue.
                </div>
              )}
              <Button
                type="submit"
                variant="gold"
                className="w-full"
                disabled={isLoading || !birthPlace}
              >
                {isLoading ? "Saving your birth signature..." : "Complete setup"}
              </Button>
            </div>

            <div className="text-center text-xs text-accent-ink/60">
              <p>
                You can always update these details later in Settings
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
