"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Profile, ProfileUpdate } from "@/types";
import { getZodiacSign } from "@/lib/zodiac";

interface SettingsContextValue {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  saveProfile: (updates: ProfileUpdate) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined
);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setProfile(null);
        return;
      }

      // Try to load existing profile
      const { data: existingProfile, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        // PGRST116 = not found, which is okay
        throw fetchError;
      }

      if (existingProfile) {
        setProfile(existingProfile as Profile);
        return;
      }

      // Profile doesn't exist, create a new one
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const newProfile: Partial<Profile> = {
        id: user.id,
        email: user.email!,
        full_name: user.user_metadata?.full_name || null,
        preferred_name: null,
        birth_date: null,
        birth_time: null,
        birth_city: null,
        birth_region: null,
        birth_country: null,
        timezone,
        zodiac_sign: null,
        language: "en",
      };

      const { data: createdProfile, error: createError } = await supabase
        .from("profiles")
        .insert(newProfile)
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      setProfile(createdProfile as Profile);
    } catch (err: any) {
      console.error("Error loading profile:", err);
      setError(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async (updates: ProfileUpdate) => {
    try {
      if (!profile) {
        throw new Error("No profile to update");
      }

      setError(null);

      // Auto-calculate zodiac sign if birth_date is provided
      let finalUpdates = { ...updates };
      if (updates.birth_date) {
        const sign = getZodiacSign(updates.birth_date);
        if (sign) {
          finalUpdates.zodiac_sign = sign;
        }
      }

      const { data: updatedProfile, error: updateError } = await supabase
        .from("profiles")
        .update(finalUpdates)
        .eq("id", profile.id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setProfile(updatedProfile as Profile);
    } catch (err: any) {
      console.error("Error saving profile:", err);
      setError(err.message || "Failed to save profile");
      throw err;
    }
  };

  const refreshProfile = async () => {
    await loadProfile();
  };

  useEffect(() => {
    loadProfile();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        loadProfile();
      } else if (event === "SIGNED_OUT") {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <SettingsContext.Provider
      value={{ profile, loading, error, saveProfile, refreshProfile }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
