import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { claimCheckoutSession } from "@/lib/stripe/claimCheckoutSession";

/**
 * POST /api/stripe/claim-session
 *
 * Client-side fallback for claiming a Stripe checkout session.
 * Used when the callback claim fails or for edge cases.
 *
 * Expects: { sessionId: "cs_..." }
 * Returns: { success: boolean, error?: string, claimed?: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId } = body;

    if (!sessionId || !sessionId.startsWith("cs_")) {
      return NextResponse.json(
        { success: false, error: "Invalid session ID" },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Use admin client for privileged operations
    const adminSupabase = createAdminSupabaseClient();

    // Attempt to claim the session
    const result = await claimCheckoutSession(sessionId, user.id, adminSupabase);

    console.log(`[ClaimSession API] User ${user.id} claim result:`, JSON.stringify(result));

    return NextResponse.json({
      success: result.claimed,
      error: result.reason,
      claimed: result.claimed,
      plan: result.plan,
    });
  } catch (error: any) {
    console.error("[ClaimSession API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Claim failed" },
      { status: 500 }
    );
  }
}
