import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/seats/accept
 *
 * Accepts a seat invitation. The user must be authenticated and their email
 * must match the invite_email on the token.
 *
 * Body: { token: string }
 *
 * Errors:
 *   401 — not authenticated
 *   400 — missing token
 *   404 — token not found
 *   409 — already accepted / user already in another seat
 *   410 — token expired
 *   403 — email mismatch
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Sign in to accept your invitation." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { token } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Bad request", message: "token is required." },
        { status: 400 }
      );
    }

    const admin = createAdminSupabaseClient();

    // Load invite by token
    const { data: member } = await admin
      .from("seat_members")
      .select("id, invite_email, status, expires_at, accepted_user_id, seat_account_id")
      .eq("invite_token", token)
      .maybeSingle();

    if (!member) {
      return NextResponse.json(
        { error: "Not found", message: "Invitation not found. It may have expired or been revoked." },
        { status: 404 }
      );
    }

    if (member.status !== "invited") {
      return NextResponse.json(
        {
          error: "Conflict",
          message:
            member.status === "active"
              ? "This invitation has already been accepted."
              : "This invitation is no longer valid.",
        },
        { status: 409 }
      );
    }

    if (new Date(member.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Gone", message: "This invitation has expired. Ask the owner to send a new one." },
        { status: 410 }
      );
    }

    // Email must match (case-insensitive)
    const userEmail = user.email?.toLowerCase() ?? "";
    const inviteEmail = member.invite_email.toLowerCase();
    if (userEmail !== inviteEmail) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: `This invitation was sent to ${member.invite_email}. Sign in with that email to accept.`,
        },
        { status: 403 }
      );
    }

    // Ensure user is not already an active seat member elsewhere
    const { data: existingMembership } = await admin
      .from("seat_members")
      .select("id")
      .eq("accepted_user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (existingMembership) {
      return NextResponse.json(
        {
          error: "Conflict",
          message: "You are already a member of another team plan.",
        },
        { status: 409 }
      );
    }

    // Accept the invitation
    const { error: updateError } = await admin
      .from("seat_members")
      .update({
        status: "active",
        accepted_user_id: user.id,
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.id);

    if (updateError) {
      console.error("[SeatAccept] Failed to accept invite:", updateError);
      return NextResponse.json(
        { error: "Failed to accept invitation", message: updateError.message },
        { status: 500 }
      );
    }

    // Auto-create bilateral Connections between owner and member.
    //
    // Rules:
    //   - space_between_enabled = true (set explicitly per business rule)
    //   - is_mutual is auto-computed by the DB trigger (recompute_mutual_for_pair)
    //     when both sides exist — no need to set it manually
    //   - Idempotent: check existence before insert (connections has no UNIQUE constraint
    //     on owner_user_id + linked_profile_id, so we guard with a maybeSingle() check)
    //   - Non-fatal: invite acceptance is already recorded; connection creation is best-effort
    try {
      const { data: seatAccount } = await admin
        .from("seat_accounts")
        .select("owner_user_id")
        .eq("id", member.seat_account_id)
        .single();

      if (seatAccount) {
        const ownerId: string = seatAccount.owner_user_id;
        const memberId: string = user.id;

        // Load both profiles for display names
        const [{ data: ownerProfile }, { data: memberProfile }] = await Promise.all([
          admin.from("profiles").select("full_name, first_name, last_name, email").eq("id", ownerId).single(),
          admin.from("profiles").select("full_name, first_name, last_name, email").eq("id", memberId).single(),
        ]);

        type ProfileSnap = { full_name?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null } | null;
        const composeName = (p: ProfileSnap): string => {
          if (!p) return "Team Member";
          if (p.full_name) return p.full_name;
          const parts = [p.first_name, p.last_name].filter(Boolean);
          if (parts.length > 0) return parts.join(" ");
          return p.email?.split("@")[0] || "Team Member";
        };

        // owner → member (idempotent)
        const { data: existingOwnerConn } = await admin
          .from("connections")
          .select("id")
          .eq("owner_user_id", ownerId)
          .eq("linked_profile_id", memberId)
          .maybeSingle();

        if (!existingOwnerConn) {
          const memberName = composeName(memberProfile as ProfileSnap);
          await admin.from("connections").insert({
            owner_user_id: ownerId,
            linked_profile_id: memberId,
            first_name: (memberProfile as any)?.first_name || memberName,
            last_name: (memberProfile as any)?.last_name || null,
            name: memberName,
            relationship_type: "team_member",
            space_between_enabled: true,
          });
          console.log(`[SeatAccept] Created connection: owner ${ownerId} → member ${memberId}`);
        }

        // member → owner (idempotent)
        const { data: existingMemberConn } = await admin
          .from("connections")
          .select("id")
          .eq("owner_user_id", memberId)
          .eq("linked_profile_id", ownerId)
          .maybeSingle();

        if (!existingMemberConn) {
          const ownerName = composeName(ownerProfile as ProfileSnap);
          await admin.from("connections").insert({
            owner_user_id: memberId,
            linked_profile_id: ownerId,
            first_name: (ownerProfile as any)?.first_name || ownerName,
            last_name: (ownerProfile as any)?.last_name || null,
            name: ownerName,
            relationship_type: "team_member",
            space_between_enabled: true,
          });
          console.log(`[SeatAccept] Created connection: member ${memberId} → owner ${ownerId}`);
        }
      }
    } catch (connError) {
      console.error("[SeatAccept] Failed to auto-create connections:", connError);
      // Non-fatal: seat acceptance is confirmed; connection creation is best-effort
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[SeatAccept] Error:", error);
    return NextResponse.json(
      { error: "Accept failed", message: error.message || "Unable to accept invitation" },
      { status: 500 }
    );
  }
}
