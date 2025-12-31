import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { getOrComputeNumerologyProfile } from "@/lib/numerology/storage";
import { computeCycles } from "@/lib/numerology";
import { touchLastSeen } from "@/lib/activity/touchLastSeen";
import type { NumerologySystem, NumerologyResponse } from "@/types/numerology";

/**
 * GET /api/numerology
 *
 * Returns the user's numerology profile with current cycle numbers.
 *
 * Query params:
 * - system: "pythagorean" | "chaldean" (default: "pythagorean")
 *
 * Response:
 * - profile: Complete NumerologyProfile (stone tablet - cached forever)
 * - cycles: Current Personal Year/Month/Day (computed fresh)
 * - fromCache: Whether the profile was loaded from cache
 */
export async function GET(request: Request) {
  try {
    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Please sign in to view your numerology profile.",
        },
        { status: 401 }
      );
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const system = (searchParams.get("system") as NumerologySystem) || "pythagorean";

    // Validate system
    if (system !== "pythagorean" && system !== "chaldean") {
      return NextResponse.json(
        {
          error: "Invalid system",
          message: "System must be 'pythagorean' or 'chaldean'.",
        },
        { status: 400 }
      );
    }

    // Track user activity (non-blocking)
    const admin = createAdminSupabaseClient();
    void touchLastSeen(admin, user.id, 30);

    // Load user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("[Numerology] Profile not found for user", user.id, profileError);
      return NextResponse.json(
        {
          error: "Profile not found",
          message: "Unable to load your profile. Please try again.",
        },
        { status: 404 }
      );
    }

    // Check for required name fields (used for numerology calculations)
    if (!profile.first_name || !profile.last_name) {
      return NextResponse.json(
        {
          error: "Incomplete profile",
          message:
            "We need your name to calculate your numerology profile. Please add your first and last name in Settings.",
          code: "MISSING_NAME",
        },
        { status: 400 }
      );
    }

    // Check for required birth date
    if (!profile.birth_date) {
      return NextResponse.json(
        {
          error: "Incomplete profile",
          message:
            "We need your birth date to calculate your numerology profile. Please add your birth date in Settings.",
          code: "MISSING_BIRTH_DATE",
        },
        { status: 400 }
      );
    }

    // Get or compute numerology profile
    const numerologyProfile = await getOrComputeNumerologyProfile(user.id, profile, system);

    // Compute current cycles (these change daily)
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const cycles = computeCycles({
      birthDate: profile.birth_date,
      currentDate: today,
      lifePathNumber: numerologyProfile.coreNumbers.lifePath.value,
    });

    // Determine if this was a cache hit
    // If the profile was just created, updatedAt will be very recent
    const profileAge = Date.now() - new Date(numerologyProfile.updatedAt).getTime();
    const fromCache = profileAge > 1000; // More than 1 second old = from cache

    console.log(
      `[Numerology] Returning profile for user ${user.id} (system: ${system}, fromCache: ${fromCache})`
    );

    const response: NumerologyResponse = {
      profile: numerologyProfile,
      cycles,
      fromCache,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("[Numerology] Error fetching numerology profile:", error);
    return NextResponse.json(
      {
        error: "Fetch failed",
        message: "We couldn't load your numerology profile. Please try again in a moment.",
      },
      { status: 500 }
    );
  }
}
