"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/providers/SettingsProvider";
import { supabase } from "@/lib/supabase/client";
import { getPrimaryFacebookIdentity, getIdentityDisplayName } from "@/lib/social";
import { User } from "@supabase/supabase-js";
import { COMMON_TIMEZONES } from "@/lib/timezone";
import { PlacePicker, PlaceSelection } from "@/components/shared/PlacePicker";

export default function SettingsPage() {
  const { profile, saveProfile, loading: profileLoading, error: profileError } = useSettings();

  // Local form state
  const [fullName, setFullName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [zodiacSign, setZodiacSign] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [unknownBirthTime, setUnknownBirthTime] = useState(false);

  // Location state - pre-resolved from PlacePicker
  const [birthPlace, setBirthPlace] = useState<PlaceSelection | null>(null);
  const [birthPlaceDisplay, setBirthPlaceDisplay] = useState("");
  const [displayTimezone, setDisplayTimezone] = useState("");

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Journal state
  const [journalMessage, setJournalMessage] = useState<string | null>(null);

  // Social connections state
  const [user, setUser] = useState<User | null>(null);
  const [facebookIdentity, setFacebookIdentity] = useState<any | null>(null);

  // Load profile data into form fields
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPreferredName(profile.preferred_name || "");
      setZodiacSign(profile.zodiac_sign || "");
      setBirthDate(profile.birth_date || "");
      setBirthTime(profile.birth_time || "");
      setUnknownBirthTime(!profile.birth_time);
      setDisplayTimezone(profile.timezone || "");

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
      } else if (profile.birth_city) {
        // Have city but no resolved coordinates - show as display but mark as unresolved
        const displayParts = [
          profile.birth_city,
          profile.birth_region,
          profile.birth_country,
        ].filter(Boolean);
        setBirthPlaceDisplay(displayParts.join(", "));
        // birthPlace stays null - user needs to re-select from PlacePicker
      }
    }
  }, [profile]);

  // Load user and check for Facebook connection
  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        const fbIdentity = getPrimaryFacebookIdentity(user);
        setFacebookIdentity(fbIdentity);
      }
    };
    loadUser();
  }, []);

  const handleSaveChanges = async () => {
    if (!profile) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    // Validate required fields for Soul Path
    const missingFields: string[] = [];
    if (!birthDate) missingFields.push("Birth date");
    if (!birthPlace) missingFields.push("Birth location (please search and select from results)");

    if (missingFields.length > 0) {
      setSaveError(
        `Please fill in the following required fields: ${missingFields.join(", ")}`
      );
      setIsSaving(false);
      return;
    }

    try {
      // Build update payload with pre-resolved location data
      const updatePayload: Record<string, any> = {
        full_name: fullName,
        preferred_name: preferredName,
        zodiac_sign: zodiacSign,
        birth_date: birthDate,
        birth_time: unknownBirthTime ? null : birthTime || null,
        // Pre-resolved location from PlacePicker
        birth_city: birthPlace!.birth_city,
        birth_region: birthPlace!.birth_region,
        birth_country: birthPlace!.birth_country,
        birth_lat: birthPlace!.birth_lat,
        birth_lon: birthPlace!.birth_lon,
        timezone: birthPlace!.timezone,
      };

      await saveProfile(updatePayload);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      // Show the API error message if available
      const errorMessage = err?.message || "Unable to save changes. Please try again.";
      setSaveError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = () => {
    // TODO: Implement password change via Supabase
    console.log("Password change not yet implemented");
  };

  const handleExportJournal = async () => {
    try {
      const response = await fetch("/api/journal/export");

      if (!response.ok) {
        throw new Error("Failed to export journal");
      }

      // Convert response to blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "solara-journal.md";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setJournalMessage("Journal exported successfully.");
      setTimeout(() => setJournalMessage(null), 3000);
    } catch (err: any) {
      console.error("Error exporting journal:", err);
      setJournalMessage("Failed to export journal.");
      setTimeout(() => setJournalMessage(null), 3000);
    }
  };

  const handleDeleteJournal = async () => {
    const confirmed = confirm(
      "Are you sure you want to delete all journal entries? This action cannot be undone."
    );

    if (!confirmed) return;

    try {
      const response = await fetch("/api/journal/delete", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete journal");
      }

      setJournalMessage("Journal cleared.");
      setTimeout(() => setJournalMessage(null), 3000);
    } catch (err: any) {
      console.error("Error deleting journal:", err);
      setJournalMessage("Failed to delete journal.");
      setTimeout(() => setJournalMessage(null), 3000);
    }
  };

  const handleConnectFacebook = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: "facebook",
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/settings`,
        },
      });
    } catch (err) {
      console.error("Facebook connection error:", err);
      alert("Unable to connect Facebook. Please try again.");
    }
  };

  if (profileLoading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Card>
          <CardContent className="p-12 text-center text-accent-ink/60">
            Loading your details...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Card>
          <CardContent className="p-12 text-center space-y-4">
            <p className="text-accent-ink/70">
              We had trouble loading your profile. Please try again, or contact support if this continues.
            </p>
            {profileError && <p className="text-sm text-danger-soft">{profileError}</p>}
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-8 md:space-y-10">
      <div className="text-center mb-6 md:mb-8">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Tune your birth signature</h1>
        <p className="text-sm md:text-base text-accent-ink/60">
          Update your preferred name, sign, and natal coordinates
        </p>
      </div>

      <Card>
        <CardContent className="p-5 sm:p-6 md:p-8 space-y-8 md:space-y-10">
          {/* Identity */}
          <section className="space-y-5">
            <h2 className="text-lg md:text-xl font-semibold text-accent-gold">Identity</h2>

            <div className="grid md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preferredName">Preferred name</Label>
                <Input
                  id="preferredName"
                  value={preferredName}
                  onChange={(e) => setPreferredName(e.target.value)}
                  placeholder="What should we call you?"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={profile.email} disabled />
              <p className="text-xs text-accent-ink/60">
                Contact support to change your email address
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="zodiacSign">Zodiac sign</Label>
              <select
                id="zodiacSign"
                value={zodiacSign}
                onChange={(e) => setZodiacSign(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-base"
              >
                <option value="">Select a sign</option>
                <option value="Aries">Aries</option>
                <option value="Taurus">Taurus</option>
                <option value="Gemini">Gemini</option>
                <option value="Cancer">Cancer</option>
                <option value="Leo">Leo</option>
                <option value="Virgo">Virgo</option>
                <option value="Libra">Libra</option>
                <option value="Scorpio">Scorpio</option>
                <option value="Sagittarius">Sagittarius</option>
                <option value="Capricorn">Capricorn</option>
                <option value="Aquarius">Aquarius</option>
                <option value="Pisces">Pisces</option>
              </select>
              <p className="text-xs text-accent-ink/60">
                Auto-calculated from birth date when saved
              </p>
            </div>
          </section>

          {/* Change Password */}
          <section className="space-y-5 pt-6 border-t border-border-subtle/60">
            <h2 className="text-lg md:text-xl font-semibold text-accent-gold">
              Change password
            </h2>

            <div className="space-y-5 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <Button variant="gold" onClick={handleChangePassword} className="min-h-[44px]">
                Change password
              </Button>

              <p className="text-xs md:text-sm text-accent-ink/60 leading-relaxed">
                After changing your password, you&apos;ll be signed out and need to sign
                in again.
              </p>
            </div>
          </section>

          {/* Birth Details */}
          <section className="space-y-5 pt-6 border-t border-border-subtle/60">
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-accent-gold">
                Birth details
              </h2>
              <p className="text-sm md:text-base text-accent-ink/60 mt-1">
                Your exact birth information allows for the most precise insights
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="birthDate">
                  Birth date <span className="text-danger-soft">*</span>
                </Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthTime">Birth time (24-hour format)</Label>
                <Input
                  id="birthTime"
                  type="time"
                  value={birthTime}
                  onChange={(e) => setBirthTime(e.target.value)}
                  disabled={unknownBirthTime}
                />
                <div className="flex items-center gap-3 min-h-[44px]">
                  <input
                    type="checkbox"
                    id="unknownBirthTime"
                    checked={unknownBirthTime}
                    onChange={(e) => setUnknownBirthTime(e.target.checked)}
                    className="rounded w-5 h-5"
                  />
                  <label
                    htmlFor="unknownBirthTime"
                    className="text-sm text-accent-ink/70"
                  >
                    I don&apos;t know my birth time
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Birth location <span className="text-danger-soft">*</span>
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
                  setDisplayTimezone(place.timezone);
                }}
                onClear={() => {
                  setBirthPlace(null);
                  setBirthPlaceDisplay("");
                  setDisplayTimezone("");
                }}
              />
              <p className="text-xs md:text-sm text-accent-ink/60 leading-relaxed">
                Start typing to search, then select from the results
              </p>
              {!birthPlace && birthPlaceDisplay && (
                <p className="text-xs text-amber-600">
                  Please re-select your birth location from the search results to update coordinates
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Time zone</Label>
              <Input
                value={displayTimezone || "Not set"}
                disabled
                className="bg-gray-50"
              />
              <p className="text-xs md:text-sm text-accent-ink/60 leading-relaxed">
                Timezone is automatically determined from your birthplace and cannot be changed manually.
              </p>
            </div>
          </section>

          {/* Social Insights / Social Personalization */}
          <section className="space-y-5 pt-6 border-t border-border-subtle/60">
            <div>
              <h2 className="text-lg md:text-xl font-semibold text-accent-gold">
                Social Insights
              </h2>
              <p className="text-sm md:text-base text-accent-ink/60 leading-relaxed mt-1">
                Social insights can use your connected accounts to improve personalization
                in your Sanctuary. If you choose, Solara can gently read patterns from your
                connected social accounts to better understand your emotional tone and daily
                rhythms. We will never post for you.
              </p>
            </div>

            <div className="space-y-4">
              {/* Facebook connection */}
              <Card className="border-border-subtle">
                <CardContent className="p-4 sm:p-5">
                  {/* Mobile: Stack layout | Desktop: Row layout */}
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-[#1877F2] flex items-center justify-center text-white font-semibold flex-shrink-0">
                        F
                      </div>
                      <div>
                        <p className="text-sm md:text-base font-medium">Facebook</p>
                        {facebookIdentity ? (
                          <p className="text-xs md:text-sm text-accent-ink/60">
                            Connected as {getIdentityDisplayName(facebookIdentity)}
                          </p>
                        ) : (
                          <p className="text-xs md:text-sm text-accent-ink/60">Not connected</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleConnectFacebook}
                      className="w-full sm:w-auto min-h-[44px]"
                    >
                      {facebookIdentity ? "Reconnect" : "Connect"}
                    </Button>
                  </div>

                  {facebookIdentity && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-border-subtle/60">
                      <span className="text-sm text-accent-ink/80">
                        Use to improve experience
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-accent-ink/60">ON</span>
                        {/* TODO: Wire this to actual preference in profile */}
                        <div className="w-11 h-7 bg-accent-gold rounded-full flex items-center px-1">
                          <div className="w-5 h-5 bg-white rounded-full ml-auto"></div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Placeholder for other social providers */}
              <Card className="border-border-subtle opacity-50">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-black flex items-center justify-center text-white font-semibold flex-shrink-0">
                        T
                      </div>
                      <div>
                        <p className="text-sm md:text-base font-medium">TikTok</p>
                        <p className="text-xs md:text-sm text-accent-ink/60">Coming soon</p>
                      </div>
                    </div>
                    <Button variant="outline" disabled className="w-full sm:w-auto min-h-[44px]">
                      Coming Soon
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border-subtle opacity-50">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-black flex items-center justify-center text-white font-semibold flex-shrink-0">
                        X
                      </div>
                      <div>
                        <p className="text-sm md:text-base font-medium">X (Twitter)</p>
                        <p className="text-xs md:text-sm text-accent-ink/60">Coming soon</p>
                      </div>
                    </div>
                    <Button variant="outline" disabled className="w-full sm:w-auto min-h-[44px]">
                      Coming Soon
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border-subtle opacity-50">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-[#FF4500] flex items-center justify-center text-white font-semibold flex-shrink-0">
                        R
                      </div>
                      <div>
                        <p className="text-sm md:text-base font-medium">Reddit</p>
                        <p className="text-xs md:text-sm text-accent-ink/60">Coming soon</p>
                      </div>
                    </div>
                    <Button variant="outline" disabled className="w-full sm:w-auto min-h-[44px]">
                      Coming Soon
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <p className="text-xs md:text-sm text-accent-ink/50 leading-relaxed">
                Social insights are optional and help us better understand your unique
                patterns. You can disconnect anytime.
              </p>
            </div>
          </section>

          {/* Privacy & Data */}
          <section className="space-y-3 pt-6 border-t border-border-subtle/60">
            <h2 className="text-lg md:text-xl font-semibold text-accent-gold">
              Privacy & data
            </h2>
            <p className="text-sm md:text-base text-accent-ink/60 leading-relaxed">
              Your reflections are private and never shared. Manage your journal entries below.
            </p>
          </section>

          {/* Account State */}
          <section className="space-y-6 pt-6 border-t border-border-subtle/60">
            <h2 className="text-lg md:text-xl font-semibold text-accent-gold">
              Account state
            </h2>

            <div className="space-y-4">
              <h3 className="text-base md:text-lg font-medium">Hibernate account</h3>
              <p className="text-sm md:text-base text-accent-ink/60 leading-relaxed">
                Pause your subscription while keeping your data safe. You can reactivate
                anytime.
              </p>
              <Button variant="outline" className="w-full sm:w-auto min-h-[44px]">
                Hibernate account
              </Button>
            </div>

            <div className="space-y-4">
              <h3 className="text-base md:text-lg font-medium">Delete account</h3>
              <p className="text-sm md:text-base text-accent-ink/60 leading-relaxed">
                Permanently delete your account and all associated data. This action
                cannot be undone.
              </p>
              <Button variant="destructive" className="w-full sm:w-auto min-h-[44px]">
                Delete account
              </Button>
            </div>
          </section>

          {/* Notifications */}
          <section className="space-y-5 pt-6 border-t border-border-subtle/60">
            <h2 className="text-lg md:text-xl font-semibold text-accent-gold">
              Notifications & preferences
            </h2>

            <div className="space-y-5">
              <div className="min-h-[44px] flex flex-col justify-center">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="emailNotifications"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="rounded w-5 h-5"
                  />
                  <label htmlFor="emailNotifications" className="text-sm md:text-base font-medium">
                    Email notifications
                  </label>
                </div>
                <p className="text-xs md:text-sm text-accent-ink/60 ml-8 mt-1">
                  Account and billing notices only. No horoscope content.
                </p>
              </div>

              <div className="min-h-[44px] flex flex-col justify-center">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="pushNotifications"
                    checked={pushNotifications}
                    onChange={(e) => setPushNotifications(e.target.checked)}
                    className="rounded w-5 h-5"
                  />
                  <label htmlFor="pushNotifications" className="text-sm md:text-base font-medium">
                    Push notifications
                  </label>
                </div>
                <p className="text-xs md:text-sm text-accent-ink/60 ml-8 mt-1 leading-relaxed">
                  Gentle morning reminder between 7:55–8:15 AM local time. Requires
                  device registration.
                </p>
              </div>
            </div>
          </section>
        </CardContent>
      </Card>

      {/* Journal section */}
      <Card>
        <CardContent className="p-5 sm:p-6 md:p-8">
          <section className="space-y-6">
            <div>
              <h2 className="text-lg md:text-xl font-semibold mb-1">Journal</h2>
              <p className="text-sm md:text-base text-accent-ink/60">
                Export or manage your private reflections
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-sm md:text-base font-medium">Export journal (.MD)</p>
                <p className="text-xs md:text-sm text-accent-ink/60 leading-relaxed">
                  Download all your journal entries as a markdown file.
                </p>
                <Button variant="outline" onClick={handleExportJournal} className="w-full sm:w-auto min-h-[44px]">
                  Export journal
                </Button>
              </div>

              <div className="space-y-3 pt-4 border-t border-border-subtle/60">
                <p className="text-sm md:text-base font-medium">Delete journal</p>
                <p className="text-xs md:text-sm text-accent-ink/60 leading-relaxed">
                  Permanently delete all journal entries. This cannot be undone.
                </p>
                <Button
                  variant="outline"
                  onClick={handleDeleteJournal}
                  className="w-full sm:w-auto min-h-[44px] text-danger-soft border-danger-soft hover:bg-danger-soft/10"
                >
                  Delete all entries
                </Button>
              </div>

              {journalMessage && (
                <p className="text-sm text-accent-gold">✓ {journalMessage}</p>
              )}
            </div>
          </section>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="space-y-5">
        {/* Warning if place not selected */}
        {!birthPlace && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
            Select a birth location from the dropdown to save your changes.
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="gold"
            onClick={handleSaveChanges}
            disabled={isSaving || !birthPlace}
            className="w-full sm:w-auto min-h-[48px] text-base"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto min-h-[48px]"
          >
            Reset
          </Button>
        </div>

        {/* Success/Error messages */}
        {saveSuccess && (
          <p className="text-sm md:text-base text-accent-gold text-center">
            ✓ Details updated.
          </p>
        )}
        {saveError && (
          <p className="text-sm md:text-base text-danger-soft text-center">{saveError}</p>
        )}

        <p className="text-xs md:text-sm text-center text-accent-ink/60 leading-relaxed max-w-2xl mx-auto">
          Changes settle softly—return anytime to tune your details at your own rhythm.
        </p>
      </div>
    </div>
  );
}
