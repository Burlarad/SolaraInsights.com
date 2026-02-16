/**
 * Numerology Library API (GET + POST)
 *
 * GET: Returns user's numerology shelf (list of checked-out books)
 * POST: Generates/loads a numerology book
 *
 * POST Modes:
 * 1. Official mode (mode: "official"): Returns user's official numerology from Settings
 * 2. Checkout mode (mode: "checkout"): Generates book for arbitrary inputs
 * 3. Load mode (mode: "load"): Loads a previously checked-out book by key
 *
 * Response Shape:
 * {
 *   numerology: NumerologyComputeResult,   // The math
 *   narrative: NumerologyNarrative | null,  // The narrative
 *   cycles: CycleNumbers,                  // Current personal cycles
 *   numerology_key: string,
 *   is_official: boolean,
 *   mode: "official" | "checkout" | "load",
 *   system: string
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getOfficialNumerology,
  getOrComputeNumerology,
  getNumerologyFromLibrary,
  computeOfficialNumerologyKey,
  parseFullName,
  type NumerologyLibraryEntry,
} from "@/lib/library/numerology";
import {
  computeNumerologyKey,
  normalizeNumerologyInput,
  isNumerologyInputComplete,
  type NumerologyInput,
} from "@/lib/library/keyNormalization";
import {
  computeNumerologyProfile as computeMath,
} from "@/lib/numerology/index";
import { computeCycles } from "@/lib/numerology/cycles";
import {
  ensureNumerologyNarrative,
  NUMEROLOGY_NARRATIVE_PROMPT_VERSION,
} from "@/lib/library/numerologyNarrative";
import { resolveLocaleAuth } from "@/lib/i18n/resolveLocale";
import { checkBurstLimit, checkRateLimit, createRateLimitResponse } from "@/lib/cache/rateLimit";
import { getCache, setCache, isRedisAvailable, REDIS_UNAVAILABLE_RESPONSE } from "@/lib/cache/redis";
import { checkBudget, BUDGET_EXCEEDED_RESPONSE } from "@/lib/ai/costControl";

// Rate limits (match astrology)
const BURST_LIMIT = 10;
const BURST_WINDOW = 10;
const COOLDOWN_SECONDS = 10;
const USER_RATE_LIMIT = 20;
const USER_RATE_WINDOW = 3600;

/**
 * Build a human-readable label for a checkout book
 */
function buildCheckoutLabel(inputs: {
  birth_date?: string;
  system?: string;
  name?: string;
}): string {
  const parts: string[] = [];
  if (inputs.birth_date) {
    const d = new Date(inputs.birth_date + "T00:00:00");
    parts.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
  }
  if (inputs.system) {
    parts.push(inputs.system.charAt(0).toUpperCase() + inputs.system.slice(1));
  }
  if (inputs.name) {
    // Abbreviate: "John David Smith" -> "John S"
    const nameParts = inputs.name.trim().split(/\s+/);
    if (nameParts.length > 1) {
      parts.push(`${nameParts[0]} ${nameParts[nameParts.length - 1][0]}`);
    } else {
      parts.push(nameParts[0]);
    }
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
        book_type: "numerology",
        book_key: bookKey,
        label,
        last_opened_at: new Date().toISOString(),
      },
      { onConflict: "user_id,book_type,book_key" }
    );
}

/**
 * Check if a library entry has a valid (current) narrative
 */
function hasValidNarrative(
  entry: NumerologyLibraryEntry,
  language: string
): boolean {
  return (
    !!entry.narrative_json &&
    entry.narrative_prompt_version === NUMEROLOGY_NARRATIVE_PROMPT_VERSION &&
    entry.narrative_language === language
  );
}

/**
 * Build the standard response from a library entry
 */
function buildResponse(
  entry: NumerologyLibraryEntry,
  narrative: any,
  isOfficial: boolean,
  mode: string,
  cycles: any
) {
  return {
    numerology: entry.numerology_json,
    narrative: narrative || entry.narrative_json || null,
    cycles,
    numerology_key: entry.numerology_key,
    input: entry.input_json,
    is_official: isOfficial,
    mode,
    system: entry.system,
  };
}

// ============================================================================
// GET — shelf
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: shelf } = await supabase
      .from("library_checkouts")
      .select("book_key, label, last_opened_at, created_at")
      .eq("user_id", user.id)
      .eq("book_type", "numerology")
      .order("last_opened_at", { ascending: false });

    const { data: profile } = await supabase
      .from("profiles")
      .select("official_numerology_key")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      shelf: shelf || [],
      official_key: profile?.official_numerology_key || null,
    });
  } catch (error: any) {
    console.error("[NumerologyLibrary] GET error:", error);
    return NextResponse.json(
      { error: "Failed to load shelf" },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST — official / checkout / load
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in to view numerology." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      mode,
      input,
      book_key: requestedBookKey,
      system: requestedSystem,
      language: bodyLanguage,
    } = body as {
      mode?: "official" | "checkout" | "load";
      input?: {
        birth_date?: string;
        full_name?: string;
        first_name?: string;
        middle_name?: string;
        last_name?: string;
      };
      book_key?: string;
      system?: "pythagorean" | "chaldean";
      language?: string;
    };

    const system = requestedSystem || "pythagorean";

    // ========================================
    // MODE 1: OFFICIAL
    // ========================================
    if (!mode || mode === "official") {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(`
          full_name, first_name, middle_name, last_name,
          birth_date, language,
          official_numerology_key
        `)
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        return NextResponse.json(
          { errorCode: "PROFILE_LOAD_FAILED", message: "Unable to load your profile." },
          { status: 500 }
        );
      }

      const language = bodyLanguage || resolveLocaleAuth(req, profile.language);

      // Need full_name and birth_date for numerology
      if (!profile.full_name && !(profile.first_name && profile.last_name)) {
        return NextResponse.json(
          {
            errorCode: "MISSING_NAME",
            error: "MISSING_NAME",
            message: "Complete your name in Settings to view your numerology.",
          },
          { status: 400 }
        );
      }

      if (!profile.birth_date) {
        return NextResponse.json(
          {
            errorCode: "MISSING_BIRTH_DATE",
            error: "MISSING_BIRTH_DATE",
            message: "Complete your birth date in Settings to view your numerology.",
          },
          { status: 400 }
        );
      }

      // Build full_name from parts if needed
      const fullName = profile.full_name ||
        [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ");

      // Pre-check: does library already have a valid narrative?
      const officialKey = computeOfficialNumerologyKey({ full_name: fullName, birth_date: profile.birth_date });
      let existingEntry: NumerologyLibraryEntry | null = null;
      if (officialKey) {
        existingEntry = await getNumerologyFromLibrary(officialKey);
      }
      const narrativeCached = existingEntry && hasValidNarrative(existingEntry, language);

      // Rate limits + budget only on cache miss
      if (!narrativeCached) {
        const burstResult = await checkBurstLimit(`numlib:${user.id}`, BURST_LIMIT, BURST_WINDOW);
        if (!burstResult.success) {
          const retryAfter = Math.ceil((burstResult.resetAt - Date.now()) / 1000);
          return NextResponse.json(
            createRateLimitResponse(retryAfter, "Slow down — your numerology is already being generated."),
            { status: 429, headers: { "Retry-After": String(retryAfter) } }
          );
        }

        const cooldownKey = `numlib:cooldown:${user.id}`;
        const lastRequestTime = await getCache<number>(cooldownKey);
        if (lastRequestTime) {
          const elapsed = Math.floor((Date.now() - lastRequestTime) / 1000);
          const remaining = COOLDOWN_SECONDS - elapsed;
          if (remaining > 0) {
            return NextResponse.json(
              createRateLimitResponse(remaining, "Just a moment — your numerology is still loading."),
              { status: 429, headers: { "Retry-After": String(remaining) } }
            );
          }
        }

        const rateLimitResult = await checkRateLimit(`numlib:rate:${user.id}`, USER_RATE_LIMIT, USER_RATE_WINDOW);
        if (!rateLimitResult.success) {
          const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
          return NextResponse.json(
            createRateLimitResponse(retryAfter, `Hourly limit reached. Try again in ${Math.ceil(retryAfter / 60)} minutes.`),
            { status: 429, headers: { "Retry-After": String(retryAfter) } }
          );
        }

        await setCache(`numlib:cooldown:${user.id}`, Date.now(), COOLDOWN_SECONDS);

        if (!isRedisAvailable()) {
          return NextResponse.json(REDIS_UNAVAILABLE_RESPONSE, { status: 503 });
        }

        const budgetCheck = await checkBudget();
        if (!budgetCheck.allowed) {
          return NextResponse.json(BUDGET_EXCEEDED_RESPONSE, { status: 503 });
        }
      }

      // Get or compute official numerology
      const entry = await getOfficialNumerology(
        user.id,
        { full_name: fullName, birth_date: profile.birth_date, official_numerology_key: profile.official_numerology_key },
        system
      );

      if (!entry) {
        return NextResponse.json(
          { errorCode: "INCOMPLETE_BIRTH_DATA", message: "Complete your profile in Settings." },
          { status: 400 }
        );
      }

      // Ensure narrative exists
      const displayName = fullName;
      const narrative = await ensureNumerologyNarrative(
        entry.numerology_key,
        entry.numerology_json,
        entry.input_json,
        entry.system,
        language,
        displayName,
        entry.narrative_json,
        entry.narrative_prompt_version,
        entry.narrative_language
      );

      // Compute cycles
      const today = new Date().toISOString().split("T")[0];
      const cycles = computeCycles({
        birthDate: profile.birth_date,
        currentDate: today,
        lifePathNumber: entry.numerology_json.coreNumbers.lifePath.value,
      });

      // Track on shelf
      void trackCheckout(supabase, user.id, entry.numerology_key, "Official");

      return NextResponse.json(buildResponse(entry, narrative, true, "official", cycles));
    }

    // ========================================
    // MODE 2: CHECKOUT
    // ========================================
    if (mode === "checkout") {
      if (!input) {
        return NextResponse.json(
          { error: "Bad request", message: "Checkout mode requires 'input' field." },
          { status: 400 }
        );
      }

      // Parse name: accept full_name or first/last
      let firstName = input.first_name;
      let middleName = input.middle_name;
      let lastName = input.last_name;

      if (!firstName && input.full_name) {
        const parsed = parseFullName(input.full_name);
        firstName = parsed.firstName;
        middleName = parsed.middleName;
        lastName = parsed.lastName;
      }

      if (!firstName || !lastName) {
        return NextResponse.json(
          { errorCode: "MISSING_NAME", message: "Name is required (first + last, or full_name)." },
          { status: 400 }
        );
      }

      if (!input.birth_date) {
        return NextResponse.json(
          { errorCode: "MISSING_BIRTH_DATE", message: "Birth date is required." },
          { status: 400 }
        );
      }

      // Build language
      const { data: profileLang } = await supabase
        .from("profiles")
        .select("language")
        .eq("id", user.id)
        .single();
      const language = bodyLanguage || resolveLocaleAuth(req, profileLang?.language);

      // Pre-check: does library have a valid narrative for this input?
      let preCheckKey: string | null = null;
      let existingEntry: NumerologyLibraryEntry | null = null;
      try {
        const normalized = normalizeNumerologyInput({
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          birth_date: input.birth_date,
        });
        preCheckKey = computeNumerologyKey(normalized);
        existingEntry = await getNumerologyFromLibrary(preCheckKey);
      } catch { /* ignore normalization errors for pre-check */ }

      const narrativeCached = existingEntry && hasValidNarrative(existingEntry, language);

      // Rate limits + budget only on cache miss
      if (!narrativeCached) {
        const burstResult = await checkBurstLimit(`numlib:${user.id}`, BURST_LIMIT, BURST_WINDOW);
        if (!burstResult.success) {
          const retryAfter = Math.ceil((burstResult.resetAt - Date.now()) / 1000);
          return NextResponse.json(
            createRateLimitResponse(retryAfter, "Slow down — please wait before generating another book."),
            { status: 429, headers: { "Retry-After": String(retryAfter) } }
          );
        }

        const cooldownKey = `numlib:cooldown:${user.id}`;
        const lastRequestTime = await getCache<number>(cooldownKey);
        if (lastRequestTime) {
          const elapsed = Math.floor((Date.now() - lastRequestTime) / 1000);
          const remaining = COOLDOWN_SECONDS - elapsed;
          if (remaining > 0) {
            return NextResponse.json(
              createRateLimitResponse(remaining, "Just a moment — your book is still being written."),
              { status: 429, headers: { "Retry-After": String(remaining) } }
            );
          }
        }

        const rateLimitResult = await checkRateLimit(`numlib:rate:${user.id}`, USER_RATE_LIMIT, USER_RATE_WINDOW);
        if (!rateLimitResult.success) {
          const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
          return NextResponse.json(
            createRateLimitResponse(retryAfter, `Hourly limit reached. Try again in ${Math.ceil(retryAfter / 60)} minutes.`),
            { status: 429, headers: { "Retry-After": String(retryAfter) } }
          );
        }

        await setCache(`numlib:cooldown:${user.id}`, Date.now(), COOLDOWN_SECONDS);

        if (!isRedisAvailable()) {
          return NextResponse.json(REDIS_UNAVAILABLE_RESPONSE, { status: 503 });
        }

        const budgetCheck = await checkBudget();
        if (!budgetCheck.allowed) {
          return NextResponse.json(BUDGET_EXCEEDED_RESPONSE, { status: 503 });
        }
      }

      // Get or compute numerology
      const entry = await getOrComputeNumerology(
        {
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          birth_date: input.birth_date,
        },
        system
      );

      // Ensure narrative
      const displayName = input.full_name || [firstName, middleName, lastName].filter(Boolean).join(" ");
      const narrative = await ensureNumerologyNarrative(
        entry.numerology_key,
        entry.numerology_json,
        entry.input_json,
        entry.system,
        language,
        displayName,
        entry.narrative_json,
        entry.narrative_prompt_version,
        entry.narrative_language
      );

      // Compute cycles
      const today = new Date().toISOString().split("T")[0];
      const cycles = computeCycles({
        birthDate: input.birth_date,
        currentDate: today,
        lifePathNumber: entry.numerology_json.coreNumbers.lifePath.value,
      });

      // Track on shelf
      const label = buildCheckoutLabel({
        birth_date: input.birth_date,
        system,
        name: displayName,
      });
      void trackCheckout(supabase, user.id, entry.numerology_key, label);

      // Determine if this happens to be the official chart
      const { data: profileCheck } = await supabase
        .from("profiles")
        .select("official_numerology_key")
        .eq("id", user.id)
        .single();
      const isOfficial = profileCheck?.official_numerology_key === entry.numerology_key;

      return NextResponse.json(buildResponse(entry, narrative, isOfficial, "checkout", cycles));
    }

    // ========================================
    // MODE 3: LOAD (previously checked-out book)
    // ========================================
    if (mode === "load") {
      if (!requestedBookKey) {
        return NextResponse.json(
          { error: "Bad request", message: "Load mode requires 'book_key' field." },
          { status: 400 }
        );
      }

      // Verify the book is on the user's shelf (ownership check)
      const { data: shelfEntry } = await supabase
        .from("library_checkouts")
        .select("book_key")
        .eq("user_id", user.id)
        .eq("book_type", "numerology")
        .eq("book_key", requestedBookKey)
        .maybeSingle();

      if (!shelfEntry) {
        return NextResponse.json(
          { error: "Not found", message: "This book is not on your shelf." },
          { status: 404 }
        );
      }

      // Load from global library (admin client via helper)
      const entry = await getNumerologyFromLibrary(requestedBookKey);
      if (!entry) {
        return NextResponse.json(
          { error: "Not found", message: "Book data not found in library." },
          { status: 404 }
        );
      }

      // Ensure narrative (generate if missing/outdated, no rate limiting for load)
      const { data: profileLang } = await supabase
        .from("profiles")
        .select("language")
        .eq("id", user.id)
        .single();
      const language = bodyLanguage || resolveLocaleAuth(req, profileLang?.language);

      const displayName = entry.input_json
        ? [entry.input_json.first_name, entry.input_json.middle_name, entry.input_json.last_name]
            .filter(Boolean)
            .join(" ")
        : null;

      const narrative = await ensureNumerologyNarrative(
        entry.numerology_key,
        entry.numerology_json,
        entry.input_json,
        entry.system,
        language,
        displayName,
        entry.narrative_json,
        entry.narrative_prompt_version,
        entry.narrative_language
      );

      // Compute cycles
      const today = new Date().toISOString().split("T")[0];
      const cycles = computeCycles({
        birthDate: entry.input_json.birth_date,
        currentDate: today,
        lifePathNumber: entry.numerology_json.coreNumbers.lifePath.value,
      });

      // Update last_opened_at (non-blocking)
      void supabase
        .from("library_checkouts")
        .update({ last_opened_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("book_type", "numerology")
        .eq("book_key", requestedBookKey);

      // Determine if official
      const { data: profileCheck } = await supabase
        .from("profiles")
        .select("official_numerology_key")
        .eq("id", user.id)
        .single();
      const isOfficial = profileCheck?.official_numerology_key === requestedBookKey;

      return NextResponse.json(buildResponse(entry, narrative, isOfficial, "load", cycles));
    }

    return NextResponse.json(
      { error: "Bad request", message: "Invalid mode. Use 'official', 'checkout', or 'load'." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[NumerologyLibrary] Error:", error);

    if (error.message?.includes("Incomplete numerology data")) {
      return NextResponse.json(
        { errorCode: "INCOMPLETE_DATA", message: "Please provide complete name and birth date." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { errorCode: "INTERNAL_ERROR", message: "Failed to generate numerology. Please try again." },
      { status: 500 }
    );
  }
}
