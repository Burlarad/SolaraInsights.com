/**
 * Birth Chart Library API (GET + POST)
 *
 * GET: Returns user's astrology shelf (list of checked-out books)
 * POST: Generates/loads a birth chart book
 *
 * POST Modes:
 * 1. Official mode (no payload or mode: "official"): Returns user's official chart from Settings
 * 2. Checkout mode (mode: "checkout"): Generates chart for arbitrary inputs
 * 3. Load mode (mode: "load"): Loads a previously checked-out chart by key
 *
 * CRITICAL: NO noon defaulting. If inputs incomplete, return error.
 *
 * Response Shape (matching old endpoint contract):
 * {
 *   placements: SwissPlacements,   // The math
 *   insight: FullBirthChartInsight | null,  // The narrative
 *   chart_key: string,
 *   is_official: boolean,
 *   mode: "official" | "checkout" | "load"
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getOfficialChartWithNarrative,
  getChartWithNarrative,
  computeOfficialChartKey,
  hasValidNarrative,
  getChartFromLibrary,
} from "@/lib/library/charts";
import { isChartInputComplete, normalizeChartInput, computeChartKey, type ChartInput } from "@/lib/library/keyNormalization";
import { resolveLocaleAuth } from "@/lib/i18n/resolveLocale";
import { checkBurstLimit, checkRateLimit, createRateLimitResponse } from "@/lib/cache/rateLimit";
import { acquireLockFailClosed, releaseLock, getCache, setCache, isRedisAvailable, REDIS_UNAVAILABLE_RESPONSE } from "@/lib/cache/redis";
import { checkBudget, BUDGET_EXCEEDED_RESPONSE } from "@/lib/ai/costControl";
import { NARRATIVE_PROMPT_VERSION } from "@/lib/ai/prompts/soulPath";

// Rate limits matching old /api/birth-chart endpoint
const BURST_LIMIT = 10;
const BURST_WINDOW = 10;
const COOLDOWN_SECONDS = 10;
const USER_RATE_LIMIT = 20;
const USER_RATE_WINDOW = 3600;

/**
 * Build a human-readable label for a checkout book
 */
function buildCheckoutLabel(inputs: { birth_date?: string; birth_city?: string }): string {
  const parts: string[] = [];
  if (inputs.birth_date) {
    const d = new Date(inputs.birth_date + "T00:00:00");
    parts.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
  }
  if (inputs.birth_city) {
    parts.push(inputs.birth_city);
  }
  return parts.join(" \u00b7 ") || "Checkout";
}

/**
 * Upsert a shelf entry for a checked-out book
 */
async function trackCheckout(
  supabase: any,
  userId: string,
  bookKey: string,
  label: string
) {
  await supabase
    .from("library_checkouts")
    .upsert(
      {
        user_id: userId,
        book_type: "astrology",
        book_key: bookKey,
        label,
        last_opened_at: new Date().toISOString(),
      },
      { onConflict: "user_id,book_type,book_key" }
    );
}

/**
 * GET /api/birth-chart-library
 * Returns user's astrology shelf (list of checked-out books)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's astrology shelf
    const { data: shelf } = await supabase
      .from("library_checkouts")
      .select("book_key, label, last_opened_at, created_at")
      .eq("user_id", user.id)
      .eq("book_type", "astrology")
      .order("last_opened_at", { ascending: false });

    // Fetch official key from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("official_astrology_key")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      shelf: shelf || [],
      official_key: profile?.official_astrology_key || null,
    });
  } catch (error: any) {
    console.error("[BirthChartLibrary] GET error:", error);
    return NextResponse.json(
      { error: "Failed to load shelf" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in to view birth charts." },
        { status: 401 }
      );
    }

    // Parse request body (optional - if empty, use official mode)
    const body = await req.json().catch(() => ({}));
    const { mode, inputs, chart_key: requestedChartKey, language: bodyLanguage, birth_city } = body as {
      mode?: "official" | "checkout" | "load";
      inputs?: Partial<ChartInput>;
      chart_key?: string;
      language?: string;
      birth_city?: string;
    };

    // ========================================
    // MODE 1: OFFICIAL CHART (from Settings)
    // ========================================
    if (!mode || mode === "official") {
      // Load user profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(`
          birth_date, birth_time, birth_lat, birth_lon, timezone,
          birth_city, birth_region, birth_country, zodiac_sign,
          preferred_name, full_name, language,
          official_astrology_key
        `)
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        console.error("[BirthChartLibrary] Failed to load profile:", profileError);
        return NextResponse.json(
          {
            errorCode: "PROFILE_LOAD_FAILED",
            error: "PROFILE_LOAD_FAILED",
            message: "Unable to load your profile.",
          },
          { status: 500 }
        );
      }

      // Resolve language (profile → cookie → Accept-Language → cf-ipcountry → "en")
      const language = bodyLanguage || resolveLocaleAuth(req, profile.language);

      // Check if Settings data is complete before proceeding
      const chartKey = computeOfficialChartKey(profile);
      if (!chartKey) {
        return NextResponse.json(
          {
            errorCode: "INCOMPLETE_BIRTH_DATA",
            error: "INCOMPLETE_BIRTH_DATA",
            message: "Complete your birth data in Settings to view your chart.",
            required: ["birth_date", "birth_time", "birth_lat", "birth_lon", "timezone"],
            missing: [
              !profile.birth_date && "birth_date",
              !profile.birth_time && "birth_time",
              profile.birth_lat == null && "birth_lat",
              profile.birth_lon == null && "birth_lon",
              !profile.timezone && "timezone",
            ].filter(Boolean),
          },
          { status: 400 }
        );
      }

      // Pre-check: does library already have a valid narrative? (cache hit = skip rate limits)
      const existingChart = await getChartFromLibrary(chartKey);
      const narrativeCached = existingChart && hasValidNarrative(existingChart, language, NARRATIVE_PROMPT_VERSION);

      // Rate limits + budget only on cache miss (narrative generation needed)
      if (!narrativeCached) {
        // Burst check (bot defense)
        const burstResult = await checkBurstLimit(`chartlib:${user.id}`, BURST_LIMIT, BURST_WINDOW);
        if (!burstResult.success) {
          const retryAfter = Math.ceil((burstResult.resetAt - Date.now()) / 1000);
          return NextResponse.json(
            createRateLimitResponse(retryAfter, "Slow down — your chart is already being generated."),
            { status: 429, headers: { "Retry-After": String(retryAfter) } }
          );
        }

        // Cooldown check
        const cooldownKey = `chartlib:cooldown:${user.id}`;
        const lastRequestTime = await getCache<number>(cooldownKey);
        if (lastRequestTime) {
          const elapsed = Math.floor((Date.now() - lastRequestTime) / 1000);
          const remaining = COOLDOWN_SECONDS - elapsed;
          if (remaining > 0) {
            return NextResponse.json(
              createRateLimitResponse(remaining, "Just a moment — your chart is still loading."),
              { status: 429, headers: { "Retry-After": String(remaining) } }
            );
          }
        }

        // Sustained rate limit (20 generations per hour)
        const rateLimitResult = await checkRateLimit(`chartlib:rate:${user.id}`, USER_RATE_LIMIT, USER_RATE_WINDOW);
        if (!rateLimitResult.success) {
          const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
          return NextResponse.json(
            createRateLimitResponse(retryAfter, `You've reached your hourly limit. Try again in ${Math.ceil(retryAfter / 60)} minutes.`),
            { status: 429, headers: { "Retry-After": String(retryAfter) } }
          );
        }

        // Set cooldown
        await setCache(cooldownKey, Date.now(), COOLDOWN_SECONDS);

        // Redis availability (fail-closed for expensive operations)
        if (!isRedisAvailable()) {
          console.warn("[BirthChartLibrary] Redis unavailable, failing closed");
          return NextResponse.json(REDIS_UNAVAILABLE_RESPONSE, { status: 503 });
        }

        // Budget check
        const budgetCheck = await checkBudget();
        if (!budgetCheck.allowed) {
          console.warn("[BirthChartLibrary] Budget exceeded, rejecting request");
          return NextResponse.json(BUDGET_EXCEEDED_RESPONSE, { status: 503 });
        }
      }

      // Acquire lock to prevent double-generation (no-op if narrative cached)
      const lockKey = `chartlib:lock:${chartKey}:${language}`;
      let lockAcquired = false;
      if (!narrativeCached) {
        const lockResult = await acquireLockFailClosed(lockKey, 60);
        if (!lockResult.acquired) {
          if (lockResult.redisDown) {
            return NextResponse.json(REDIS_UNAVAILABLE_RESPONSE, { status: 503 });
          }
          // Another request is generating — return 429
          return NextResponse.json(
            createRateLimitResponse(10, "Your chart is being generated — please wait."),
            { status: 429, headers: { "Retry-After": "10" } }
          );
        }
        lockAcquired = true;
      }

      try {
        // Get official chart with narrative (generates if needed)
        const chart = await getOfficialChartWithNarrative(user.id, profile, language);

        if (!chart) {
          return NextResponse.json(
            {
              errorCode: "INCOMPLETE_BIRTH_DATA",
              error: "INCOMPLETE_BIRTH_DATA",
              message: "Complete your birth data in Settings to view your chart.",
            },
            { status: 400 }
          );
        }

        // Track on shelf (non-blocking)
        void trackCheckout(supabase, user.id, chart.chart_key, "Official");

        // Return official chart with correct field names
        return NextResponse.json({
          placements: chart.geometry_json,  // Frontend expects "placements"
          insight: chart.narrative_json,    // Frontend expects "insight"
          chart_key: chart.chart_key,
          is_official: true,
          mode: "official",
        });
      } finally {
        if (lockAcquired) {
          await releaseLock(lockKey);
        }
      }
    }

    // ========================================
    // MODE 2: CHECKOUT CHART (arbitrary inputs)
    // ========================================
    // "Checkout" = checking out another book from the library
    // Ephemeral - does not update user's official pointer
    if (mode === "checkout") {
      if (!inputs) {
        return NextResponse.json(
          { error: "Bad request", message: "Checkout mode requires 'inputs' field." },
          { status: 400 }
        );
      }

      // Validate inputs are complete
      if (!isChartInputComplete(inputs)) {
        return NextResponse.json(
          {
            errorCode: "INCOMPLETE_CHECKOUT_DATA",
            error: "INCOMPLETE_CHECKOUT_DATA",
            message: "All fields required for chart computation.",
            required: ["birth_date", "birth_time", "birth_lat", "birth_lon", "timezone"],
            missing: [
              !inputs.birth_date && "birth_date",
              !inputs.birth_time && "birth_time",
              inputs.birth_lat == null && "birth_lat",
              inputs.birth_lon == null && "birth_lon",
              !inputs.timezone && "timezone",
            ].filter(Boolean),
          },
          { status: 400 }
        );
      }

      // Load profile for language resolution
      const { data: profile } = await supabase
        .from("profiles")
        .select("language, preferred_name, full_name")
        .eq("id", user.id)
        .single();

      // Resolve language
      const language = bodyLanguage || resolveLocaleAuth(req, profile?.language);
      const displayName = profile?.preferred_name || profile?.full_name || null;

      // Pre-check: compute chart key and check if narrative already cached
      const normalized = normalizeChartInput(inputs);
      const chartKey = computeChartKey(normalized);
      const existingChart = await getChartFromLibrary(chartKey);
      const narrativeCached = existingChart && hasValidNarrative(existingChart, language, NARRATIVE_PROMPT_VERSION);

      // Rate limits + budget only on cache miss
      if (!narrativeCached) {
        // Burst check (bot defense)
        const burstResult = await checkBurstLimit(`chartlib:${user.id}`, BURST_LIMIT, BURST_WINDOW);
        if (!burstResult.success) {
          const retryAfter = Math.ceil((burstResult.resetAt - Date.now()) / 1000);
          return NextResponse.json(
            createRateLimitResponse(retryAfter, "Slow down — your chart is already being generated."),
            { status: 429, headers: { "Retry-After": String(retryAfter) } }
          );
        }

        // Cooldown check
        const cooldownKey = `chartlib:cooldown:${user.id}`;
        const lastRequestTime = await getCache<number>(cooldownKey);
        if (lastRequestTime) {
          const elapsed = Math.floor((Date.now() - lastRequestTime) / 1000);
          const remaining = COOLDOWN_SECONDS - elapsed;
          if (remaining > 0) {
            return NextResponse.json(
              createRateLimitResponse(remaining, "Just a moment — your chart is still loading."),
              { status: 429, headers: { "Retry-After": String(remaining) } }
            );
          }
        }

        // Sustained rate limit (20 generations per hour)
        const rateLimitResult = await checkRateLimit(`chartlib:rate:${user.id}`, USER_RATE_LIMIT, USER_RATE_WINDOW);
        if (!rateLimitResult.success) {
          const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
          return NextResponse.json(
            createRateLimitResponse(retryAfter, `You've reached your hourly limit. Try again in ${Math.ceil(retryAfter / 60)} minutes.`),
            { status: 429, headers: { "Retry-After": String(retryAfter) } }
          );
        }

        // Set cooldown
        await setCache(cooldownKey, Date.now(), COOLDOWN_SECONDS);

        // Redis availability (fail-closed)
        if (!isRedisAvailable()) {
          console.warn("[BirthChartLibrary] Redis unavailable, failing closed");
          return NextResponse.json(REDIS_UNAVAILABLE_RESPONSE, { status: 503 });
        }

        // Budget check
        const budgetCheck = await checkBudget();
        if (!budgetCheck.allowed) {
          console.warn("[BirthChartLibrary] Budget exceeded, rejecting request");
          return NextResponse.json(BUDGET_EXCEEDED_RESPONSE, { status: 503 });
        }
      }

      // Acquire lock to prevent double-generation
      const lockKey = `chartlib:lock:${chartKey}:${language}`;
      let lockAcquired = false;
      if (!narrativeCached) {
        const lockResult = await acquireLockFailClosed(lockKey, 60);
        if (!lockResult.acquired) {
          if (lockResult.redisDown) {
            return NextResponse.json(REDIS_UNAVAILABLE_RESPONSE, { status: 503 });
          }
          return NextResponse.json(
            createRateLimitResponse(10, "Your chart is being generated — please wait."),
            { status: 429, headers: { "Retry-After": "10" } }
          );
        }
        lockAcquired = true;
      }

      try {
        // Get chart with narrative from global library
        const chart = await getChartWithNarrative(
          inputs,
          language,
          displayName,
          {
            birth_date: inputs.birth_date,
            birth_time: inputs.birth_time,
            timezone: inputs.timezone,
          }
        );

        // Track on shelf (non-blocking)
        const checkoutLabel = buildCheckoutLabel({
          birth_date: inputs.birth_date,
          birth_city: birth_city || undefined,
        });
        void trackCheckout(supabase, user.id, chart.chart_key, checkoutLabel);

        // Return checkout chart with correct field names
        return NextResponse.json({
          placements: chart.geometry_json,  // Frontend expects "placements"
          insight: chart.narrative_json,    // Frontend expects "insight"
          chart_key: chart.chart_key,
          is_official: false,
          mode: "checkout",
        });
      } finally {
        if (lockAcquired) {
          await releaseLock(lockKey);
        }
      }
    }

    // ========================================
    // MODE 3: LOAD (previously checked-out book)
    // ========================================
    // Read-only — no Swiss Ephemeris, no AI, no rate limiting
    if (mode === "load") {
      if (!requestedChartKey) {
        return NextResponse.json(
          { error: "Bad request", message: "Load mode requires 'chart_key' field." },
          { status: 400 }
        );
      }

      // Verify the book is on the user's shelf (ownership check)
      const { data: shelfEntry } = await supabase
        .from("library_checkouts")
        .select("book_key")
        .eq("user_id", user.id)
        .eq("book_type", "astrology")
        .eq("book_key", requestedChartKey)
        .maybeSingle();

      if (!shelfEntry) {
        return NextResponse.json(
          { error: "Not found", message: "This book is not on your shelf." },
          { status: 404 }
        );
      }

      // Load from global library
      const chart = await getChartFromLibrary(requestedChartKey);
      if (!chart) {
        return NextResponse.json(
          { error: "Not found", message: "Chart data not found in library." },
          { status: 404 }
        );
      }

      // Update last_opened_at (non-blocking)
      void supabase
        .from("library_checkouts")
        .update({ last_opened_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("book_type", "astrology")
        .eq("book_key", requestedChartKey);

      // Determine if this is the official chart
      const { data: profile } = await supabase
        .from("profiles")
        .select("official_astrology_key")
        .eq("id", user.id)
        .single();

      const isOfficial = profile?.official_astrology_key === requestedChartKey;

      return NextResponse.json({
        placements: chart.geometry_json,
        insight: chart.narrative_json,
        chart_key: chart.chart_key,
        is_official: isOfficial,
        mode: "load",
      });
    }

    return NextResponse.json(
      { error: "Bad request", message: "Invalid mode. Use 'official', 'checkout', or 'load'." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[BirthChartLibrary] Error:", error);

    // Handle specific errors
    if (error.message?.includes("Incomplete birth data")) {
      return NextResponse.json(
        { errorCode: "INCOMPLETE_DATA", error: "INCOMPLETE_DATA", message: error.message },
        { status: 400 }
      );
    }

    if (error.message?.includes("Invalid")) {
      return NextResponse.json(
        { errorCode: "INVALID_INPUT", error: "INVALID_INPUT", message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { errorCode: "INTERNAL_ERROR", error: "INTERNAL_ERROR", message: "Failed to generate birth chart. Please try again." },
      { status: 500 }
    );
  }
}
