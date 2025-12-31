import { NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { getLuckyNumbers } from "@/lib/numerology/storage";
import { formatLuckyNumbersForUI } from "@/lib/numerology";
import { touchLastSeen } from "@/lib/activity/touchLastSeen";
import type { NumerologySystem, LuckyNumbersResponse } from "@/types/numerology";

/**
 * GET /api/numerology/lucky
 *
 * Returns the user's lucky numbers derived from their numerology profile.
 * Optimized endpoint for the Insights tab's Lucky Compass integration.
 *
 * Query params:
 * - system: "pythagorean" | "chaldean" (default: "pythagorean")
 *
 * Response:
 * - luckyNumbers: { primary, secondary, all }
 * - formatted: Array of { value, label, meaning } for UI display
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
          message: "Please sign in to view your lucky numbers.",
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
      console.error("[Numerology/Lucky] Profile not found for user", user.id, profileError);
      return NextResponse.json(
        {
          error: "Profile not found",
          message: "Unable to load your profile. Please try again.",
        },
        { status: 404 }
      );
    }

    // Check for required name fields (used for numerology calculations)
    // If name is not set, return null (Insights tab will fall back to AI-generated)
    if (!profile.first_name || !profile.last_name) {
      console.log(`[Numerology/Lucky] Name not set for user ${user.id}, returning null`);
      return NextResponse.json({
        luckyNumbers: null,
        formatted: null,
        fromCache: false,
        reason: "Name required for numerology-based lucky numbers",
      });
    }

    // Check for required birth date
    if (!profile.birth_date) {
      console.log(`[Numerology/Lucky] Birth date not set for user ${user.id}, returning null`);
      return NextResponse.json({
        luckyNumbers: null,
        formatted: null,
        fromCache: false,
        reason: "Birth date required for numerology-based lucky numbers",
      });
    }

    // Get lucky numbers from numerology profile
    const luckyNumbers = await getLuckyNumbers(user.id, profile, system);

    // Format for UI display
    const formatted = formatLuckyNumbersForUI(luckyNumbers);

    console.log(
      `[Numerology/Lucky] Returning lucky numbers for user ${user.id}: [${luckyNumbers.all.join(", ")}]`
    );

    return NextResponse.json({
      luckyNumbers,
      formatted,
      fromCache: true, // Lucky numbers are always from the cached numerology profile
    });
  } catch (error: any) {
    console.error("[Numerology/Lucky] Error fetching lucky numbers:", error);
    return NextResponse.json(
      {
        error: "Fetch failed",
        message: "We couldn't load your lucky numbers. Please try again in a moment.",
      },
      { status: 500 }
    );
  }
}
