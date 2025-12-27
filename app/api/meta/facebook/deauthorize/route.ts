import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * POST /api/meta/facebook/deauthorize
 *
 * Meta (Facebook) Deauthorize Callback endpoint.
 * Called by Meta when a user removes the app from their Facebook settings.
 *
 * This is different from data deletion:
 * - Deauthorize: User removed the app connection (we revoke social_accounts entry)
 * - Data Deletion: User requests all data to be deleted (we delete the account)
 *
 * When a user deauthorizes:
 * 1. We verify the signed_request
 * 2. We look up the user via social_identities or social_accounts
 * 3. We revoke their Facebook connection (soft delete)
 * 4. We do NOT delete their account - they may have other auth methods
 *
 * Meta does not require a specific response format for deauthorize callbacks.
 * A 200 OK is sufficient.
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[MetaDeauthorize:${requestId}] Received callback`);

  try {
    // Parse the form data (Meta sends application/x-www-form-urlencoded)
    const formData = await req.formData();
    const signedRequest = formData.get("signed_request");

    if (!signedRequest || typeof signedRequest !== "string") {
      console.error(`[MetaDeauthorize:${requestId}] Missing signed_request`);
      return NextResponse.json(
        { error: "Missing signed_request" },
        { status: 400 }
      );
    }

    // Parse and verify the signed request
    const payload = parseSignedRequest(signedRequest);

    if (!payload) {
      console.error(`[MetaDeauthorize:${requestId}] Invalid signed_request`);
      return NextResponse.json(
        { error: "Invalid signed_request" },
        { status: 400 }
      );
    }

    const facebookUserId = payload.user_id;

    if (!facebookUserId) {
      console.error(`[MetaDeauthorize:${requestId}] Missing user_id in payload`);
      return NextResponse.json(
        { error: "Missing user_id in signed_request" },
        { status: 400 }
      );
    }

    console.log(`[MetaDeauthorize:${requestId}] Facebook user_id: ${facebookUserId}`);

    const admin = createAdminSupabaseClient();

    // First, try to find user in social_identities (Supabase OAuth)
    const { data: identity } = await admin
      .from("social_identities")
      .select("user_id")
      .eq("provider", "facebook")
      .eq("external_user_id", facebookUserId)
      .single();

    // Also check social_accounts (Custom OAuth for Social Insights)
    const { data: socialAccount } = await admin
      .from("social_accounts")
      .select("id, user_id")
      .eq("provider", "facebook")
      .eq("external_user_id", facebookUserId)
      .single();

    // Revoke social_accounts entry if found
    if (socialAccount) {
      const { error: revokeError } = await admin
        .from("social_accounts")
        .update({
          access_token: null,
          refresh_token: null,
          revoked_at: new Date().toISOString(),
          revoked_reason: "meta_deauthorize_callback",
        })
        .eq("id", socialAccount.id);

      if (revokeError) {
        console.error(`[MetaDeauthorize:${requestId}] Failed to revoke social_accounts:`, revokeError);
      } else {
        console.log(`[MetaDeauthorize:${requestId}] Revoked social_accounts for user ${socialAccount.user_id}`);
      }

      // Update profile to disable social insights if this was their only connection
      const { data: remainingConnections } = await admin
        .from("social_accounts")
        .select("id")
        .eq("user_id", socialAccount.user_id)
        .is("revoked_at", null);

      if (!remainingConnections || remainingConnections.length === 0) {
        await admin
          .from("profiles")
          .update({ social_insights_enabled: false })
          .eq("id", socialAccount.user_id);

        console.log(`[MetaDeauthorize:${requestId}] Disabled social_insights for user ${socialAccount.user_id}`);
      }
    }

    // Log deauthorization for audit (using the identity if available)
    const userId = identity?.user_id || socialAccount?.user_id || null;

    if (userId) {
      console.log(`[MetaDeauthorize:${requestId}] Processed deauthorization for user ${userId}`);
    } else {
      console.log(`[MetaDeauthorize:${requestId}] No user found for Facebook ID ${facebookUserId}`);
    }

    // Return success - Meta just needs 200 OK
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`[MetaDeauthorize:${requestId}] Unexpected error:`, error.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Parse and verify a Meta signed_request.
 * Format: base64url(signature).base64url(payload)
 * Signature is HMAC-SHA256 of payload using app secret.
 */
function parseSignedRequest(signedRequest: string): { user_id: string; algorithm: string; issued_at: number } | null {
  const appSecret = process.env.META_APP_SECRET;

  if (!appSecret) {
    console.error("[MetaDeauthorize] META_APP_SECRET not configured");
    return null;
  }

  const parts = signedRequest.split(".");
  if (parts.length !== 2) {
    console.error("[MetaDeauthorize] Invalid signed_request format");
    return null;
  }

  const [encodedSig, encodedPayload] = parts;

  // Decode base64url (Meta uses URL-safe base64)
  const signature = base64UrlDecode(encodedSig);
  const payloadString = base64UrlDecode(encodedPayload);

  let payload;
  try {
    payload = JSON.parse(payloadString);
  } catch {
    console.error("[MetaDeauthorize] Failed to parse payload JSON");
    return null;
  }

  // Verify algorithm
  if (payload.algorithm?.toUpperCase() !== "HMAC-SHA256") {
    console.error("[MetaDeauthorize] Unsupported algorithm:", payload.algorithm);
    return null;
  }

  // Verify signature
  const expectedSig = crypto
    .createHmac("sha256", appSecret)
    .update(encodedPayload)
    .digest();

  const signatureBuffer = Buffer.from(signature, "binary");

  if (!crypto.timingSafeEqual(signatureBuffer, expectedSig)) {
    console.error("[MetaDeauthorize] Signature verification failed");
    return null;
  }

  return payload;
}

/**
 * Decode base64url to string.
 * Base64url uses - instead of + and _ instead of /
 */
function base64UrlDecode(input: string): string {
  // Convert base64url to standard base64
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");

  // Add padding if needed
  const padding = base64.length % 4;
  if (padding) {
    base64 += "=".repeat(4 - padding);
  }

  return Buffer.from(base64, "base64").toString("utf8");
}
