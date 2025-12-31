/**
 * i18n Configuration
 *
 * Defines all supported locales, their display names, flags, and RTL support.
 * Used by next-intl for internationalization.
 */

export const locales = [
  "en",
  "es",
  "fr",
  "de",
  "pt",
  "it",
  "nl",
  "pl",
  "ru",
  "zh-TW",
  "ja",
  "ko",
  "vi",
  "th",
  "id",
  "tl",
  "hi",
  "ta",
  "ar",
] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/**
 * Human-readable names for each locale (in their native language)
 */
export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
  it: "Italiano",
  nl: "Nederlands",
  pl: "Polski",
  ru: "Русский",
  "zh-TW": "繁體中文",
  ja: "日本語",
  ko: "한국어",
  vi: "Tiếng Việt",
  th: "ไทย",
  id: "Bahasa Indonesia",
  tl: "Filipino",
  hi: "हिन्दी",
  ta: "தமிழ்",
  ar: "العربية",
};

/**
 * Flag emoji for each locale
 */
export const localeFlags: Record<Locale, string> = {
  en: "🇺🇸",
  es: "🇪🇸",
  fr: "🇫🇷",
  de: "🇩🇪",
  pt: "🇵🇹",
  it: "🇮🇹",
  nl: "🇳🇱",
  pl: "🇵🇱",
  ru: "🇷🇺",
  "zh-TW": "🇹🇼",
  ja: "🇯🇵",
  ko: "🇰🇷",
  vi: "🇻🇳",
  th: "🇹🇭",
  id: "🇮🇩",
  tl: "🇵🇭",
  hi: "🇮🇳",
  ta: "🇮🇳",
  ar: "🇸🇦",
};

/**
 * Locales that use right-to-left text direction
 */
export const rtlLocales: Locale[] = ["ar"];

/**
 * Check if a locale uses RTL text direction
 */
export function isRtlLocale(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}

/**
 * Validate if a string is a valid locale
 */
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

/**
 * Get locale display info for UI components
 */
export function getLocaleInfo(locale: Locale) {
  return {
    code: locale,
    name: localeNames[locale],
    flag: localeFlags[locale],
    isRtl: isRtlLocale(locale),
  };
}

/**
 * Get all locales with their display info (for language switcher)
 */
export function getAllLocaleInfo() {
  return locales.map(getLocaleInfo);
}
