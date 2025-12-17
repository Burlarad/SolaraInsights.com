"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/providers/SettingsProvider";
import { PlacePicker, PlaceSelection } from "@/components/shared/PlacePicker";

export default function OnboardingPage() {
  const router = useRouter();
  const { profile, loading: profileLoading, saveProfile } = useSettings();

  // Form state
  const [fullName, setFullName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");

  // Location state - pre-resolved from PlacePicker
  const [birthPlace, setBirthPlace] = useState<PlaceSelection | null>(null);
  const [birthPlaceDisplay, setBirthPlaceDisplay] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form with existing profile data
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPreferredName(profile.preferred_name || "");
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
      const hasActiveMembership =
        (profile.membership_plan === "individual" || profile.membership_plan === "family") &&
        (profile.subscription_status === "trialing" || profile.subscription_status === "active");

      if (!hasActiveMembership) {
        // No active membership - redirect to join
        router.push("/join");
        return;
      }

      if (profile.is_onboarded) {
        // Already onboarded - redirect to sanctuary
        router.push("/sanctuary");
      }
    }
  }, [profile, profileLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!fullName.trim()) {
        throw new Error("Full name is required");
      }

      if (!birthDate) {
        throw new Error("Birth date is required");
      }

      if (!birthPlace) {
        throw new Error("Please select your birth location from the search results");
      }

      // Save profile with pre-resolved location data
      await saveProfile({
        full_name: fullName.trim(),
        preferred_name: preferredName.trim() || null,
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

      // Determine next step based on auth method
      // If user has no OAuth providers connected, show social-connect page
      // Otherwise, go straight to sanctuary
      const hasEmailOnly = profile?.email && !profile?.full_name?.includes("facebook");

      if (hasEmailOnly) {
        // Email-only user - offer optional social connect
        router.push("/connect-social");
      } else {
        // Social user or skip social connect - go to sanctuary
        router.push("/sanctuary");
      }
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
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName">
                Full Name <span className="text-danger-soft">*</span>
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            {/* Preferred Name */}
            <div className="space-y-2">
              <Label htmlFor="preferredName">Preferred Name (optional)</Label>
              <Input
                id="preferredName"
                type="text"
                placeholder="What should we call you?"
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
              />
              <p className="text-xs text-accent-ink/60">
                If different from your full name
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
