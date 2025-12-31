"use client";

import { NextIntlClientProvider } from "next-intl";
import { useSettings } from "@/providers/SettingsProvider";
import { isValidLocale, defaultLocale, isRtlLocale, type Locale } from "@/i18n";
import { useEffect, useState } from "react";

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

interface IntlProviderProps {
  children: React.ReactNode;
}

export function IntlProvider({ children }: IntlProviderProps) {
  const { profile, loading } = useSettings();
  const [mounted, setMounted] = useState(false);

  // Determine the current locale from profile or default
  const profileLang = profile?.language || "";
  const locale: Locale = isValidLocale(profileLang) ? profileLang : defaultLocale;

  // Get messages for the current locale, fallback to English
  const messages = messagesMap[locale] || messagesMap[defaultLocale];

  // Handle RTL direction
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && typeof document !== "undefined") {
      const isRtl = isRtlLocale(locale);
      document.documentElement.dir = isRtl ? "rtl" : "ltr";
      document.documentElement.lang = locale;
    }
  }, [locale, mounted]);

  // Show children immediately with default locale while loading
  // This prevents a loading flash
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone={profile?.timezone || "UTC"}
      now={new Date()}
    >
      {children}
    </NextIntlClientProvider>
  );
}
