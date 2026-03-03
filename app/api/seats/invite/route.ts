import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { resend, RESEND_CONFIG } from "@/lib/resend/client";
import { seatInviteEmail } from "@/lib/email/templates";

/**
 * POST /api/seats/invite
 *
 * Sends a seat invitation to an email address.
 * Only the seat account owner can invite members.
 *
 * Body: { email: string }
 *
 * Rules:
 *   - Owner must have an active/trialing seat_account
 *   - Non-revoked member count must be < seat_limit - 1 (owner occupies one seat)
 *   - Generates a 64-char hex invite token, expires in 7 days
 *   - Upserts on (invite_email + seat_account_id) to allow re-invite after expiry
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Sign in to invite team members." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { email: inviteEmail } = body;

    if (!inviteEmail || typeof inviteEmail !== "string") {
      return NextResponse.json(
        { error: "Bad request", message: "email is required." },
        { status: 400 }
      );
    }

    const normalizedEmail = inviteEmail.trim().toLowerCase();

    const admin = createAdminSupabaseClient();

    // Load owner's seat_account
    const { data: seatAccount } = await admin
      .from("seat_accounts")
      .select("id, seat_limit, status")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (!seatAccount) {
      return NextResponse.json(
        { error: "Forbidden", message: "No seat account found. Purchase a team plan to invite members." },
        { status: 403 }
      );
    }

    if (seatAccount.status !== "active" && seatAccount.status !== "trialing") {
      return NextResponse.json(
        { error: "Forbidden", message: "Your team plan is not active. Update your billing to invite members." },
        { status: 403 }
      );
    }

    // Count non-revoked members (invited + active)
    const { count: memberCount } = await admin
      .from("seat_members")
      .select("id", { count: "exact", head: true })
      .eq("seat_account_id", seatAccount.id)
      .in("status", ["invited", "active"]);

    const maxMembers = seatAccount.seat_limit - 1; // owner occupies one seat
    if ((memberCount ?? 0) >= maxMembers) {
      return NextResponse.json(
        {
          error: "Capacity reached",
          message: `Your ${seatAccount.seat_limit}-seat plan is full. Revoke a member to invite someone new.`,
        },
        { status: 403 }
      );
    }

    // Load owner profile for display name
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("full_name, first_name, email")
      .eq("id", user.id)
      .single();

    const inviterName =
      ownerProfile?.full_name ||
      ownerProfile?.first_name ||
      ownerProfile?.email ||
      "A Solara member";

    // Generate invite token
    const inviteToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Upsert seat_member row (allow re-invite after expiry/revoke)
    const { error: upsertError } = await admin.from("seat_members").upsert(
      {
        seat_account_id: seatAccount.id,
        invite_email: normalizedEmail,
        status: "invited",
        invite_token: inviteToken,
        invited_at: new Date().toISOString(),
        expires_at: expiresAt,
        accepted_user_id: null,
        accepted_at: null,
        revoked_at: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "invite_token" }
    );

    if (upsertError) {
      console.error("[SeatInvite] Failed to upsert seat_member:", upsertError);
      return NextResponse.json(
        { error: "Failed to create invitation", message: upsertError.message },
        { status: 500 }
      );
    }

    // Send invite email
    const appUrl =
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const acceptUrl = `${appUrl}/accept-invite?token=${inviteToken}`;
    const emailTemplate = seatInviteEmail(inviterName, acceptUrl);

    try {
      await resend.emails.send({
        from: RESEND_CONFIG.fromEmail,
        to: normalizedEmail,
        subject: `${inviterName} invited you to Solara`,
        html: emailTemplate.html,
        text: emailTemplate.text,
      });
    } catch (emailError) {
      console.error("[SeatInvite] Failed to send invite email:", emailError);
      // Non-fatal: invite row exists; owner can resend manually
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[SeatInvite] Error:", error);
    return NextResponse.json(
      { error: "Invite failed", message: error.message || "Unable to send invitation" },
      { status: 500 }
    );
  }
}
