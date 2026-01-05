"use client";

import { NextIntlClientProvider } from "next-intl";
import { useSettings } from "@/providers/SettingsProvider";
import { isValidLocale, defaultLocale, isRtlLocale, type Locale } from "@/i18n";
import { useEffect, useState, useCallback, createContext, useContext, useRef } from "react";

// Import all message files statically
import en from "@/messages/en.json";
import es from "@/messages/es.json";
import fr from "@/messages/fr.json";
import de from "@/messages/de.json";
import pt from "@/messages/pt.json";
import it from "@/messages/it.json";
import nl from "@/messages/nl.json";
import pl from "@/messages/pl.json";
import ru from "@/messages/ru.json";
import zhTW from "@/messages/zh-TW.json";
import ja from "@/messages/ja.json";
import ko from "@/messages/ko.json";
import vi from "@/messages/vi.json";
import th from "@/messages/th.json";
import id from "@/messages/id.json";
import tl from "@/messages/tl.json";
import hi from "@/messages/hi.json";
import ta from "@/messages/ta.json";
import ar from "@/messages/ar.json";

// Messages map for quick lookup
const messagesMap: Record<Locale, typeof en> = {
  en,
  es,
  fr,
  de,
  pt,
  it,
  nl,
  pl,
  ru,
  "zh-TW": zhTW,
  ja,
  ko,
  vi,
  th,
  id,
  tl,
  hi,
  ta,
  ar,
};

/**
 * Parse browser language and return first supported locale
 */
function getBrowserLocale(): Locale | null {
  if (typeof navigator === "undefined") return null;

  const browserLangs = navigator.languages || [navigator.language];

  for (const lang of browserLangs) {
    // Try exact match first (e.g., "zh-TW")
    if (isValidLocale(lang)) {
      return lang;
    }

    // Try base language (e.g., "es-ES" -> "es")
    const baseLang = lang.split("-")[0].toLowerCase();
    if (isValidLocale(baseLang)) {
      return baseLang;
    }

    // Special case: zh -> zh-TW (we only support Traditional Chinese)
    if (baseLang === "zh") {
      return "zh-TW";
    }
  }

  return null;
}

// Context to allow NavBar to trigger locale changes
interface LocaleContextValue {
  locale: Locale;
  setLocaleImmediate: (locale: Locale) => void;
  refreshLocale: () => Promise<void>;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function useLocaleContext() {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocaleContext must be used within IntlProvider");
  }
  return context;
}

interface IntlProviderProps {
  children: React.ReactNode;
}

export function IntlProvider({ children }: IntlProviderProps) {
  const { profile } = useSettings();
  const [mounted, setMounted] = useState(false);
  const [cookieLocale, setCookieLocale] = useState<Locale | null>(null);
  const [immediateLocale, setImmediateLocale] = useState<Locale | null>(null);
  const fetchedRef = useRef(false);

  // Fetch locale from secure cookie via API (on mount, for anonymous users)
  const fetchCookieLocale = useCallback(async () => {
    try {
      const response = await fetch("/api/locale");
      if (response.ok) {
        const data = await response.json();
        if (data.locale && isValidLocale(data.locale)) {
          setCookieLocale(data.locale);
        }
      }
    } catch (error) {
      console.warn("Failed to fetch locale:", error);
    }
  }, []);

  // Refresh locale from cookie (called after POST /api/locale)
  const refreshLocale = useCallback(async () => {
    await fetchCookieLocale();
    setImmediateLocale(null); // Clear immediate override after refresh
  }, [fetchCookieLocale]);

  // Set locale immediately (for instant UI update before API call completes)
  const setLocaleImmediate = useCallback((newLocale: Locale) => {
    setImmediateLocale(newLocale);
  }, []);

  // Fetch cookie locale on mount (only once)
  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetchCookieLocale();
    }
  }, [fetchCookieLocale]);

  // Determine the current locale with fallback chain:
  // 1. Immediate locale (UI override for instant feedback)
  // 2. Profile language (logged-in users)
  // 3. Cookie locale (from secure httpOnly cookie)
  // 4. Browser language
  // 5. "en" default
  const resolvedLocale = (() => {
    // 1. Immediate override (for instant UI feedback)
    if (immediateLocale && isValidLocale(immediateLocale)) {
      return immediateLocale;
    }

    // 2. Profile language (logged-in users)
    const profileLang = profile?.language || "";
    if (isValidLocale(profileLang)) {
      return profileLang;
    }

    // 3. Cookie locale (from secure httpOnly cookie via API)
    if (cookieLocale) {
      return cookieLocale;
    }

    // 4. Browser language
    const browserLocale = getBrowserLocale();
    if (browserLocale) {
      return browserLocale;
    }

    // 5. Default
    return defaultLocale;
  })();

  // Get messages for the current locale, fallback to English
  const messages = messagesMap[resolvedLocale] || messagesMap[defaultLocale];

  // Handle mount state
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle RTL direction and lang attribute
  useEffect(() => {
    if (mounted && typeof document !== "undefined") {
      const isRtl = isRtlLocale(resolvedLocale);
      document.documentElement.dir = isRtl ? "rtl" : "ltr";
      document.documentElement.lang = resolvedLocale;
    }
  }, [resolvedLocale, mounted]);

  // Show children immediately with resolved locale
  return (
    <LocaleContext.Provider value={{ locale: resolvedLocale, setLocaleImmediate, refreshLocale }}>
      <NextIntlClientProvider
        locale={resolvedLocale}
        messages={messages}
        timeZone={profile?.timezone || "UTC"}
        now={new Date()}
      >
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
