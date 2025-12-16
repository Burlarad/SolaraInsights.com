import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

/**
 * GET /api/cron/social-sync
 *
 * Cron job to sync all social connections that need refresh.
 * Run every 6 hours to keep summaries fresh.
 * Protected by CRON_SECRET.
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

    // Find all connections that:
    // 1. Have status = 'ready' or 'connected' (not needs_reauth or syncing)
    // 2. Have a token (access_token_encrypted is not null)
    // 3. Haven't been synced in the last 6 hours (or never synced)
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    const { data: connections, error: fetchError } = await supabase
      .from("social_connections")
      .select("id, user_id, provider")
      .in("status", ["ready", "connected"])
      .not("access_token_encrypted", "is", null)
      .or(`last_synced_at.is.null,last_synced_at.lt.${sixHoursAgo}`);

    if (fetchError) {
      console.error("[CronSocialSync] Failed to fetch connections:", fetchError);
      return NextResponse.json(
        { error: "Database error" },
        { status: 500 }
      );
    }

    console.log(`[CronSocialSync] Found ${connections?.length || 0} connections to sync`);

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No connections need syncing",
        synced: 0,
      });
    }

    // Sync each connection (with rate limiting)
    const results: { provider: string; userId: string; success: boolean; error?: string }[] = [];
    const syncUrl = `${baseUrl}/api/social/sync`;

    for (const connection of connections) {
      try {
        const response = await fetch(syncUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${expectedToken}`,
          },
          body: JSON.stringify({
            userId: connection.user_id,
            provider: connection.provider,
          }),
        });

        const success = response.ok;
        const result = await response.json().catch(() => ({}));

        results.push({
          provider: connection.provider,
          userId: connection.user_id,
          success,
          error: success ? undefined : result.error,
        });

        // Small delay between syncs to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (err: any) {
        results.push({
          provider: connection.provider,
          userId: connection.user_id,
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
      total: connections.length,
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
