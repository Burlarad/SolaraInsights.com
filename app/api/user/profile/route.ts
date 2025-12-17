import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { getZodiacSign } from "@/lib/zodiac";
import { computeAndStoreBirthChart } from "@/lib/birthChart/storage";
import { touchLastSeen } from "@/lib/activity/touchLastSeen";
import { isValidBirthTimezone } from "@/lib/location/detection";
import tzLookup from "tz-lookup";

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

      // Require lat/lon to be provided (from PlacePicker selection)
      // No more legacy auto-geocoding - PlacePicker is the only valid pathway
      const hasLatLon =
        typeof updates.birth_lat === "number" &&
        typeof updates.birth_lon === "number";

      if (!hasLatLon) {
        return NextResponse.json(
          {
            error: "LocationSelectionRequired",
            message: "Please search and select a place from the dropdown so we can save accurate coordinates.",
            fields: ["birth_city", "birth_region", "birth_country"],
          },
          { status: 400 }
        );
      }

      // Validate lat/lon are in reasonable ranges
      if (
        updates.birth_lat < -90 || updates.birth_lat > 90 ||
        updates.birth_lon < -180 || updates.birth_lon > 180
      ) {
        return NextResponse.json(
          {
            error: "LocationValidationFailed",
            message: "Invalid coordinates provided. Please select a location from the search results.",
            fields: ["birth_city", "birth_region", "birth_country"],
          },
          { status: 400 }
        );
      }

      // Server computes timezone from lat/lon - don't trust client-provided timezone
      let serverTimezone: string;
      try {
        serverTimezone = tzLookup(updates.birth_lat, updates.birth_lon);
      } catch (err) {
        console.error("[Profile] ✗ Failed to compute timezone for coordinates:", {
          lat: updates.birth_lat,
          lon: updates.birth_lon,
        });
        return NextResponse.json(
          {
            error: "LocationValidationFailed",
            message: "Could not determine timezone for the selected location. Please try a different location.",
            fields: ["birth_city", "birth_region", "birth_country"],
          },
          { status: 400 }
        );
      }

      // Validate computed timezone is not UTC (fallback poison)
      if (!isValidBirthTimezone(serverTimezone)) {
        console.error("[Profile] ✗ Computed timezone is UTC - rejecting:", {
          lat: updates.birth_lat,
          lon: updates.birth_lon,
          timezone: serverTimezone,
        });
        return NextResponse.json(
          {
            error: "LocationValidationFailed",
            message: "The selected location appears to be in international waters or an unmapped timezone. Please select a different location.",
            fields: ["birth_city", "birth_region", "birth_country"],
          },
          { status: 400 }
        );
      }

      // Use server-computed timezone (ignore client-provided)
      updates.timezone = serverTimezone;

      console.log("[Profile] ✓ Birthplace validated with server-computed timezone:", {
        city: birthCity,
        region: birthRegion,
        country: birthCountry,
        lat: updates.birth_lat,
        lon: updates.birth_lon,
        timezone: serverTimezone,
      });
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
