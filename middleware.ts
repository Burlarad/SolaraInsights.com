import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware for Solara - sets secure cookies on first visit
 *
 * Cookies set (only if missing):
 * 1. __Host-solara_sid - Anonymous session ID for rate limiting fairness
 * 2. __Host-solara_locale - Language preference (detected from Accept-Language/geo)
 *
 * __Host- prefix enforces: Secure=true, Path=/, no Domain attribute
 */

// Supported locales (must match i18n.ts)
const SUPPORTED_LOCALES = [
  "en", "es", "fr", "de", "pt", "it", "nl", "pl", "ru",
  "zh-TW", "ja", "ko", "vi", "th", "id", "tl", "hi", "ta", "ar"
] as const;

type Locale = typeof SUPPORTED_LOCALES[number];

const DEFAULT_LOCALE: Locale = "en";

// Cookie names
const SESSION_COOKIE = "__Host-solara_sid";
const LOCALE_COOKIE = "__Host-solara_locale";

// Cookie TTL: 1 year
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/**
 * Map of country codes to locales for geo-based detection
 */
const COUNTRY_TO_LOCALE: Record<string, Locale> = {
  // Spanish-speaking
  ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es",
  EC: "es", GT: "es", CU: "es", BO: "es", DO: "es", HN: "es", PY: "es",
  SV: "es", NI: "es", CR: "es", PA: "es", UY: "es",
  // French-speaking
  FR: "fr", BE: "fr", CH: "fr", CA: "fr", SN: "fr", CI: "fr", ML: "fr",
  // German-speaking
  DE: "de", AT: "de",
  // Portuguese-speaking
  BR: "pt", PT: "pt", AO: "pt", MZ: "pt",
  // Italian
  IT: "it",
  // Dutch
  NL: "nl",
  // Polish
  PL: "pl",
  // Russian-speaking
  RU: "ru", BY: "ru", KZ: "ru",
  // Chinese (Traditional)
  TW: "zh-TW", HK: "zh-TW",
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
  // Hindi (India)
  IN: "hi",
  // Arabic-speaking
  SA: "ar", AE: "ar", EG: "ar", IQ: "ar", JO: "ar", KW: "ar", LB: "ar",
  LY: "ar", MA: "ar", OM: "ar", QA: "ar", SY: "ar", TN: "ar", YE: "ar",
};

/**
 * Check if a string is a valid supported locale
 */
function isValidLocale(locale: string): locale is Locale {
  return SUPPORTED_LOCALES.includes(locale as Locale);
}

/**
 * Parse Accept-Language header and return first supported locale
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
    // Try exact match first (e.g., "zh-tw" -> "zh-TW")
    const normalizedCode = code === "zh-tw" ? "zh-TW" : code;
    if (isValidLocale(normalizedCode)) {
      return normalizedCode;
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
 * Get locale from Cloudflare country header
 */
function getLocaleFromCountry(countryCode: string | null): Locale | null {
  if (!countryCode) return null;
  return COUNTRY_TO_LOCALE[countryCode.toUpperCase()] || null;
}

/**
 * Detect best locale from request
 * Priority: Accept-Language → cf-ipcountry → default "en"
 */
function detectLocale(request: NextRequest): Locale {
  // 1. Accept-Language header
  const acceptLanguage = request.headers.get("accept-language");
  const headerLocale = parseAcceptLanguage(acceptLanguage);
  if (headerLocale) {
    return headerLocale;
  }

  // 2. Cloudflare country header
  const cfCountry = request.headers.get("cf-ipcountry");
  const countryLocale = getLocaleFromCountry(cfCountry);
  if (countryLocale) {
    return countryLocale;
  }

  // 3. Default
  return DEFAULT_LOCALE;
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Check if cookies already exist
  const existingSession = request.cookies.get(SESSION_COOKIE);
  const existingLocale = request.cookies.get(LOCALE_COOKIE);

  const isProduction = process.env.NODE_ENV === "production";

  // Set session cookie if missing
  if (!existingSession) {
    const sessionId = crypto.randomUUID();

    response.cookies.set({
      name: SESSION_COOKIE,
      value: sessionId,
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });

    if (process.env.DEBUG_MIDDLEWARE === "true") {
      console.log(`[Middleware] Created session: ${sessionId.slice(0, 8)}...`);
    }
  }

  // Set locale cookie if missing (do NOT overwrite existing - preserves user choice when traveling)
  if (!existingLocale) {
    const detectedLocale = detectLocale(request);

    response.cookies.set({
      name: LOCALE_COOKIE,
      value: detectedLocale,
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });

    if (process.env.DEBUG_MIDDLEWARE === "true") {
      console.log(`[Middleware] Set locale: ${detectedLocale}`);
    }
  }

  return response;
}

// Run on all routes except static files
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
