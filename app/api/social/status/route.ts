import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SocialProvider, SocialConnectionStatus, SocialStatusResponse } from "@/types";

// All supported providers (5 only - YouTube and LinkedIn removed)
const ALL_PROVIDERS: SocialProvider[] = [
  "facebook",
  "instagram",
  "tiktok",
  "x",
  "reddit",
];

/**
 * GET /api/social/status
 *
 * Returns the status of all social connections for the current user.
 */
export async function GET(req: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in to view social status." },
        { status: 401 }
      );
    }

    // Fetch all social connections for this user
    const { data: connections, error: connectionsError } = await supabase
      .from("social_connections")
      .select("provider, status, handle, last_synced_at, last_error")
      .eq("user_id", user.id);

    if (connectionsError) {
      console.error("[SocialStatus] Error fetching connections:", connectionsError);
      return NextResponse.json(
        { error: "Database error", message: "Failed to load social connections." },
        { status: 500 }
      );
    }

    // Fetch all social summaries for this user
    const { data: summaries, error: summariesError } = await supabase
      .from("social_summaries")
      .select("provider")
      .eq("user_id", user.id);

    if (summariesError) {
      console.error("[SocialStatus] Error fetching summaries:", summariesError);
      return NextResponse.json(
        { error: "Database error", message: "Failed to load social summaries." },
        { status: 500 }
      );
    }

    // Create a set of providers with summaries
    const providersWithSummaries = new Set(summaries?.map((s) => s.provider) || []);

    // Create a map of connections by provider
    const connectionMap = new Map<string, {
      status: SocialConnectionStatus;
      handle: string | null;
      last_synced_at: string | null;
      last_error: string | null;
    }>();

    for (const conn of connections || []) {
      connectionMap.set(conn.provider, {
        status: conn.status as SocialConnectionStatus,
        handle: conn.handle,
        last_synced_at: conn.last_synced_at,
        last_error: conn.last_error,
      });
    }

    // Build response for all providers
    const response: SocialStatusResponse = {
      connections: ALL_PROVIDERS.map((provider) => {
        const conn = connectionMap.get(provider);
        return {
          provider,
          status: conn?.status || "disconnected",
          handle: conn?.handle || null,
          lastSyncedAt: conn?.last_synced_at || null,
          lastError: conn?.last_error || null,
          hasSummary: providersWithSummaries.has(provider),
        };
      }),
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("[SocialStatus] Unexpected error:", error.message);
    return NextResponse.json(
      { error: "Server error", message: "Failed to load social status." },
      { status: 500 }
    );
  }
}
