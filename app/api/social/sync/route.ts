import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { SocialProvider } from "@/types";
import { decryptToken, encryptToken } from "@/lib/social/crypto";
import { refreshAccessToken } from "@/lib/social/oauth";
import { fetchSocialContent } from "@/lib/social/fetchers";
import { generateSocialSummary } from "@/lib/social/summarize";
import { checkBudget, incrementBudget, BUDGET_EXCEEDED_RESPONSE } from "@/lib/ai/costControl";
import { OPENAI_MODELS } from "@/lib/openai/client";

/**
 * POST /api/social/sync
 *
 * Server-only route to sync social content for a user.
 * Protected by CRON_SECRET - not callable from browser.
 * Reads/writes tokens from social_accounts vault.
 *
 * Body: { userId: string, provider: SocialProvider }
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authorization
    const authHeader = req.headers.get("authorization");
    const expectedToken = process.env.CRON_SECRET;

    if (!expectedToken) {
      console.error("[SocialSync] CRON_SECRET not configured");
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

    // Parse request body
    const body = await req.json();
    const { userId, provider } = body as {
      userId: string;
      provider: SocialProvider;
    };

    if (!userId || !provider) {
      return NextResponse.json(
        { error: "Missing userId or provider" },
        { status: 400 }
      );
    }

    console.log(`[SocialSync] Starting sync for user ${userId}, provider ${provider}`);

    const supabase = createServiceSupabaseClient();

    // Get the account with encrypted tokens from social_accounts vault
    const { data: account, error: fetchError } = await supabase
      .from("social_accounts")
      .select("id, access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .eq("provider", provider)
      .single();

    if (fetchError || !account) {
      console.error("[SocialSync] Account not found:", fetchError);
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    if (!account.access_token) {
      console.error("[SocialSync] No access token for account");
      return NextResponse.json(
        { error: "No access token" },
        { status: 400 }
      );
    }

    // Decrypt access token
    let accessToken: string;
    try {
      accessToken = decryptToken(account.access_token);
    } catch (err) {
      console.error("[SocialSync] Failed to decrypt token:", err);
      return NextResponse.json(
        { error: "Token decryption failed" },
        { status: 500 }
      );
    }

    // Check if token is expired and refresh if needed
    const tokenExpiry = account.expires_at
      ? new Date(account.expires_at)
      : null;

    if (tokenExpiry && tokenExpiry < new Date()) {
      console.log(`[SocialSync] Token expired for ${provider}, attempting refresh`);

      if (!account.refresh_token) {
        // Delete the account since we can't refresh - user needs to reconnect
        await supabase
          .from("social_accounts")
          .delete()
          .eq("id", account.id);

        return NextResponse.json(
          { error: "Token expired, needs reauth" },
          { status: 401 }
        );
      }

      try {
        const refreshToken = decryptToken(account.refresh_token);
        const newTokens = await refreshAccessToken(provider, refreshToken);

        // Update tokens in social_accounts
        const newAccessTokenEncrypted = encryptToken(newTokens.accessToken);
        const newRefreshTokenEncrypted = newTokens.refreshToken
          ? encryptToken(newTokens.refreshToken)
          : account.refresh_token;
        const newExpiresAt = newTokens.expiresIn
          ? new Date(Date.now() + newTokens.expiresIn * 1000).toISOString()
          : null;

        await supabase
          .from("social_accounts")
          .update({
            access_token: newAccessTokenEncrypted,
            refresh_token: newRefreshTokenEncrypted,
            expires_at: newExpiresAt,
          })
          .eq("id", account.id);

        accessToken = newTokens.accessToken;
        console.log(`[SocialSync] Token refreshed for ${provider}`);
      } catch (refreshErr: any) {
        console.error("[SocialSync] Token refresh failed:", refreshErr.message);

        // Delete the account since refresh failed - user needs to reconnect
        await supabase
          .from("social_accounts")
          .delete()
          .eq("id", account.id);

        return NextResponse.json(
          { error: "Token refresh failed" },
          { status: 401 }
        );
      }
    }

    // Fetch content from the provider
    let fetchedContent;
    try {
      fetchedContent = await fetchSocialContent(provider, accessToken);
    } catch (fetchErr: any) {
      console.error("[SocialSync] Content fetch failed:", fetchErr.message);

      // Check if it's an auth error
      const isAuthError = fetchErr.message.toLowerCase().includes("unauthorized") ||
        fetchErr.message.toLowerCase().includes("401") ||
        fetchErr.message.toLowerCase().includes("forbidden");

      if (isAuthError) {
        // Delete the account since token is invalid
        await supabase
          .from("social_accounts")
          .delete()
          .eq("id", account.id);
      }

      return NextResponse.json(
        { error: "Content fetch failed", details: fetchErr.message },
        { status: isAuthError ? 401 : 500 }
      );
    }

    // Check if we got enough content
    if (!fetchedContent.content || fetchedContent.content.length < 100) {
      console.log(`[SocialSync] Insufficient content for ${provider} (${fetchedContent.postCount} posts)`);

      return NextResponse.json({
        success: true,
        message: "Insufficient content for summary",
        postCount: fetchedContent.postCount,
      });
    }

    // Check budget before generating AI summary
    const budgetCheck = await checkBudget();
    if (!budgetCheck.allowed) {
      console.warn(`[SocialSync] Budget exceeded for ${provider}, skipping AI summary`);
      return NextResponse.json(
        { error: "Service temporarily unavailable", code: "BUDGET_EXCEEDED" },
        { status: 503 }
      );
    }

    // Generate AI summary
    let summaryResult;
    try {
      summaryResult = await generateSocialSummary(
        provider,
        fetchedContent.content,
        fetchedContent.handle || undefined
      );

      // Increment budget after successful generation
      await incrementBudget(OPENAI_MODELS.fast, summaryResult.inputTokens, summaryResult.outputTokens);
    } catch (summaryErr: any) {
      console.error("[SocialSync] Summary generation failed:", summaryErr.message);

      return NextResponse.json(
        { error: "Summary generation failed", details: summaryErr.message },
        { status: 500 }
      );
    }

    // Embed metadata in summary
    const summaryWithMetadata = `${summaryResult.summary}

<!-- SOCIAL_INSIGHTS_METADATA
${JSON.stringify(summaryResult.metadata)}
-->`;

    // Upsert summary to database
    const { error: summaryError } = await supabase
      .from("social_summaries")
      .upsert(
        {
          user_id: userId,
          provider,
          summary: summaryWithMetadata,
          posts_count: fetchedContent.postCount,
          window_days: 30, // Default window for recent posts
          last_fetched_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,provider",
        }
      );

    if (summaryError) {
      // Log full Supabase error structure (safe - no tokens/secrets)
      console.error("[SocialSync] Summary upsert failed:", {
        code: summaryError.code,
        message: summaryError.message,
        details: summaryError.details,
        hint: summaryError.hint,
      });

      // Store code + message for diagnosis without needing logs
      const errorDetail = summaryError.code
        ? `[${summaryError.code}] ${summaryError.message}`
        : summaryError.message || "Unknown error";

      // Record error on profile
      await supabase
        .from("profiles")
        .update({
          social_sync_status: "error",
          social_sync_error: `Summary write failed: ${errorDetail}`,
        })
        .eq("id", userId);

      return NextResponse.json(
        { error: "Failed to save summary", code: summaryError.code, details: summaryError.message },
        { status: 500 }
      );
    }

    console.log(`[SocialSync] Sync complete for ${provider}, ${fetchedContent.postCount} posts analyzed`);

    return NextResponse.json({
      success: true,
      provider,
      postCount: fetchedContent.postCount,
      summaryLength: summaryResult.summary.length,
    });
  } catch (error: any) {
    console.error("[SocialSync] Unexpected error:", error.message);
    return NextResponse.json(
      { error: "Server error", message: error.message },
      { status: 500 }
    );
  }
}
