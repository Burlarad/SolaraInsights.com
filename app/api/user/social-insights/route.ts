import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/user/social-insights
 *
 * Toggle social insights on/off and manage activation state.
 *
 * Body:
 *   { enabled: boolean } - Turn social insights on or off
 *   { activatedAt: true } - First-time activation (sets enabled=true + activated_at timestamp)
 *   { dismissPrompt: true } - Dismiss the social connect modal (legacy)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { enabled, activatedAt, dismissPrompt } = body;

    // Build update object based on what was provided
    const updates: Record<string, unknown> = {};

    // Handle first-time activation (from OAuth callback)
    if (activatedAt === true) {
      // First check if already activated to avoid overwriting timestamp
      const { data: profile } = await supabase
        .from("profiles")
        .select("social_insights_activated_at")
        .eq("id", user.id)
        .single();

      updates.social_insights_enabled = true;

      // Only set activated_at if not already set
      if (!profile?.social_insights_activated_at) {
        updates.social_insights_activated_at = new Date().toISOString();
      }
    } else if (typeof enabled === "boolean") {
      updates.social_insights_enabled = enabled;

      // When toggled ON and never activated before, set activated_at
      if (enabled) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("social_insights_activated_at")
          .eq("id", user.id)
          .single();

        if (!profile?.social_insights_activated_at) {
          updates.social_insights_activated_at = new Date().toISOString();
        }
      }
    }

    // Legacy: support dismissPrompt for backwards compatibility
    if (dismissPrompt === true) {
      updates.social_connect_prompt_dismissed_at = new Date().toISOString();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Bad request", message: "No valid fields provided." },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (updateError) {
      console.error("[SocialInsights] Update failed:", updateError.message);
      return NextResponse.json(
        { error: "Database error", message: "Failed to update settings." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[SocialInsights] Unexpected error:", error.message);
    return NextResponse.json(
      { error: "Server error", message: "Something went wrong." },
      { status: 500 }
    );
  }
}
