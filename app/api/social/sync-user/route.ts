import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { SocialProvider } from "@/types";
import { getTodayLocalDate } from "@/lib/social/staleness";

/**
 * POST /api/social/sync-user
 *
 * Syncs all social accounts for a user.
 *
 * Authorization modes:
 * 1. Authenticated user (self-sync) - syncs current user's accounts
 * 2. CRON_SECRET (batch sync) - syncs specified userId
 *
 * Body (for CRON mode): { userId: string }
 * Body (for self-sync): {} or omitted
 *
 * This endpoint:
 * 1. Gets all connected social accounts for the user
 * 2. Triggers /api/social/sync for each provider
 * 3. Updates profile sync markers after all syncs complete
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isCronAuth = cronSecret && authHeader === `Bearer ${cronSecret}`;

    let targetUserId: string;
    let serviceClient = createServiceSupabaseClient();

    if (isCronAuth) {
      // CRON mode: userId from body
      const body = await req.json().catch(() => ({}));
      const { userId } = body as { userId?: string };

      if (!userId) {
        return NextResponse.json(
          { error: "Missing userId for CRON sync" },
          { status: 400 }
        );
      }
      targetUserId = userId;
      console.log(`[SyncUser] CRON sync for user ${targetUserId}`);
    } else {
      // Self-sync mode: get user from session
      const supabase = await createServerSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
      targetUserId = user.id;
      console.log(`[SyncUser] Self-sync for user ${targetUserId}`);
    }

    // Set status to syncing
    await serviceClient
      .from("profiles")
      .update({
        social_sync_status: "syncing",
        social_sync_error: null,
      })
      .eq("id", targetUserId);

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // Get all connected accounts for this user
    const { data: accounts, error: accountsError } = await serviceClient
      .from("social_accounts")
      .select("provider")
      .eq("user_id", targetUserId)
      .not("access_token", "is", null);

    if (accountsError) {
      console.error("[SyncUser] Failed to fetch accounts:", accountsError);
      await serviceClient
        .from("profiles")
        .update({
          social_sync_status: "error",
          social_sync_error: "Failed to fetch accounts",
        })
        .eq("id", targetUserId);
      return NextResponse.json(
        { error: "Database error" },
        { status: 500 }
      );
    }

    if (!accounts || accounts.length === 0) {
      console.log(`[SyncUser] No connected accounts for user ${targetUserId}`);
      await serviceClient
        .from("profiles")
        .update({
          social_sync_status: "idle",
        })
        .eq("id", targetUserId);
      return NextResponse.json({
        success: true,
        message: "No accounts to sync",
        synced: 0,
      });
    }

    // Get user's timezone for updating sync markers
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("timezone")
      .eq("id", targetUserId)
      .single();

    if (profileError || !profile) {
      console.error("[SyncUser] Failed to fetch profile:", profileError);
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    const syncUrl = `${baseUrl}/api/social/sync`;
    const results: { provider: string; success: boolean; error?: string }[] = [];
    const errors: string[] = [];

    // Sync each provider sequentially with small delay
    for (const account of accounts) {
      try {
        // Use CRON_SECRET for internal calls (sync route requires it)
        const response = await fetch(syncUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cronSecret}`,
          },
          body: JSON.stringify({
            userId: targetUserId,
            provider: account.provider as SocialProvider,
          }),
        });

        const success = response.ok;
        const result = await response.json().catch(() => ({}));

        results.push({
          provider: account.provider,
          success,
          error: success ? undefined : result.error,
        });

        if (!success && result.error) {
          errors.push(`${account.provider}: ${result.error}`);
        }

        // Small delay between syncs to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (err: any) {
        results.push({
          provider: account.provider,
          success: false,
          error: err.message,
        });
        errors.push(`${account.provider}: ${err.message}`);
      }
    }

    // Update profile sync markers
    const successCount = results.filter((r) => r.success).length;
    const now = new Date().toISOString();
    const todayLocal = getTodayLocalDate(profile.timezone);

    const updateData: Record<string, unknown> = {
      last_social_sync_at: now,
      last_social_sync_local_date: todayLocal,
      social_sync_status: successCount > 0 ? "success" : "error",
      social_sync_error: errors.length > 0 ? errors.join("; ") : null,
    };

    const { error: updateError } = await serviceClient
      .from("profiles")
      .update(updateData)
      .eq("id", targetUserId);

    if (updateError) {
      console.error("[SyncUser] Failed to update sync markers:", updateError);
    } else {
      console.log(`[SyncUser] Updated sync markers for ${targetUserId}: ${todayLocal}`);
    }

    console.log(
      `[SyncUser] Sync complete for ${targetUserId}: ${successCount}/${accounts.length} succeeded`
    );

    return NextResponse.json({
      success: true,
      total: accounts.length,
      succeeded: successCount,
      failed: results.filter((r) => !r.success).length,
      details: results,
    });
  } catch (error: any) {
    console.error("[SyncUser] Unexpected error:", error.message);
    return NextResponse.json(
      { error: "Server error", message: error.message },
      { status: 500 }
    );
  }
}
