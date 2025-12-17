import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { getZodiacSign } from "@/lib/zodiac";
import { resolveBirthLocation } from "@/lib/location/resolveBirthLocation";
import { computeAndStoreBirthChart } from "@/lib/birthChart/storage";
import { touchLastSeen } from "@/lib/activity/touchLastSeen";

export async function PATCH(req: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in to update your profile." },
        { status: 401 }
      );
    }

    // Track user activity (non-blocking)
    const admin = createAdminSupabaseClient();
    void touchLastSeen(admin, user.id, 30);

    // Parse request body
    const updates = await req.json();

    // Auto-calculate zodiac sign if birth_date is provided
    if (updates.birth_date) {
      const sign = getZodiacSign(updates.birth_date);
      if (sign) {
        updates.zodiac_sign = sign;
      }
    }

    // Check if request is attempting to change birthplace fields
    const isTouchingBirthplace =
      updates.birth_city !== undefined ||
      updates.birth_region !== undefined ||
      updates.birth_country !== undefined;

    // If touching birthplace, require all 3 fields to be present and non-empty
    if (isTouchingBirthplace) {
      const birthCity = updates.birth_city?.trim();
      const birthRegion = updates.birth_region?.trim();
      const birthCountry = updates.birth_country?.trim();

      if (!birthCity || !birthRegion || !birthCountry) {
        return NextResponse.json(
          {
            error: "LocationValidationFailed",
            message: "Birth location requires city, region, and country. Please fill in all fields.",
            fields: ["birth_city", "birth_region", "birth_country"],
          },
          { status: 400 }
        );
      }

      // Also require birth_date when setting birthplace
      if (!updates.birth_date) {
        return NextResponse.json(
          {
            error: "LocationValidationFailed",
            message: "Birth date is required when setting birth location.",
            fields: ["birth_date"],
          },
          { status: 400 }
        );
      }

      // Attempt to resolve birth location - MUST succeed to save birthplace changes
      const timeForLocation =
        updates.birth_time && typeof updates.birth_time === "string"
          ? updates.birth_time
          : "12:00";

      console.log("[Profile] Attempting to resolve birth location...");

      try {
        const resolved = await resolveBirthLocation({
          city: birthCity,
          region: birthRegion,
          country: birthCountry,
          birthDate: updates.birth_date,
          birthTime: timeForLocation,
        });

        updates.birth_lat = resolved.lat;
        updates.birth_lon = resolved.lon;
        updates.timezone = resolved.timezone;

        console.log("[Profile] ✓ Birth location resolved successfully:", {
          city: birthCity,
          region: birthRegion,
          country: birthCountry,
          lat: resolved.lat,
          lon: resolved.lon,
          timezone: resolved.timezone,
        });
      } catch (err: any) {
        console.error(
          "[Profile] ✗ Failed to resolve birth location:",
          err?.message || err
        );
        console.error("[Profile] Location input:", {
          city: birthCity,
          region: birthRegion,
          country: birthCountry,
        });

        // HARD FAIL: Return 400 and do NOT save the profile
        return NextResponse.json(
          {
            error: "LocationResolutionFailed",
            message: `We couldn't find "${birthCity}, ${birthRegion}, ${birthCountry}". Please check the spelling and try again. Use English names for best results (e.g., "Peru" not "Perú").`,
            fields: ["birth_city", "birth_region", "birth_country"],
          },
          { status: 400 }
        );
      }
    }

    // Update profile in database
    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("[Profile] Database update error:", updateError);
      throw updateError;
    }

    console.log(`[Profile] Profile updated successfully for user ${user.id}`);

    // STEP: Recompute birth chart if birth data changed
    // Only compute if we have complete birth data (date + geocoded location)
    const hasCompleteBirthData =
      updatedProfile.birth_date &&
      updatedProfile.birth_lat &&
      updatedProfile.birth_lon &&
      updatedProfile.timezone;

    if (hasCompleteBirthData) {
      try {
        console.log("[Profile] Recomputing birth chart after profile update...");
        await computeAndStoreBirthChart(user.id, {
          birth_date: updatedProfile.birth_date,
          birth_time: updatedProfile.birth_time,
          birth_lat: updatedProfile.birth_lat,
          birth_lon: updatedProfile.birth_lon,
          timezone: updatedProfile.timezone,
        });
        console.log("[Profile] ✓ Birth chart recomputed and stored");
      } catch (chartError: any) {
        // Log error but don't block profile update response
        console.error("[Profile] ✗ Failed to recompute birth chart:", chartError.message);
        console.warn("[Profile] Chart will be computed on next birth chart page load");
      }
    }

    return NextResponse.json({
      profile: updatedProfile,
    });
  } catch (error: any) {
    console.error("[Profile] Error updating profile:", error);
    return NextResponse.json(
      {
        error: "Update failed",
        message: error.message || "Failed to update profile. Please try again.",
      },
      { status: 500 }
    );
  }
}
