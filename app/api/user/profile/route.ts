import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getZodiacSign } from "@/lib/zodiac";
import { resolveBirthLocation } from "@/lib/location/resolveBirthLocation";

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

    // Resolve birth location if we have date + place
    const hasBirthPlace =
      updates.birth_date &&
      updates.birth_city &&
      updates.birth_region &&
      updates.birth_country;

    if (hasBirthPlace) {
      try {
        const timeForLocation =
          updates.birth_time && typeof updates.birth_time === "string"
            ? updates.birth_time
            : "12:00";

        const resolved = await resolveBirthLocation({
          city: updates.birth_city,
          region: updates.birth_region,
          country: updates.birth_country,
          birthDate: updates.birth_date,
          birthTime: timeForLocation,
        });

        updates.birth_lat = resolved.lat;
        updates.birth_lon = resolved.lon;
        updates.timezone = resolved.timezone;

        console.log("[Profile] Birth location resolved:", resolved);
      } catch (err: any) {
        console.error(
          "[Profile] Failed to resolve birth location:",
          err?.message || err
        );
        // Do NOT block save; we can leave birth_lat/birth_lon/timezone unchanged or null
        console.warn(
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
