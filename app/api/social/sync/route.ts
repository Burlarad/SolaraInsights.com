import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { SocialProvider } from "@/types";
import { decryptToken, encryptToken } from "@/lib/social/crypto";
import { refreshAccessToken, OAUTH_PROVIDERS } from "@/lib/social/oauth";
import { fetchSocialContent } from "@/lib/social/fetchers";
import { generateSocialSummary, SOCIAL_SUMMARY_PROMPT_VERSION } from "@/lib/social/summarize";

/**
 * POST /api/social/sync
 *
 * Server-only route to sync social content for a user.
 * Protected by CRON_SECRET - not callable from browser.
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

    // Get the connection with encrypted tokens
    const { data: connection, error: fetchError } = await supabase
      .from("social_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", provider)
      .single();

    if (fetchError || !connection) {
      console.error("[SocialSync] Connection not found:", fetchError);
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    if (!connection.access_token_encrypted) {
      console.error("[SocialSync] No access token for connection");
      await supabase
        .from("social_connections")
        .update({
          status: "needs_reauth",
          last_error: "No access token available",
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);

      return NextResponse.json(
        { error: "No access token" },
        { status: 400 }
      );
    }

    // Update status to syncing
    await supabase
      .from("social_connections")
      .update({
        status: "syncing",
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

    // Decrypt access token
    let accessToken: string;
    try {
      accessToken = decryptToken(connection.access_token_encrypted);
    } catch (err) {
      console.error("[SocialSync] Failed to decrypt token:", err);
      await supabase
        .from("social_connections")
        .update({
          status: "needs_reauth",
          last_error: "Token decryption failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);

      return NextResponse.json(
        { error: "Token decryption failed" },
        { status: 500 }
      );
    }

    // Check if token is expired and refresh if needed
    const tokenExpiry = connection.token_expires_at
      ? new Date(connection.token_expires_at)
      : null;

    if (tokenExpiry && tokenExpiry < new Date()) {
      console.log(`[SocialSync] Token expired for ${provider}, attempting refresh`);

      if (!connection.refresh_token_encrypted) {
        await supabase
          .from("social_connections")
          .update({
            status: "needs_reauth",
            last_error: "Token expired and no refresh token available",
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id);

        return NextResponse.json(
          { error: "Token expired, needs reauth" },
          { status: 401 }
        );
      }

      try {
        const refreshToken = decryptToken(connection.refresh_token_encrypted);
        const newTokens = await refreshAccessToken(provider, refreshToken);

        // Update tokens in database
        const newAccessTokenEncrypted = encryptToken(newTokens.accessToken);
        const newRefreshTokenEncrypted = newTokens.refreshToken
          ? encryptToken(newTokens.refreshToken)
          : connection.refresh_token_encrypted;
        const newTokenExpiresAt = newTokens.expiresIn
          ? new Date(Date.now() + newTokens.expiresIn * 1000).toISOString()
          : null;

        await supabase
          .from("social_connections")
          .update({
            access_token_encrypted: newAccessTokenEncrypted,
            refresh_token_encrypted: newRefreshTokenEncrypted,
            token_expires_at: newTokenExpiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id);

        accessToken = newTokens.accessToken;
        console.log(`[SocialSync] Token refreshed for ${provider}`);
      } catch (refreshErr: any) {
        console.error("[SocialSync] Token refresh failed:", refreshErr.message);
        await supabase
          .from("social_connections")
          .update({
            status: "needs_reauth",
            last_error: `Token refresh failed: ${refreshErr.message}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id);

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

      await supabase
        .from("social_connections")
        .update({
          status: isAuthError ? "needs_reauth" : "connected",
          last_error: fetchErr.message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);

      return NextResponse.json(
        { error: "Content fetch failed", details: fetchErr.message },
        { status: isAuthError ? 401 : 500 }
      );
    }

    // Check if we got enough content
    if (!fetchedContent.content || fetchedContent.content.length < 100) {
      console.log(`[SocialSync] Insufficient content for ${provider} (${fetchedContent.postCount} posts)`);

      await supabase
        .from("social_connections")
        .update({
          status: "ready",
          handle: fetchedContent.handle || connection.handle,
          last_synced_at: new Date().toISOString(),
          last_error: "Insufficient content for analysis",
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);

      return NextResponse.json({
        success: true,
        message: "Insufficient content for summary",
        postCount: fetchedContent.postCount,
      });
    }

    // Generate AI summary
    let summaryResult;
    try {
      summaryResult = await generateSocialSummary(
        provider,
        fetchedContent.content,
        fetchedContent.handle || undefined
      );
    } catch (summaryErr: any) {
      console.error("[SocialSync] Summary generation failed:", summaryErr.message);

      await supabase
        .from("social_connections")
        .update({
          status: "connected",
          handle: fetchedContent.handle || connection.handle,
          last_error: `Summary generation failed: ${summaryErr.message}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);

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
          prompt_version: SOCIAL_SUMMARY_PROMPT_VERSION,
          model_version: summaryResult.modelVersion,
          last_collected_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,provider",
        }
      );

    if (summaryError) {
      console.error("[SocialSync] Failed to save summary:", summaryError);
      await supabase
        .from("social_connections")
        .update({
          status: "connected",
          last_error: "Failed to save summary",
          updated_at: new Date().toISOString(),
        })
        .eq("id", connection.id);

      return NextResponse.json(
        { error: "Failed to save summary" },
        { status: 500 }
      );
    }

    // Update connection status to ready
    await supabase
      .from("social_connections")
      .update({
        status: "ready",
        handle: fetchedContent.handle || connection.handle,
        last_synced_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection.id);

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
