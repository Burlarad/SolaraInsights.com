"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSettings } from "@/providers/SettingsProvider";
import { PlacePicker, PlaceSelection } from "@/components/shared/PlacePicker";
import { SocialProvider } from "@/types";
import { supabase } from "@/lib/supabase/client";
import { hasPasswordCredential, getPrimaryOAuthProvider } from "@/lib/auth/helpers";

// Social provider configuration for display
const SOCIAL_PROVIDERS: {
  id: SocialProvider;
  name: string;
  color: string;
  letter: string;
  enabled: boolean;
}[] = [
  { id: "facebook", name: "Facebook", color: "#1877F2", letter: "F", enabled: true },
  { id: "instagram", name: "Instagram", color: "#E4405F", letter: "I", enabled: false },
  { id: "tiktok", name: "TikTok", color: "#000000", letter: "T", enabled: true },
  { id: "x", name: "X (Twitter)", color: "#000000", letter: "X", enabled: false },
  { id: "reddit", name: "Reddit", color: "#FF4500", letter: "R", enabled: false },
];

// Social connection status from /api/social/status
interface SocialConnectionStatus {
  provider: SocialProvider;
  status: "connected" | "disconnected" | "needs_reauth";
  expiresAt: string | null;
  needsReauth: boolean;
  hasSummary: boolean;
  isConfigured: boolean;
}

export default function SettingsPage() {
  const { profile, saveProfile, refreshProfile, loading: profileLoading, error: profileError } = useSettings();
  const searchParams = useSearchParams();

  // Auth type state
  const [userHasPassword, setUserHasPassword] = useState(true); // Default to true until loaded
  const [primaryOAuthProvider, setPrimaryOAuthProvider] = useState<string | null>(null);
  const [authTypeLoading, setAuthTypeLoading] = useState(true);

  // Reauth state
  const [isReauthenticating, setIsReauthenticating] = useState(false);
  const [reauthError, setReauthError] = useState<string | null>(null);

  // Local form state - split name fields
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nickname, setNickname] = useState("");
  const [zodiacSign, setZodiacSign] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [unknownBirthTime, setUnknownBirthTime] = useState(false);

  // Location state - pre-resolved from PlacePicker
  const [birthPlace, setBirthPlace] = useState<PlaceSelection | null>(null);
  const [birthPlaceDisplay, setBirthPlaceDisplay] = useState("");
  const [displayTimezone, setDisplayTimezone] = useState("");

  // Credentials section state
  const [userEmail, setUserEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [emailUpdateSuccess, setEmailUpdateSuccess] = useState<string | null>(null);
  const [emailUpdateError, setEmailUpdateError] = useState<string | null>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordUpdateSuccess, setPasswordUpdateSuccess] = useState<string | null>(null);
  const [passwordUpdateError, setPasswordUpdateError] = useState<string | null>(null);

  // Preferences
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Journal state
  const [journalMessage, setJournalMessage] = useState<string | null>(null);

  // Social connections state (from /api/social/status)
  const [socialStatuses, setSocialStatuses] = useState<SocialConnectionStatus[]>([]);
  const [socialStatusLoading, setSocialStatusLoading] = useState(true);

  // Disconnect confirmation dialog state
  const [pendingDisconnectProvider, setPendingDisconnectProvider] = useState<SocialProvider | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectSuccess, setDisconnectSuccess] = useState<string | null>(null);

  // Hibernate modal state
  const [showHibernateModal, setShowHibernateModal] = useState(false);
  const [hibernatePassword, setHibernatePassword] = useState("");
  const [hibernateConfirmText, setHibernateConfirmText] = useState("");
  const [isHibernating, setIsHibernating] = useState(false);
  const [hibernateError, setHibernateError] = useState<string | null>(null);

  // Delete account modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Detect auth type on mount
  useEffect(() => {
    const detectAuthType = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUserHasPassword(hasPasswordCredential(user));
        setPrimaryOAuthProvider(getPrimaryOAuthProvider(user));
        setUserEmail(user?.email || "");
      } catch (err) {
        console.error("Failed to detect auth type:", err);
      } finally {
        setAuthTypeLoading(false);
      }
    };
    detectAuthType();
  }, []);

  // Handle reauth_success query param - auto-open modal after successful reauth
  useEffect(() => {
    const reauthSuccess = searchParams.get("reauth_success");
    if (reauthSuccess === "delete") {
      setShowDeleteModal(true);
      // Clear attempt counter on successful reauth
      sessionStorage.removeItem("oauth_reauth_attempts_delete");
    } else if (reauthSuccess === "hibernate") {
      setShowHibernateModal(true);
      sessionStorage.removeItem("oauth_reauth_attempts_hibernate");
    }
    // Note: We don't clear query param from URL - we use it to know reauth was successful
  }, [searchParams]);

  // Load profile data into form fields
  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || "");
      setMiddleName(profile.middle_name || "");
      setLastName(profile.last_name || "");
      setNickname(profile.preferred_name || "");
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

  // Load social connection status from /api/social/status
  useEffect(() => {
    const loadSocialStatus = async () => {
      try {
        const response = await fetch("/api/social/status");
        if (response.ok) {
          const data = await response.json();
          setSocialStatuses(data.connections || []);
        }
      } catch (err) {
        console.error("Failed to load social status:", err);
      } finally {
        setSocialStatusLoading(false);
      }
    };
    loadSocialStatus();
  }, []);

  // Helper to get status for a specific provider
  const getSocialStatus = (provider: SocialProvider): SocialConnectionStatus | undefined => {
    return socialStatuses.find((s) => s.provider === provider);
  };

  // Connect handler - uses custom OAuth flow with return_to for post-OAuth redirect
  const handleSocialConnect = (provider: SocialProvider) => {
    window.location.href = `/api/social/oauth/${provider}/connect?return_to=/settings`;
  };

  // Reauth handler for OAuth-only users
  const startReauth = async (intent: "delete" | "hibernate" | "reactivate") => {
    if (!primaryOAuthProvider) {
      setReauthError("No linked social provider found.");
      return;
    }

    // Loop prevention: check sessionStorage for attempts
    const attemptKey = `oauth_reauth_attempts_${intent}`;
    const attempts = parseInt(sessionStorage.getItem(attemptKey) || "0", 10);
    if (attempts >= 2) {
      setReauthError("Too many verification attempts. Please try again later.");
      return;
    }
    sessionStorage.setItem(attemptKey, String(attempts + 1));

    setIsReauthenticating(true);
    setReauthError(null);

    try {
      const response = await fetch("/api/auth/reauth/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, provider: primaryOAuthProvider }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to start reauth");
      }

      // Redirect to OAuth provider
      window.location.href = data.redirectUrl;
    } catch (err: any) {
      setReauthError(err.message || "Failed to start re-authentication");
      setIsReauthenticating(false);
    }
  };

  // Check if we have a valid reauth for a specific intent (from URL param)
  const hasReauthForIntent = (intent: "delete" | "hibernate" | "reactivate"): boolean => {
    const reauthSuccess = searchParams.get("reauth_success");
    return reauthSuccess === intent;
  };

  // Get display name for primary OAuth provider
  const getProviderDisplayName = (): string => {
    if (!primaryOAuthProvider) return "your account";
    return primaryOAuthProvider.charAt(0).toUpperCase() + primaryOAuthProvider.slice(1);
  };

  // Helper to count connected providers
  const getConnectedCount = (): number => {
    return socialStatuses.filter((s) => s.status === "connected").length;
  };

  // Helper to get provider display name
  const getProviderName = (providerId: SocialProvider): string => {
    return SOCIAL_PROVIDERS.find((p) => p.id === providerId)?.name || providerId;
  };

  // Disconnect handler - called after confirmation
  const handleDisconnect = async () => {
    if (!pendingDisconnectProvider) return;

    setIsDisconnecting(true);
    try {
      const response = await fetch("/api/social/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: pendingDisconnectProvider }),
      });

      if (response.ok) {
        const providerName = getProviderName(pendingDisconnectProvider);
        setDisconnectSuccess(`Disconnected from ${providerName}`);
        // Refresh status and profile
        const statusResponse = await fetch("/api/social/status");
        if (statusResponse.ok) {
          const data = await statusResponse.json();
          setSocialStatuses(data.connections || []);
        }
        await refreshProfile();
        // Auto-clear success message after 3 seconds
        setTimeout(() => setDisconnectSuccess(null), 3000);
      } else {
        console.error("Failed to disconnect:", await response.text());
      }
    } catch (err) {
      console.error("Failed to disconnect:", err);
    } finally {
      setIsDisconnecting(false);
      setPendingDisconnectProvider(null);
    }
  };

  // Toggle handler for per-provider connect/disconnect
  const handleProviderToggle = (provider: SocialProvider, isCurrentlyConnected: boolean) => {
    if (isCurrentlyConnected) {
      // Show confirmation dialog before disconnecting
      setPendingDisconnectProvider(provider);
    } else {
      // Start OAuth connect flow
      handleSocialConnect(provider);
    }
  };

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
      // Server will auto-compose full_name from first/middle/last
      const updatePayload: Record<string, any> = {
        first_name: firstName.trim() || null,
        middle_name: middleName.trim() || null,
        last_name: lastName.trim() || null,
        preferred_name: nickname.trim() || null,
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

  const handleUpdateEmail = async () => {
    if (!newEmail || newEmail === userEmail) {
      setEmailUpdateError("Please enter a different email address.");
      return;
    }

    // Basic email validation
    if (!newEmail.includes("@") || !newEmail.includes(".")) {
      setEmailUpdateError("Please enter a valid email address.");
      return;
    }

    setIsUpdatingEmail(true);
    setEmailUpdateError(null);
    setEmailUpdateSuccess(null);

    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });

      if (error) {
        throw error;
      }

      setEmailUpdateSuccess("Check your new email to confirm the change.");
      setNewEmail("");
    } catch (err: any) {
      console.error("Email update error:", err);
      setEmailUpdateError(err.message || "Failed to update email. Please try again.");
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    // Validation
    if (!newPassword || !confirmPassword) {
      setPasswordUpdateError("Please fill in all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordUpdateError("Passwords don't match.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordUpdateError("Password must be at least 8 characters.");
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordUpdateError(null);
    setPasswordUpdateSuccess(null);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        throw error;
      }

      // Clear form and show success
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordUpdateSuccess(
        userHasPassword
          ? "Password updated successfully."
          : "Password created! You can now sign in with email and password."
      );

      // If this was an OAuth-only user, they now have a password
      if (!userHasPassword) {
        setUserHasPassword(true);
      }

      // Clear success message after 5 seconds
      setTimeout(() => setPasswordUpdateSuccess(null), 5000);
    } catch (err: any) {
      console.error("Password update error:", err);
      setPasswordUpdateError(err.message || "Failed to update password. Please try again.");
    } finally {
      setIsUpdatingPassword(false);
    }
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

  const handleHibernateAccount = async () => {
    const trimmedConfirm = hibernateConfirmText.trim();
    if (trimmedConfirm !== "HIBERNATE") {
      setHibernateError("Please type HIBERNATE to confirm.");
      return;
    }
    // Password required only for password users
    if (userHasPassword && !hibernatePassword) {
      setHibernateError("Password is required.");
      return;
    }

    setIsHibernating(true);
    setHibernateError(null);

    try {
      const response = await fetch("/api/account/hibernate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: userHasPassword ? hibernatePassword : undefined,
          confirmText: trimmedConfirm,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // If reauth expired or invalid, show error
        if (data.error === "ReauthRequired") {
          setHibernateError("Your verification has expired. Please verify again.");
          return;
        }
        throw new Error(data.message || "Failed to hibernate account");
      }

      // Clear attempt counter on success
      sessionStorage.removeItem("oauth_reauth_attempts_hibernate");

      // Redirect to welcome page with hibernated param
      window.location.href = "/welcome?hibernated=true";
    } catch (err: any) {
      setHibernateError(err.message || "Failed to hibernate account");
    } finally {
      setIsHibernating(false);
    }
  };

  const handleDeleteAccount = async () => {
    const trimmedConfirm = deleteConfirmText.trim();
    if (trimmedConfirm !== "DELETE") {
      setDeleteError("Please type DELETE to confirm.");
      return;
    }
    // Password required only for password users
    if (userHasPassword && !deletePassword) {
      setDeleteError("Password is required.");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: userHasPassword ? deletePassword : undefined,
          confirmText: trimmedConfirm,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // If reauth expired or invalid, show error
        if (data.error === "ReauthRequired") {
          setDeleteError("Your verification has expired. Please verify again.");
          return;
        }
        throw new Error(data.message || "Failed to delete account");
      }

      // Clear attempt counter on success
      sessionStorage.removeItem("oauth_reauth_attempts_delete");

      // Redirect to home page after deletion
      window.location.href = "/?deleted=true";
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
  };

  const resetHibernateModal = () => {
    setShowHibernateModal(false);
    setHibernatePassword("");
    setHibernateConfirmText("");
    setHibernateError(null);
  };

  const resetDeleteModal = () => {
    setShowDeleteModal(false);
    setDeletePassword("");
    setDeleteConfirmText("");
    setDeleteError(null);
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

            {/* Gentle banner for existing users missing first/last name */}
            {profile && (!profile.first_name || !profile.last_name) && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                Please add your first and last name for a more personalized experience.
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-5">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="middleName">Middle name</Label>
                <Input
                  id="middleName"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  placeholder="Optional"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="What should we call you?"
              />
              <p className="text-xs text-accent-ink/60">
                If different from your first name
              </p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={userEmail || profile.email}
                disabled
                className="bg-gray-50"
              />
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Enter new email address"
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  onClick={handleUpdateEmail}
                  disabled={isUpdatingEmail || !newEmail}
                  className="min-h-[44px]"
                >
                  {isUpdatingEmail ? "Updating..." : "Update"}
                </Button>
              </div>
              {emailUpdateSuccess && (
                <p className="text-xs text-green-600">{emailUpdateSuccess}</p>
              )}
              {emailUpdateError && (
                <p className="text-xs text-danger-soft">{emailUpdateError}</p>
              )}
              <p className="text-xs text-accent-ink/60">
                You&apos;ll receive a confirmation email at your new address.
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

          {/* Password Section - differs based on auth type */}
          <section className="space-y-5 pt-6 border-t border-border-subtle/60">
            <h2 className="text-lg md:text-xl font-semibold text-accent-gold">
              {userHasPassword ? "Change password" : "Create password"}
            </h2>

            {authTypeLoading ? (
              <p className="text-sm text-accent-ink/60">Loading...</p>
            ) : userHasPassword ? (
              // Password users: show change password form
              <div className="space-y-5 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
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

                {passwordUpdateSuccess && (
                  <p className="text-sm text-green-600">{passwordUpdateSuccess}</p>
                )}
                {passwordUpdateError && (
                  <p className="text-sm text-danger-soft">{passwordUpdateError}</p>
                )}

                <Button
                  variant="gold"
                  onClick={handleChangePassword}
                  disabled={isUpdatingPassword}
                  className="min-h-[44px]"
                >
                  {isUpdatingPassword ? "Updating..." : "Change password"}
                </Button>

                <p className="text-xs md:text-sm text-accent-ink/60 leading-relaxed">
                  Your session will remain active after changing your password.
                </p>
              </div>
            ) : (
              // OAuth-only users: show create password option
              <div className="space-y-5 max-w-md">
                <p className="text-sm text-accent-ink/70 leading-relaxed">
                  You signed up with {primaryOAuthProvider ? primaryOAuthProvider.charAt(0).toUpperCase() + primaryOAuthProvider.slice(1) : "a social account"}.
                  Add a password to also sign in with email.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                {passwordUpdateSuccess && (
                  <p className="text-sm text-green-600">{passwordUpdateSuccess}</p>
                )}
                {passwordUpdateError && (
                  <p className="text-sm text-danger-soft">{passwordUpdateError}</p>
                )}

                <Button
                  variant="gold"
                  onClick={handleChangePassword}
                  disabled={isUpdatingPassword}
                  className="min-h-[44px]"
                >
                  {isUpdatingPassword ? "Creating..." : "Create password"}
                </Button>
              </div>
            )}
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
              <div className="flex items-center justify-between">
                <h2 className="text-lg md:text-xl font-semibold text-accent-gold">
                  Social Insights
                </h2>
                {/* Derived status indicator (not a toggle) */}
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    getConnectedCount() > 0
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {getConnectedCount() > 0 ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="text-sm md:text-base text-accent-ink/60 leading-relaxed mt-1">
                Connect your social accounts to help Solara understand your emotional tone
                and daily rhythms. We will never post for you.
              </p>
            </div>

            {/* Success message */}
            {disconnectSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                {disconnectSuccess}
              </div>
            )}

            <div className="space-y-4">
              {SOCIAL_PROVIDERS.map((provider) => {
                const status = getSocialStatus(provider.id);
                const isConnected = status?.status === "connected";
                const needsReauth = status?.status === "needs_reauth";
                const isEnabled = provider.enabled;

                return (
                  <Card
                    key={provider.id}
                    className={`border-border-subtle ${!isEnabled ? "opacity-50" : ""}`}
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
                            style={{ backgroundColor: provider.color }}
                          >
                            {provider.letter}
                          </div>
                          <div>
                            <p className="text-sm md:text-base font-medium">{provider.name}</p>
                            {!isEnabled ? (
                              <p className="text-xs md:text-sm text-accent-ink/60">Coming soon</p>
                            ) : socialStatusLoading ? (
                              <p className="text-xs md:text-sm text-accent-ink/60">Loading...</p>
                            ) : needsReauth ? (
                              <p className="text-xs md:text-sm text-amber-600">Needs reconnection</p>
                            ) : isConnected ? (
                              <p className="text-xs md:text-sm text-green-600">Connected</p>
                            ) : (
                              <p className="text-xs md:text-sm text-accent-ink/60">Not connected</p>
                            )}
                          </div>
                        </div>

                        {/* Per-provider toggle or Coming Soon */}
                        {isEnabled ? (
                          needsReauth ? (
                            // Show Reconnect button for needs_reauth state
                            <Button
                              variant="outline"
                              onClick={() => handleSocialConnect(provider.id)}
                              className="min-h-[44px]"
                            >
                              Reconnect
                            </Button>
                          ) : (
                            // Connect/Disconnect toggle
                            <button
                              onClick={() => handleProviderToggle(provider.id, isConnected)}
                              disabled={socialStatusLoading}
                              className="flex items-center gap-2"
                              aria-label={isConnected ? `Disconnect ${provider.name}` : `Connect ${provider.name}`}
                            >
                              <span className="text-xs text-accent-ink/60">
                                {isConnected ? "ON" : "OFF"}
                              </span>
                              <div
                                className={`w-11 h-7 rounded-full flex items-center px-1 transition-colors ${
                                  isConnected ? "bg-accent-gold" : "bg-gray-300"
                                } ${socialStatusLoading ? "opacity-50" : ""}`}
                              >
                                <div
                                  className={`w-5 h-5 bg-white rounded-full transition-transform ${
                                    isConnected ? "translate-x-4" : "translate-x-0"
                                  }`}
                                ></div>
                              </div>
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-accent-ink/40">Coming Soon</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

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
              <Button
                variant="outline"
                className="w-full sm:w-auto min-h-[44px]"
                onClick={() => setShowHibernateModal(true)}
              >
                Hibernate account
              </Button>
            </div>

            <div className="space-y-4">
              <h3 className="text-base md:text-lg font-medium">Delete account</h3>
              <p className="text-sm md:text-base text-accent-ink/60 leading-relaxed">
                Permanently delete your account and all associated data. This action
                cannot be undone.
              </p>
              <Button
                variant="destructive"
                className="w-full sm:w-auto min-h-[44px]"
                onClick={() => setShowDeleteModal(true)}
              >
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

      {/* Disconnect Confirmation Dialog */}
      <Dialog
        open={!!pendingDisconnectProvider}
        onOpenChange={(open) => !open && setPendingDisconnectProvider(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Disconnect {pendingDisconnectProvider ? getProviderName(pendingDisconnectProvider) : ""}?
            </DialogTitle>
            <DialogDescription>
              This will stop pulling signals from {pendingDisconnectProvider ? getProviderName(pendingDisconnectProvider) : "this account"}.
              You can reconnect anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setPendingDisconnectProvider(null)}
              disabled={isDisconnecting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting ? "Disconnecting..." : "Disconnect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hibernate Account Dialog */}
      <Dialog open={showHibernateModal} onOpenChange={(open) => !open && resetHibernateModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hibernate your account</DialogTitle>
            <DialogDescription>
              Hibernating pauses your subscription and locks access to Solara.
              Your data will be preserved and you can reactivate anytime.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Password field only for password users */}
            {userHasPassword && (
              <div className="space-y-2">
                <Label htmlFor="hibernatePassword">Enter your password</Label>
                <Input
                  id="hibernatePassword"
                  type="password"
                  value={hibernatePassword}
                  onChange={(e) => setHibernatePassword(e.target.value)}
                  placeholder="Your password"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="hibernateConfirm">
                Type <span className="font-semibold">HIBERNATE</span> to confirm
              </Label>
              <Input
                id="hibernateConfirm"
                value={hibernateConfirmText}
                onChange={(e) => setHibernateConfirmText(e.target.value.toUpperCase())}
                placeholder="HIBERNATE"
              />
            </div>
            {hibernateError && (
              <p className="text-sm text-danger-soft">{hibernateError}</p>
            )}
            {reauthError && (
              <p className="text-sm text-danger-soft">{reauthError}</p>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={resetHibernateModal}
              disabled={isHibernating || isReauthenticating}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            {/* OAuth-only users: show "Confirm with Provider" if not yet verified */}
            {!userHasPassword && !hasReauthForIntent("hibernate") ? (
              <Button
                variant="default"
                onClick={() => startReauth("hibernate")}
                disabled={isReauthenticating || hibernateConfirmText.trim() !== "HIBERNATE"}
                className="w-full sm:w-auto"
              >
                {isReauthenticating ? "Redirecting..." : `Confirm with ${getProviderDisplayName()}`}
              </Button>
            ) : (
              <Button
                variant="default"
                onClick={handleHibernateAccount}
                disabled={isHibernating || hibernateConfirmText.trim() !== "HIBERNATE"}
                className="w-full sm:w-auto"
              >
                {isHibernating ? "Hibernating..." : "Hibernate account"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteModal} onOpenChange={(open) => !open && resetDeleteModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-danger-soft">Delete your account</DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. All your data including
              your profile, journal entries, connections, and insights will be deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Password field only for password users */}
            {userHasPassword && (
              <div className="space-y-2">
                <Label htmlFor="deletePassword">Enter your password</Label>
                <Input
                  id="deletePassword"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Your password"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="deleteConfirm">
                Type <span className="font-semibold text-danger-soft">DELETE</span> to confirm
              </Label>
              <Input
                id="deleteConfirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                placeholder="DELETE"
                className="border-danger-soft/50 focus:border-danger-soft"
              />
            </div>
            {deleteError && (
              <p className="text-sm text-danger-soft">{deleteError}</p>
            )}
            {reauthError && (
              <p className="text-sm text-danger-soft">{reauthError}</p>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={resetDeleteModal}
              disabled={isDeleting || isReauthenticating}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            {/* OAuth-only users: show "Confirm with Provider" if not yet verified */}
            {!userHasPassword && !hasReauthForIntent("delete") ? (
              <Button
                variant="destructive"
                onClick={() => startReauth("delete")}
                disabled={isReauthenticating || deleteConfirmText.trim() !== "DELETE"}
                className="w-full sm:w-auto"
              >
                {isReauthenticating ? "Redirecting..." : `Confirm with ${getProviderDisplayName()}`}
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmText.trim() !== "DELETE"}
                className="w-full sm:w-auto"
              >
                {isDeleting ? "Deleting..." : "Delete account"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
