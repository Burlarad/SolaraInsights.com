import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/seats/status
 *
 * Returns the current user's relationship to the seat system.
 *
 * Response shapes:
 *   { role: "none" }
 *   { role: "owner", seat_account: SeatAccount, members: SeatMember[] }
 *   { role: "member", seat_account: { id, status, seat_limit } }
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Sign in to view seat status." },
        { status: 401 }
      );
    }

    // Check if user is an owner
    const { data: seatAccount } = await supabase
      .from("seat_accounts")
      .select("id, seat_limit, status, current_period_end, created_at")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (seatAccount) {
      // Load all members for this account
      const { data: members } = await supabase
        .from("seat_members")
        .select(
          "id, invite_email, status, invited_at, expires_at, accepted_user_id, accepted_at, revoked_at"
        )
        .eq("seat_account_id", seatAccount.id)
        .order("invited_at", { ascending: false });

      return NextResponse.json({
        role: "owner",
        seat_account: seatAccount,
        members: members ?? [],
      });
    }

    // Check if user is an active seat member
    const { data: memberRow } = await supabase
      .from("seat_members")
      .select("id, seat_account_id, status, accepted_at")
      .eq("accepted_user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (memberRow) {
      const { data: ownerAccount } = await supabase
        .from("seat_accounts")
        .select("id, seat_limit, status")
        .eq("id", memberRow.seat_account_id)
        .maybeSingle();

      return NextResponse.json({
        role: "member",
        seat_account: ownerAccount ?? null,
        member: memberRow,
      });
    }

    return NextResponse.json({ role: "none" });
  } catch (error: any) {
    console.error("[SeatStatus] Error:", error);
    return NextResponse.json(
      { error: "Status check failed", message: error.message || "Unable to retrieve seat status" },
      { status: 500 }
    );
  }
}
