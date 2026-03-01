"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/providers/SettingsProvider";
import { PlacePicker, PlaceSelection } from "@/components/shared/PlacePicker";
import {
  getCheckoutSessionId,
  clearCheckoutSessionCookie,
} from "@/lib/auth/socialConsent";
import { useTranslations } from "next-intl";

export default function OnboardingPage() {
  const router = useRouter();
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");
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

  // Session claim state (compat shim for users arriving via Stripe checkout)
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
  }, [profile, saveProfile]);

  // Redirect already-onboarded users straight to the sanctuary
  useEffect(() => {
    if (!profileLoading && profile?.is_onboarded) {
      router.push("/sanctuary");
    }
  }, [profile, profileLoading, router]);

  // Phase 2: Payment gate removed. All authenticated users proceed through
  // onboarding regardless of membership status. Paid users arriving via
  // /welcome already have their membership set before reaching this page.

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validate required fields - first and last name required for onboarding
      if (!firstName.trim()) {
        throw new Error(t("errors.firstNameRequired"));
      }

      if (!lastName.trim()) {
        throw new Error(t("errors.lastNameRequired"));
      }

      if (!birthDate) {
        throw new Error(t("errors.birthDateRequired"));
      }

      if (!birthPlace) {
        throw new Error(t("errors.locationRequired"));
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
      setError(err.message || t("errors.saveFailed"));
      setIsLoading(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-accent-ink/60">{tCommon("loading")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="border-border-subtle">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            {t("pageTitle")}
          </CardTitle>
          <p className="text-center text-sm text-accent-ink/60 mt-2">
            {t("pageSubtitle")}
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
                  {t("firstName")} <span className="text-danger-soft">*</span>
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
                <Label htmlFor="middleName">{t("middleName")}</Label>
                <Input
                  id="middleName"
                  type="text"
                  placeholder={tCommon("optional")}
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">
                  {t("lastName")} <span className="text-danger-soft">*</span>
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
              <Label htmlFor="nickname">{t("nickname")}</Label>
              <Input
                id="nickname"
                type="text"
                placeholder={t("nicknamePlaceholder")}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
              <p className="text-xs text-accent-ink/60">
                {t("nicknameHint")}
              </p>
            </div>

            {/* Birth Date */}
            <div className="space-y-2">
              <Label htmlFor="birthDate">
                {t("birthDate")} <span className="text-danger-soft">*</span>
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
              <Label htmlFor="birthTime">{t("birthTime")}</Label>
              <Input
                id="birthTime"
                type="time"
                value={birthTime}
                onChange={(e) => setBirthTime(e.target.value)}
              />
              <p className="text-xs text-accent-ink/60">
                {t("birthTimeHint")}
              </p>
            </div>

            {/* Birth Location */}
            <div className="space-y-2">
              <Label>
                {t("birthPlace")} <span className="text-danger-soft">*</span>
              </Label>
              <PlacePicker
                initialValue={birthPlaceDisplay}
                placeholder={t("searchPlace")}
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
                  {t("timezone", { timezone: birthPlace.timezone })}
                </p>
              )}
              <p className="text-xs text-accent-ink/60">
                {t("locationHint")}
              </p>
            </div>

            {/* Submit Button */}
            <div className="pt-4 space-y-3">
              {!birthPlace && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                  {t("locationWarning")}
                </div>
              )}
              <Button
                type="submit"
                variant="gold"
                className="w-full"
                disabled={isLoading || !birthPlace}
              >
                {isLoading ? t("saving") : t("complete")}
              </Button>
            </div>

            <div className="text-center text-xs text-accent-ink/60">
              <p>
                {t("settingsNote")}
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
