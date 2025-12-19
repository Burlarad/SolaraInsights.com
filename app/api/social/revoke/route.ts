import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { isValidProvider } from "@/lib/social/summarize";

/**
 * POST /api/social/revoke
 *
 * Revokes a social connection by deleting tokens from social_accounts
 * and removing the associated summary.
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in to revoke Social Insights." },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { provider } = body;

    if (!provider || !isValidProvider(provider)) {
      return NextResponse.json(
        { error: "Invalid provider", message: "Please provide a valid social provider." },
        { status: 400 }
      );
    }

    console.log(`[SocialRevoke:${requestId}] User ${user.id} revoking ${provider}`);

    // Delete the social summary (regular client is fine here)
    const { error: deleteSummaryError } = await supabase
      .from("social_summaries")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", provider);

    if (deleteSummaryError) {
      console.error(`[SocialRevoke:${requestId}] Failed to delete summary:`, deleteSummaryError);
      // Continue anyway - we still want to delete the account
    }

    // Delete from social_accounts using service role (RLS blocks regular users)
    const serviceSupabase = createServiceSupabaseClient();
    const { error: deleteAccountError } = await serviceSupabase
      .from("social_accounts")
      .delete()
      .eq("user_id", user.id)
      .eq("provider", provider);

    if (deleteAccountError) {
      console.error(`[SocialRevoke:${requestId}] Failed to delete account:`, deleteAccountError);
      return NextResponse.json(
        { error: "Database error", message: "Failed to revoke connection." },
        { status: 500 }
      );
    }

    console.log(`[SocialRevoke:${requestId}] Successfully revoked ${provider}`);

    return NextResponse.json({
      success: true,
      provider,
      status: "disconnected",
    });
  } catch (error: any) {
    console.error(`[SocialRevoke:${requestId}] Unexpected error:`, error.message);
    return NextResponse.json(
      { error: "Server error", message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
