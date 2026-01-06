import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Locale, defaultLocale, isValidLocale, locales } from "@/i18n";

const LOCALE_COOKIE = "__Host-solara_locale";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * GET /api/locale
 * Returns the current locale from the secure cookie
 */
export async function GET(req: NextRequest) {
  const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value;

  const locale: Locale =
    cookieLocale && isValidLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return NextResponse.json({ locale });
}

/**
 * POST /api/locale
 * Sets the locale in the secure httpOnly cookie
 * If signed in: also persists the locale to profiles.language in Supabase.
 *
 * Body: { locale: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { locale } = body ?? {};

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

    // Always set cookie (works for guests + immediate UI switching)
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

    // Best-interest behavior:
    // - If logged in, also persist to Supabase so it's remembered across devices
    // - If anything fails (no session, RLS, transient DB), DO NOT break the user toggle
    try {
      const supabase = await createServerSupabaseClient();
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (user?.id) {
        const { error } = await supabase
          .from("profiles")
          .update({
            language: locale,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);

        if (error) {
          console.warn("[/api/locale] Failed to persist profile language:", {
            userId: user.id,
            error,
          });
        }
      }
    } catch (persistErr) {
      console.warn("[/api/locale] Locale persisted failed (non-fatal):", persistErr);
    }

    return response;
  } catch (error) {
    console.error("[/api/locale] Error:", error);
    return NextResponse.json(
      { error: "Invalid request", message: "Could not parse request body" },
      { status: 400 }
    );
  }
}
