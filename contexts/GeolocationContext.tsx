"use client";

/**
 * GeolocationContext - App-wide geolocation and timezone system
 *
 * Provides accurate timezone detection for the entire app.
 * Handles consent flow, caching, and graceful fallbacks.
 *
 * Priority chain:
 * 1. Browser geolocation (if granted) - most accurate
 * 2. Browser timezone (Intl API) - always works, no permission
 * 3. Profile timezone (if logged in) - from user's birth location
 * 4. UTC fallback (last resort)
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { getCoordsFromTimezone } from "@/lib/timezone-coords";
import { LocationConsentBanner } from "@/components/ui/LocationConsentBanner";

// ============================================================================
// TYPES
// ============================================================================

export type ConsentStatus = "pending" | "granted" | "denied" | "dismissed";
export type LocationSource =
  | "geolocation"
  | "browser_timezone"
  | "profile"
  | "fallback";

export interface GeolocationState {
  /** IANA timezone e.g. "America/New_York" - always available */
  timezone: string;

  /** Coordinates for sunrise/sunset - null if geolocation denied */
  coords: { lat: number; lon: number } | null;

  /** Current consent status */
  consentStatus: ConsentStatus;

  /** Loading state while determining location */
  isLoading: boolean;

  /** How timezone/coords were determined */
  source: LocationSource;

  /** Error message if geolocation failed */
  error: string | null;
}

export interface GeolocationContextValue extends GeolocationState {
  /** Request browser geolocation permission */
  requestPermission: () => Promise<void>;

  /** Dismiss the consent prompt without granting */
  dismissPrompt: () => void;

  /** Force refresh of location data */
  refresh: () => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = "solara_location_consent";
const COORDS_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const GEOLOCATION_TIMEOUT_MS = 10000; // 10 seconds

interface StoredConsent {
  status: ConsentStatus;
  timestamp: string;
  cachedCoords?: { lat: number; lon: number };
  cachedTimezone?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function getStoredConsent(): StoredConsent | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as StoredConsent;
  } catch {
    return null;
  }
}

function setStoredConsent(consent: StoredConsent): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  } catch (e) {
    console.warn("[Geolocation] Failed to store consent:", e);
  }
}

function isCacheValid(consent: StoredConsent | null): boolean {
  if (!consent?.cachedCoords || !consent?.timestamp) return false;

  const cachedTime = new Date(consent.timestamp).getTime();
  const now = Date.now();
  return now - cachedTime < COORDS_CACHE_MAX_AGE_MS;
}

// ============================================================================
// CONTEXT
// ============================================================================

const GeolocationContext = createContext<GeolocationContextValue | undefined>(
  undefined
);

// ============================================================================
// PROVIDER
// ============================================================================

interface GeolocationProviderProps {
  children: ReactNode;
}

export function GeolocationProvider({ children }: GeolocationProviderProps) {
  const [state, setState] = useState<GeolocationState>({
    timezone: "UTC",
    coords: null,
    consentStatus: "pending",
    isLoading: true,
    source: "fallback",
    error: null,
  });

  // Initialize on mount
  useEffect(() => {
    initializeLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Initialize location state from storage and browser
   */
  const initializeLocation = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));

    // Get browser timezone (always available, no permission needed)
    const browserTimezone = getBrowserTimezone();

    // Check stored consent
    const storedConsent = getStoredConsent();

    if (!storedConsent) {
      // Never asked - show banner, use browser timezone for now
      setState({
        timezone: browserTimezone,
        coords: getCoordsFromTimezone(browserTimezone),
        consentStatus: "pending",
        isLoading: false,
        source: "browser_timezone",
        error: null,
      });
      return;
    }

    // Previously responded
    if (storedConsent.status === "granted") {
      // Check if we have valid cached coords
      if (isCacheValid(storedConsent) && storedConsent.cachedCoords) {
        setState({
          timezone: storedConsent.cachedTimezone || browserTimezone,
          coords: storedConsent.cachedCoords,
          consentStatus: "granted",
          isLoading: false,
          source: "geolocation",
          error: null,
        });

        // Silently refresh coords in background if cache is getting stale
        const cacheAge = Date.now() - new Date(storedConsent.timestamp).getTime();
        if (cacheAge > COORDS_CACHE_MAX_AGE_MS / 2) {
          silentlyRefreshCoords();
        }
      } else {
        // Cache expired or missing, try to get fresh coords
        await fetchGeolocation(true);
      }
    } else {
      // Previously denied or dismissed - use browser timezone with approximate coords
      setState({
        timezone: browserTimezone,
        coords: getCoordsFromTimezone(browserTimezone),
        consentStatus: storedConsent.status,
        isLoading: false,
        source: "browser_timezone",
        error: null,
      });
    }
  }, []);

  /**
   * Silently refresh coords without changing UI state
   */
  const silentlyRefreshCoords = async () => {
    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: GEOLOCATION_TIMEOUT_MS,
            maximumAge: COORDS_CACHE_MAX_AGE_MS,
          });
        }
      );

      const coords = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };

      const browserTimezone = getBrowserTimezone();

      // Update cache
      setStoredConsent({
        status: "granted",
        timestamp: new Date().toISOString(),
        cachedCoords: coords,
        cachedTimezone: browserTimezone,
      });

      // Update state
      setState((prev) => ({
        ...prev,
        coords,
        timezone: browserTimezone,
      }));
    } catch {
      // Silent failure - keep using cached data
      console.log("[Geolocation] Silent refresh failed, using cached data");
    }
  };

  /**
   * Fetch geolocation from browser
   */
  const fetchGeolocation = async (isRefresh = false): Promise<void> => {
    if (!navigator.geolocation) {
      const browserTimezone = getBrowserTimezone();
      setState({
        timezone: browserTimezone,
        coords: getCoordsFromTimezone(browserTimezone),
        consentStatus: "denied",
        isLoading: false,
        source: "browser_timezone",
        error: "Geolocation not supported",
      });

      setStoredConsent({
        status: "denied",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: GEOLOCATION_TIMEOUT_MS,
            maximumAge: isRefresh ? 0 : COORDS_CACHE_MAX_AGE_MS,
          });
        }
      );

      const coords = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      };

      const browserTimezone = getBrowserTimezone();

      // Store consent and coords
      setStoredConsent({
        status: "granted",
        timestamp: new Date().toISOString(),
        cachedCoords: coords,
        cachedTimezone: browserTimezone,
      });

      setState({
        timezone: browserTimezone,
        coords,
        consentStatus: "granted",
        isLoading: false,
        source: "geolocation",
        error: null,
      });

      console.log(
        `[Geolocation] Got coordinates: ${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)} (${browserTimezone})`
      );
    } catch (error: any) {
      const browserTimezone = getBrowserTimezone();

      // Determine if user denied or if it was a technical error
      const isDenied =
        error.code === 1 || // PERMISSION_DENIED
        error.message?.toLowerCase().includes("denied");

      const status: ConsentStatus = isDenied ? "denied" : "dismissed";

      setStoredConsent({
        status,
        timestamp: new Date().toISOString(),
      });

      setState({
        timezone: browserTimezone,
        coords: getCoordsFromTimezone(browserTimezone),
        consentStatus: status,
        isLoading: false,
        source: "browser_timezone",
        error: isDenied
          ? "Location access denied"
          : error.message || "Failed to get location",
      });

      console.log(
        `[Geolocation] ${isDenied ? "Denied" : "Failed"}: using browser timezone ${browserTimezone}`
      );
    }
  };

  /**
   * Request permission - called when user clicks "Allow Location"
   */
  const requestPermission = async (): Promise<void> => {
    await fetchGeolocation(false);
  };

  /**
   * Dismiss prompt - called when user clicks "Continue Without"
   */
  const dismissPrompt = (): void => {
    const browserTimezone = getBrowserTimezone();

    setStoredConsent({
      status: "dismissed",
      timestamp: new Date().toISOString(),
    });

    setState({
      timezone: browserTimezone,
      coords: getCoordsFromTimezone(browserTimezone),
      consentStatus: "dismissed",
      isLoading: false,
      source: "browser_timezone",
      error: null,
    });

    console.log(
      `[Geolocation] User dismissed prompt, using browser timezone: ${browserTimezone}`
    );
  };

  /**
   * Force refresh of location data
   */
  const refresh = async (): Promise<void> => {
    const stored = getStoredConsent();
    if (stored?.status === "granted") {
      await fetchGeolocation(true);
    } else {
      // Re-initialize (will show banner if never asked)
      await initializeLocation();
    }
  };

  const value: GeolocationContextValue = {
    ...state,
    requestPermission,
    dismissPrompt,
    refresh,
  };

  return (
    <GeolocationContext.Provider value={value}>
      {children}
      {/* Consent banner - only shows when status is pending */}
      <LocationConsentBanner
        show={state.consentStatus === "pending" && !state.isLoading}
        onAllow={requestPermission}
        onDismiss={dismissPrompt}
        isLoading={state.isLoading}
      />
    </GeolocationContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useGeolocation(): GeolocationContextValue {
  const context = useContext(GeolocationContext);

  if (!context) {
    throw new Error(
      "useGeolocation must be used within a GeolocationProvider"
    );
  }

  return context;
}
