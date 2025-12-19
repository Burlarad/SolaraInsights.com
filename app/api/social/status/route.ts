import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { SocialProvider, SocialStatusResponse } from "@/types";

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
 * Reads from social_accounts (token vault) and social_summaries.
 * Never exposes tokens - only returns: connected/disconnected, expires_at, needs_reauth, hasSummary.
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

    // Use service role to read from social_accounts (RLS blocks regular users)
    const serviceSupabase = createServiceSupabaseClient();

    // Fetch all social accounts for this user (tokens never exposed)
    const { data: accounts, error: accountsError } = await serviceSupabase
      .from("social_accounts")
      .select("provider, expires_at")
      .eq("user_id", user.id);

    if (accountsError) {
      console.error("[SocialStatus] Error fetching accounts:", accountsError);
      return NextResponse.json(
        { error: "Database error", message: "Failed to load social connections." },
        { status: 500 }
      );
    }

    // Fetch all social summaries for this user (regular client is fine here)
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

    // Create a map of accounts by provider
    const accountMap = new Map<string, { expires_at: string | null }>();
    for (const account of accounts || []) {
      accountMap.set(account.provider, { expires_at: account.expires_at });
    }

    const now = new Date();

    // Build response for all providers
    const response: SocialStatusResponse = {
      connections: ALL_PROVIDERS.map((provider) => {
        const account = accountMap.get(provider);
        const isConnected = !!account;
        const expiresAt = account?.expires_at || null;
        const needsReauth = isConnected && expiresAt ? new Date(expiresAt) < now : false;

        return {
          provider,
          status: isConnected ? (needsReauth ? "needs_reauth" : "connected") : "disconnected",
          expiresAt,
          needsReauth,
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
