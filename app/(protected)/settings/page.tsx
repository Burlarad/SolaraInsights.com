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

export default function SettingsPage() {
  const { profile, saveProfile, loading: profileLoading, error: profileError } = useSettings();

  // Local form state
  const [fullName, setFullName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [zodiacSign, setZodiacSign] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [unknownBirthTime, setUnknownBirthTime] = useState(false);
  const [birthCity, setBirthCity] = useState("");
  const [birthRegion, setBirthRegion] = useState("");
  const [birthCountry, setBirthCountry] = useState("");
  const [timezone, setTimezone] = useState("");

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
      setBirthCity(profile.birth_city || "");
      setBirthRegion(profile.birth_region || "");
      setBirthCountry(profile.birth_country || "");
      setTimezone(profile.timezone || "");
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

    try {
      await saveProfile({
        full_name: fullName,
        preferred_name: preferredName,
        zodiac_sign: zodiacSign,
        birth_date: birthDate || null,
        birth_time: unknownBirthTime ? null : birthTime || null,
        birth_city: birthCity || null,
        birth_region: birthRegion || null,
        birth_country: birthCountry || null,
        timezone: timezone || "UTC",
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError("Unable to save changes. Please try again.");
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
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-2">Tune your birth signature</h1>
        <p className="text-accent-ink/60">
          Update your preferred name, sign, and natal coordinates
        </p>
      </div>

      <Card>
        <CardContent className="p-8 space-y-12">
          {/* Identity */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold text-accent-gold">Identity</h2>

            <div className="grid md:grid-cols-2 gap-4">
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
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
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
          <section className="space-y-4 pt-8 border-t border-border-subtle">
            <h2 className="text-2xl font-semibold text-accent-gold">
              Change password
            </h2>

            <div className="space-y-4 max-w-md">
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

              <Button variant="gold" onClick={handleChangePassword}>
                Change password
              </Button>

              <p className="text-xs text-accent-ink/60">
                After changing your password, you&apos;ll be signed out and need to sign
                in again.
              </p>
            </div>
          </section>

          {/* Birth Details */}
          <section className="space-y-4 pt-8 border-t border-border-subtle">
            <h2 className="text-2xl font-semibold text-accent-gold">
              Birth details
            </h2>
            <p className="text-sm text-accent-ink/60">
              Your exact birth information allows for the most precise insights
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birthDate">Birth date</Label>
                <Input
                  id="birthDate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
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
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="unknownBirthTime"
                    checked={unknownBirthTime}
                    onChange={(e) => setUnknownBirthTime(e.target.checked)}
                    className="rounded"
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
              <Label htmlFor="birthCity">Birth city</Label>
              <Input
                id="birthCity"
                value={birthCity}
                onChange={(e) => setBirthCity(e.target.value)}
                placeholder="City where you were born"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birthRegion">Region / State</Label>
                <Input
                  id="birthRegion"
                  value={birthRegion}
                  onChange={(e) => setBirthRegion(e.target.value)}
                  placeholder="e.g., California"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthCountry">Country</Label>
                <Input
                  id="birthCountry"
                  value={birthCountry}
                  onChange={(e) => setBirthCountry(e.target.value)}
                  placeholder="e.g., United States"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Time zone</Label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a timezone</option>
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
              <p className="text-xs text-accent-ink/60">
                The timezone where you were born (used for accurate birth chart calculations)
              </p>
            </div>
          </section>

          {/* Social Insights / Social Personalization */}
          <section className="space-y-4 pt-8 border-t border-border-subtle">
            <h2 className="text-2xl font-semibold text-accent-gold">
              Social Insights
            </h2>
            <p className="text-sm text-accent-ink/60 leading-relaxed">
              Social insights can use your connected accounts to improve personalization
              in your Sanctuary. If you choose, Solara can gently read patterns from your
              connected social accounts to better understand your emotional tone and daily
              rhythms. We will never post for you.
            </p>

            <div className="space-y-4">
              {/* Facebook connection */}
              <Card className="border-border-subtle">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1877F2] flex items-center justify-center text-white font-semibold">
                        F
                      </div>
                      <div>
                        <p className="text-sm font-medium">Facebook</p>
                        {facebookIdentity ? (
                          <p className="text-xs text-accent-ink/60">
                            Connected as {getIdentityDisplayName(facebookIdentity)}
                          </p>
                        ) : (
                          <p className="text-xs text-accent-ink/60">Not connected</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleConnectFacebook}
                    >
                      {facebookIdentity ? "Reconnect" : "Connect"}
                    </Button>
                  </div>

                  {facebookIdentity && (
                    <div className="flex items-center justify-between pl-13">
                      <span className="text-sm text-accent-ink/80">
                        Use to improve experience
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-accent-ink/60">ON</span>
                        {/* TODO: Wire this to actual preference in profile */}
                        <div className="w-10 h-6 bg-accent-gold rounded-full flex items-center px-1">
                          <div className="w-4 h-4 bg-white rounded-full ml-auto"></div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Placeholder for other social providers */}
              <Card className="border-border-subtle opacity-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white font-semibold">
                        T
                      </div>
                      <div>
                        <p className="text-sm font-medium">TikTok</p>
                        <p className="text-xs text-accent-ink/60">Coming soon</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" disabled>
                      Coming Soon
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border-subtle opacity-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white font-semibold">
                        X
                      </div>
                      <div>
                        <p className="text-sm font-medium">X (Twitter)</p>
                        <p className="text-xs text-accent-ink/60">Coming soon</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" disabled>
                      Coming Soon
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border-subtle opacity-50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#FF4500] flex items-center justify-center text-white font-semibold">
                        R
                      </div>
                      <div>
                        <p className="text-sm font-medium">Reddit</p>
                        <p className="text-xs text-accent-ink/60">Coming soon</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" disabled>
                      Coming Soon
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <p className="text-xs text-accent-ink/50 leading-relaxed">
                Social insights are optional and help us better understand your unique
                patterns. You can disconnect anytime.
              </p>
            </div>
          </section>

          {/* Privacy & Data */}
          <section className="space-y-4 pt-8 border-t border-border-subtle">
            <h2 className="text-2xl font-semibold text-accent-gold">
              Privacy & data
            </h2>
            <p className="text-sm text-accent-ink/60">
              Your reflections are private and never shared. Manage your journal entries below.
            </p>
          </section>

          {/* Account State */}
          <section className="space-y-6 pt-8 border-t border-border-subtle">
            <h2 className="text-2xl font-semibold text-accent-gold">
              Account state
            </h2>

            <div className="space-y-3">
              <h3 className="text-lg font-medium">Hibernate account</h3>
              <p className="text-sm text-accent-ink/60">
                Pause your subscription while keeping your data safe. You can reactivate
                anytime.
              </p>
              <Button variant="outline">Hibernate account</Button>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-medium">Delete account</h3>
              <p className="text-sm text-accent-ink/60">
                Permanently delete your account and all associated data. This action
                cannot be undone.
              </p>
              <Button variant="destructive">Delete account</Button>
            </div>
          </section>

          {/* Notifications */}
          <section className="space-y-4 pt-8 border-t border-border-subtle">
            <h2 className="text-2xl font-semibold text-accent-gold">
              Notifications & preferences
            </h2>

            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <input
                    type="checkbox"
                    id="emailNotifications"
                    checked={emailNotifications}
                    onChange={(e) => setEmailNotifications(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="emailNotifications" className="text-sm font-medium">
                    Email notifications
                  </label>
                </div>
                <p className="text-xs text-accent-ink/60 ml-6">
                  Account and billing notices only. No horoscope content.
                </p>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-1">
                  <input
                    type="checkbox"
                    id="pushNotifications"
                    checked={pushNotifications}
                    onChange={(e) => setPushNotifications(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="pushNotifications" className="text-sm font-medium">
                    Push notifications
                  </label>
                </div>
                <p className="text-xs text-accent-ink/60 ml-6">
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
        <CardContent className="p-8">
          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-1">Journal</h2>
              <p className="text-sm text-accent-ink/60">
                Export or manage your private reflections
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-2">Export journal (.MD)</p>
                <p className="text-xs text-accent-ink/60 mb-3">
                  Download all your journal entries as a markdown file.
                </p>
                <Button variant="outline" onClick={handleExportJournal} size="sm">
                  Export journal
                </Button>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Delete journal</p>
                <p className="text-xs text-accent-ink/60 mb-3">
                  Permanently delete all journal entries. This cannot be undone.
                </p>
                <Button
                  variant="outline"
                  onClick={handleDeleteJournal}
                  size="sm"
                  className="text-danger-soft border-danger-soft hover:bg-danger-soft/10"
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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <Button
              variant="gold"
              onClick={handleSaveChanges}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reset
            </Button>
          </div>
        </div>

        {/* Success/Error messages */}
        {saveSuccess && (
          <p className="text-sm text-accent-gold text-center">
            ✓ Details updated.
          </p>
        )}
        {saveError && (
          <p className="text-sm text-danger-soft text-center">{saveError}</p>
        )}

        <p className="text-xs text-center text-accent-ink/60 leading-relaxed max-w-2xl mx-auto">
          Changes settle softly—return anytime to tune your details at your own rhythm.
        </p>
      </div>
    </div>
  );
}
