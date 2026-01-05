import { NextRequest, NextResponse } from "next/server";
import { locales, type Locale, isValidLocale } from "@/i18n";

/**
 * Secure locale endpoint for httpOnly cookie management
 *
 * GET: Returns current locale from __Host-solara_locale cookie
 * POST: Sets locale in __Host-solara_locale cookie (httpOnly, secure)
 *
 * This endpoint is required because httpOnly cookies cannot be set by JavaScript.
 */

const LOCALE_COOKIE = "__Host-solara_locale";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

/**
 * GET /api/locale
 * Returns the current locale from the secure cookie
 */
export async function GET(req: NextRequest) {
  const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value;

  // Validate and return
  const locale: Locale = cookieLocale && isValidLocale(cookieLocale)
    ? cookieLocale
    : "en";

  return NextResponse.json({ locale });
}

/**
 * POST /api/locale
 * Sets the locale in the secure httpOnly cookie
 *
 * Body: { locale: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { locale } = body;

    // Validate locale
    if (!locale || typeof locale !== "string") {
      return NextResponse.json(
        { error: "Missing locale", message: "Locale is required" },
        { status: 400 }
      );
    }

    if (!isValidLocale(locale)) {
      return NextResponse.json(
        {
          error: "Invalid locale",
          message: `Locale must be one of: ${locales.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const isProduction = process.env.NODE_ENV === "production";

    // Create response with cookie
    const response = NextResponse.json({ ok: true, locale });

    response.cookies.set({
      name: LOCALE_COOKIE,
      value: locale,
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });

    return response;
  } catch (error) {
    console.error("[/api/locale] Error:", error);
    return NextResponse.json(
      { error: "Invalid request", message: "Could not parse request body" },
      { status: 400 }
    );
  }
}
