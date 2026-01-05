/**
 * Server-side locale resolution utilities.
 *
 * Priority order:
 * 1. Explicit request body language
 * 2. Cookie: solara_locale
 * 3. Accept-Language header
 * 4. Cloudflare country header (cf-ipcountry)
 * 5. Default: "en"
 */

import { NextRequest } from "next/server";
import { locales, defaultLocale, isValidLocale, type Locale } from "@/i18n";

/**
 * Cookie name for persisted locale preference
 * Uses __Host- prefix for enhanced security (requires Secure=true, Path=/, no Domain)
 */
export const LOCALE_COOKIE_NAME = "__Host-solara_locale";

/**
 * Map of country codes to locale codes.
 * Used for Cloudflare geo fallback when no explicit preference exists.
 */
const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  // Spanish-speaking
  ES: "es",
  MX: "es",
  AR: "es",
  CO: "es",
  CL: "es",
  PE: "es",
  VE: "es",
  EC: "es",
  GT: "es",
  CU: "es",
  BO: "es",
  DO: "es",
  HN: "es",
  PY: "es",
  SV: "es",
  NI: "es",
  CR: "es",
  PA: "es",
  UY: "es",

  // French-speaking
  FR: "fr",
  BE: "fr",
  CH: "fr",
  CA: "fr",
  SN: "fr",
  CI: "fr",
  ML: "fr",

  // German-speaking
  DE: "de",
  AT: "de",

  // Portuguese-speaking
  BR: "pt",
  PT: "pt",
  AO: "pt",
  MZ: "pt",

  // Italian
  IT: "it",

  // Dutch
  NL: "nl",

  // Polish
  PL: "pl",

  // Russian-speaking
  RU: "ru",
  BY: "ru",
  KZ: "ru",

  // Chinese (Traditional)
  TW: "zh-TW",
  HK: "zh-TW",

  // Japanese
  JP: "ja",

  // Korean
  KR: "ko",

  // Vietnamese
  VN: "vi",

  // Thai
  TH: "th",

  // Indonesian
  ID: "id",

  // Filipino
  PH: "tl",

  // Hindi (India - also has Tamil speakers)
  IN: "hi",

  // Arabic-speaking
  SA: "ar",
  AE: "ar",
  EG: "ar",
  IQ: "ar",
  JO: "ar",
  KW: "ar",
  LB: "ar",
  LY: "ar",
  MA: "ar",
  OM: "ar",
  QA: "ar",
  SY: "ar",
  TN: "ar",
  YE: "ar",
};

/**
 * Parse Accept-Language header and return the first supported locale.
 *
 * @param acceptLanguage - The Accept-Language header value
 * @returns Matching locale or null
 */
function parseAcceptLanguage(acceptLanguage: string | null): Locale | null {
  if (!acceptLanguage) return null;

  // Parse "en-US,en;q=0.9,es;q=0.8" format
  const languages = acceptLanguage
    .split(",")
    .map((lang) => {
      const [code, qValue] = lang.trim().split(";q=");
      return {
        code: code.trim().toLowerCase(),
        q: qValue ? parseFloat(qValue) : 1.0,
      };
    })
    .sort((a, b) => b.q - a.q);

  for (const { code } of languages) {
    // Try exact match first (e.g., "zh-TW")
    if (isValidLocale(code)) {
      return code;
    }

    // Try base language (e.g., "en-US" -> "en")
    const baseCode = code.split("-")[0];
    if (isValidLocale(baseCode)) {
      return baseCode;
    }

    // Special case: zh -> zh-TW (we only support Traditional Chinese)
    if (baseCode === "zh") {
      return "zh-TW";
    }
  }

  return null;
}

/**
 * Get locale from Cloudflare country header.
 *
 * @param countryCode - Two-letter country code from cf-ipcountry
 * @returns Matching locale or null
 */
function getLocaleFromCountry(countryCode: string | null): Locale | null {
  if (!countryCode) return null;
  return COUNTRY_TO_LOCALE[countryCode.toUpperCase()] || null;
}

/**
 * Resolve the target language from a request using the priority chain.
 *
 * Priority:
 * 1. Explicit body language (already validated)
 * 2. Cookie: solara_locale
 * 3. Accept-Language header
 * 4. Cloudflare cf-ipcountry header
 * 5. Default: "en"
 *
 * @param req - NextRequest object
 * @param bodyLanguage - Language from request body (if any)
 * @returns Resolved locale code
 */
export function resolveLocale(
  req: NextRequest,
  bodyLanguage?: string | null
): Locale {
  // 1. Explicit body language (highest priority)
  if (bodyLanguage && isValidLocale(bodyLanguage)) {
    return bodyLanguage;
  }

  // 2. Cookie preference
  const cookieLocale = req.cookies.get(LOCALE_COOKIE_NAME)?.value;
  if (cookieLocale && isValidLocale(cookieLocale)) {
    return cookieLocale;
  }

  // 3. Accept-Language header
  const acceptLanguage = req.headers.get("accept-language");
  const headerLocale = parseAcceptLanguage(acceptLanguage);
  if (headerLocale) {
    return headerLocale;
  }

  // 4. Cloudflare country header
  const cfCountry = req.headers.get("cf-ipcountry");
  const countryLocale = getLocaleFromCountry(cfCountry);
  if (countryLocale) {
    return countryLocale;
  }

  // 5. Default fallback
  return defaultLocale;
}

/**
 * Get the source of a resolved locale for debugging.
 *
 * @param req - NextRequest object
 * @param bodyLanguage - Language from request body
 * @returns Source name
 */
export function getLocaleSource(
  req: NextRequest,
  bodyLanguage?: string | null
): string {
  if (bodyLanguage && isValidLocale(bodyLanguage)) {
    return "body";
  }

  const cookieLocale = req.cookies.get(LOCALE_COOKIE_NAME)?.value;
  if (cookieLocale && isValidLocale(cookieLocale)) {
    return "cookie";
  }

  const acceptLanguage = req.headers.get("accept-language");
  if (parseAcceptLanguage(acceptLanguage)) {
    return "accept-language";
  }

  const cfCountry = req.headers.get("cf-ipcountry");
  if (getLocaleFromCountry(cfCountry)) {
    return "cf-ipcountry";
  }

  return "default";
}

/**
 * Resolve locale for authenticated routes.
 * Adds profile.language as highest priority before falling back to public chain.
 *
 * Priority:
 * 1. Profile language (from Supabase profile)
 * 2. Cookie: solara_locale
 * 3. Accept-Language header
 * 4. Cloudflare cf-ipcountry header
 * 5. Default: "en"
 *
 * @param req - NextRequest object
 * @param profileLanguage - Language from user's profile (if authenticated)
 * @returns Resolved locale code
 */
export function resolveLocaleAuth(
  req: NextRequest,
  profileLanguage?: string | null
): Locale {
  // 1. Profile language (authenticated users - highest priority)
  if (profileLanguage && isValidLocale(profileLanguage)) {
    return profileLanguage;
  }

  // 2-5. Fall through to public chain (cookie → Accept-Language → cf-ipcountry → default)
  return resolveLocale(req, null);
}

/**
 * Generate the critical language requirement block for OpenAI prompts.
 * This ensures consistent language enforcement across all AI-generated content.
 *
 * @param languageName - Human-readable language name (e.g., "Español", "Français")
 * @param languageCode - ISO language code (e.g., "es", "fr")
 * @returns Prompt snippet to include in system or user prompt
 */
export function getCriticalLanguageBlock(
  languageName: string,
  languageCode: string
): string {
  return `CRITICAL LANGUAGE REQUIREMENT:
- You MUST write the ENTIRE response in ${languageName} (language code: ${languageCode})
- ALL text content (titles, summaries, descriptions, themes, etc.) must be in ${languageName}
- Do NOT include any English text in the response (unless ${languageCode} is "en")
- JSON field names stay in English, but ALL values must be in ${languageName}
- Maintain the mystical, premium Solara tone in ${languageName}`;
}
