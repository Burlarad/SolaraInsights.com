import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveBirthLocation } from "@/lib/location/resolveBirthLocation";
import { getZodiacSign } from "@/lib/zodiac";

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

    // Parse request body
    const updates = await req.json();

    // Auto-calculate zodiac sign if birth_date is provided
    if (updates.birth_date) {
      const sign = getZodiacSign(updates.birth_date);
      if (sign) {
        updates.zodiac_sign = sign;
      }
    }

    // Resolve birth location to lat/lon/timezone if all required fields are present
    let resolvedLocation = null;
    if (
      updates.birth_date &&
      updates.birth_time &&
      updates.birth_city &&
      updates.birth_region &&
      updates.birth_country
    ) {
      try {
        console.log(
          `[Profile] Resolving birth location for user ${user.id}: ${updates.birth_city}, ${updates.birth_region}, ${updates.birth_country}`
        );

        resolvedLocation = await resolveBirthLocation({
          city: updates.birth_city,
          region: updates.birth_region,
          country: updates.birth_country,
          birthDate: updates.birth_date,
          birthTime: updates.birth_time,
        });

        console.log(
          `[Profile] Location resolved: lat=${resolvedLocation.lat}, lon=${resolvedLocation.lon}, timezone=${resolvedLocation.timezone}`
        );

        // Add resolved values to updates
        updates.birth_lat = resolvedLocation.lat;
        updates.birth_lon = resolvedLocation.lon;
        updates.timezone = resolvedLocation.timezone;
      } catch (err: any) {
        // Don't block profile save if Google API fails
        console.error("[Profile] Failed to resolve birth location:", err.message);
        console.error(
          "[Profile] Continuing with profile save without lat/lon/timezone updates"
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

    return NextResponse.json({
      profile: updatedProfile,
      locationResolved: !!resolvedLocation,
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
