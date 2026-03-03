import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/seats/revoke
 *
 * Revokes a seat member. Only the seat account owner can revoke.
 *
 * Body: { member_id: string }
 *
 * Errors:
 *   401 — not authenticated
 *   400 — missing member_id
 *   404 — member row not found
 *   403 — caller is not the seat account owner
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Sign in to manage team members." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { member_id } = body;

    if (!member_id || typeof member_id !== "string") {
      return NextResponse.json(
        { error: "Bad request", message: "member_id is required." },
        { status: 400 }
      );
    }

    const admin = createAdminSupabaseClient();

    // Load the seat_member row
    const { data: member } = await admin
      .from("seat_members")
      .select("id, seat_account_id, status")
      .eq("id", member_id)
      .maybeSingle();

    if (!member) {
      return NextResponse.json(
        { error: "Not found", message: "Member not found." },
        { status: 404 }
      );
    }

    // Verify caller owns the seat_account
    const { data: seatAccount } = await admin
      .from("seat_accounts")
      .select("owner_user_id")
      .eq("id", member.seat_account_id)
      .maybeSingle();

    if (!seatAccount || seatAccount.owner_user_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden", message: "Only the team owner can revoke members." },
        { status: 403 }
      );
    }

    // Revoke
    const { error: updateError } = await admin
      .from("seat_members")
      .update({
        status: "revoked",
        revoked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.id);

    if (updateError) {
      console.error("[SeatRevoke] Failed to revoke member:", updateError);
      return NextResponse.json(
        { error: "Failed to revoke member", message: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[SeatRevoke] Error:", error);
    return NextResponse.json(
      { error: "Revoke failed", message: error.message || "Unable to revoke member" },
      { status: 500 }
    );
  }
}
