import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

/**
 * GET /api/cron/social-sync
 *
 * Cron job to sync all social accounts that need refresh.
 * Run every 6 hours to keep summaries fresh.
 * Protected by CRON_SECRET.
 * Reads from social_accounts vault.
 *
 * Vercel cron config: add schedule "0 0,6,12,18 * * *" to vercel.json
 */
export async function GET(req: NextRequest) {
  try {
    // Verify authorization
    const authHeader = req.headers.get("authorization");
    const expectedToken = process.env.CRON_SECRET;

    if (!expectedToken) {
      console.error("[CronSocialSync] CRON_SECRET not configured");
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log("[CronSocialSync] Starting periodic sync job");

    const supabase = createServiceSupabaseClient();
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    // Get all accounts that have tokens (from social_accounts vault)
    const { data: accounts, error: accountsError } = await supabase
      .from("social_accounts")
      .select("user_id, provider")
      .not("access_token", "is", null);

    if (accountsError) {
      console.error("[CronSocialSync] Failed to fetch accounts:", accountsError);
      return NextResponse.json(
        { error: "Database error" },
        { status: 500 }
      );
    }

    if (!accounts || accounts.length === 0) {
      console.log("[CronSocialSync] No accounts found");
      return NextResponse.json({
        success: true,
        message: "No accounts to sync",
        synced: 0,
      });
    }

    // Get all summaries that were fetched in the last 6 hours (don't need re-sync)
    const { data: recentSummaries, error: summariesError } = await supabase
      .from("social_summaries")
      .select("user_id, provider")
      .gte("last_fetched_at", sixHoursAgo);

    if (summariesError) {
      console.error("[CronSocialSync] Failed to fetch summaries:", summariesError);
      // Continue anyway - we'll just sync all accounts
    }

    // Create a set of recently synced user_id+provider combos
    const recentlySynced = new Set(
      (recentSummaries || []).map((s) => `${s.user_id}:${s.provider}`)
    );

    // Filter accounts that need syncing (not recently synced)
    const accountsToSync = accounts.filter(
      (a) => !recentlySynced.has(`${a.user_id}:${a.provider}`)
    );

    console.log(`[CronSocialSync] Found ${accountsToSync.length} accounts to sync (${accounts.length} total, ${recentlySynced.size} recently synced)`);

    if (accountsToSync.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No accounts need syncing",
        synced: 0,
      });
    }

    // Sync each account (with rate limiting)
    const results: { provider: string; userId: string; success: boolean; error?: string }[] = [];
    const syncUrl = `${baseUrl}/api/social/sync`;

    for (const account of accountsToSync) {
      try {
        const response = await fetch(syncUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${expectedToken}`,
          },
          body: JSON.stringify({
            userId: account.user_id,
            provider: account.provider,
          }),
        });

        const success = response.ok;
        const result = await response.json().catch(() => ({}));

        results.push({
          provider: account.provider,
          userId: account.user_id,
          success,
          error: success ? undefined : result.error,
        });

        // Small delay between syncs to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (err: any) {
        results.push({
          provider: account.provider,
          userId: account.user_id,
          success: false,
          error: err.message,
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    console.log(`[CronSocialSync] Complete: ${successCount} succeeded, ${failureCount} failed`);

    return NextResponse.json({
      success: true,
      total: accountsToSync.length,
      succeeded: successCount,
      failed: failureCount,
      details: results,
    });
  } catch (error: any) {
    console.error("[CronSocialSync] Unexpected error:", error.message);
    return NextResponse.json(
      { error: "Server error", message: error.message },
      { status: 500 }
    );
  }
}
