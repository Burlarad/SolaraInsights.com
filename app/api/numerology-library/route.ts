import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOfficialNumerology, getOrComputeNumerology } from "@/lib/library/numerology";
import { isNumerologyInputComplete, type NumerologyInput } from "@/lib/library/keyNormalization";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { errorCode: "UNAUTHORIZED", message: "Please sign in." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { mode, inputs } = body as {
      mode?: "official" | "preview";
      inputs?: Partial<NumerologyInput>;
    };

    // OFFICIAL MODE (Settings source of truth)
    if (!mode || mode === "official") {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("full_name, birth_date, official_numerology_key")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        return NextResponse.json(
          { errorCode: "PROFILE_LOAD_FAILED", message: "Unable to load profile." },
          { status: 500 }
        );
      }

      const numerology = await getOfficialNumerology(user.id, profile);

      if (!numerology) {
        return NextResponse.json(
          {
            errorCode: "INCOMPLETE_NUMEROLOGY_DATA",
            message: "Missing required fields to compute numerology.",
            required: ["full_name", "birth_date"],
            missing: [
              !profile.full_name && "full_name",
              !profile.birth_date && "birth_date",
            ].filter(Boolean),
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        mode: "official",
        numerology_key: numerology.numerology_key,
        inputs: numerology.input_json,
        profile: numerology.numerology_json,
        is_official: true,
      });
    }

    // PREVIEW MODE (arbitrary inputs)
    if (mode === "preview") {
      if (!inputs) {
        return NextResponse.json(
          { errorCode: "BAD_REQUEST", message: "Preview requires inputs." },
          { status: 400 }
        );
      }

      if (!isNumerologyInputComplete(inputs)) {
        return NextResponse.json(
          {
            errorCode: "INCOMPLETE_PREVIEW_DATA",
            message: "First name, last name, and birth date required.",
            required: ["first_name", "last_name", "birth_date"],
            missing: [
              !inputs.first_name && "first_name",
              !inputs.last_name && "last_name",
              !inputs.birth_date && "birth_date",
            ].filter(Boolean),
          },
          { status: 400 }
        );
      }

      const numerology = await getOrComputeNumerology(inputs);

      return NextResponse.json({
        mode: "preview",
        numerology_key: numerology.numerology_key,
        inputs: numerology.input_json,
        profile: numerology.numerology_json,
        is_official: false,
      });
    }

    return NextResponse.json(
      { errorCode: "BAD_REQUEST", message: "Invalid mode." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[NumerologyLibraryRoute] Error:", error);
    return NextResponse.json(
      { errorCode: "INTERNAL_ERROR", message: "Failed to generate numerology." },
      { status: 500 }
    );
  }
}
