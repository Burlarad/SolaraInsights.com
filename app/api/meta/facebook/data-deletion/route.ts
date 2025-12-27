import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { deleteAccountCore } from "@/lib/account/deleteAccountCore";

/**
 * POST /api/meta/facebook/data-deletion
 *
 * Meta (Facebook) Data Deletion Callback endpoint.
 * Called by Meta when a user requests deletion of their data via Facebook's settings.
 *
 * Flow:
 * 1. Meta sends a signed_request with the Facebook user_id
 * 2. We verify the signature using META_APP_SECRET
 * 3. We look up the user via social_identities table
 * 4. If found, we delete their account data using deleteAccountCore
 * 5. We log the request to facebook_data_deletion_requests
 * 6. We return URL + confirmation_code per Meta's spec
 *
 * Meta requires response format:
 * { url: "...", confirmation_code: "..." }
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[MetaDataDeletion:${requestId}] Received callback`);

  try {
    // Parse the form data (Meta sends application/x-www-form-urlencoded)
    const formData = await req.formData();
    const signedRequest = formData.get("signed_request");

    if (!signedRequest || typeof signedRequest !== "string") {
      console.error(`[MetaDataDeletion:${requestId}] Missing signed_request`);
      return NextResponse.json(
        { error: "Missing signed_request" },
        { status: 400 }
      );
    }

    // Parse and verify the signed request
    const payload = parseSignedRequest(signedRequest);

    if (!payload) {
      console.error(`[MetaDataDeletion:${requestId}] Invalid signed_request`);
      return NextResponse.json(
        { error: "Invalid signed_request" },
        { status: 400 }
      );
    }

    const facebookUserId = payload.user_id;

    if (!facebookUserId) {
      console.error(`[MetaDataDeletion:${requestId}] Missing user_id in payload`);
      return NextResponse.json(
        { error: "Missing user_id in signed_request" },
        { status: 400 }
      );
    }

    console.log(`[MetaDataDeletion:${requestId}] Facebook user_id: ${facebookUserId}`);

    // Generate confirmation code (random, URL-safe)
    const confirmationCode = crypto.randomBytes(16).toString("hex");

    // Look up user in social_identities
    const admin = createAdminSupabaseClient();
    const { data: identity, error: lookupError } = await admin
      .from("social_identities")
      .select("user_id")
      .eq("provider", "facebook")
      .eq("external_user_id", facebookUserId)
      .single();

    if (lookupError || !identity) {
      console.log(`[MetaDataDeletion:${requestId}] User not found for FB ID ${facebookUserId}`);

      // Still log the request for audit purposes
      await admin.from("facebook_data_deletion_requests").insert({
        confirmation_code: confirmationCode,
        facebook_user_id: facebookUserId,
        user_id: null,
        status: "user_not_found",
        processed_at: new Date().toISOString(),
      });

      // Return valid response - Meta requires this format even if user not found
      const statusUrl = buildStatusUrl(confirmationCode);
      return NextResponse.json({
        url: statusUrl,
        confirmation_code: confirmationCode,
      });
    }

    const userId = identity.user_id;
    console.log(`[MetaDataDeletion:${requestId}] Found internal user: ${userId}`);

    // Create pending deletion request record
    const { error: insertError } = await admin.from("facebook_data_deletion_requests").insert({
      confirmation_code: confirmationCode,
      facebook_user_id: facebookUserId,
      user_id: userId,
      status: "processing",
    });

    if (insertError) {
      console.error(`[MetaDataDeletion:${requestId}] Failed to create deletion request:`, insertError);
      return NextResponse.json(
        { error: "Database error" },
        { status: 500 }
      );
    }

    // Perform the deletion
    const result = await deleteAccountCore({
      userId,
      requestId: confirmationCode,
      source: "meta_callback",
    });

    // Update the deletion request status
    if (result.success) {
      await admin
        .from("facebook_data_deletion_requests")
        .update({
          status: "completed",
          processed_at: new Date().toISOString(),
        })
        .eq("confirmation_code", confirmationCode);

      console.log(`[MetaDataDeletion:${requestId}] Deletion completed for user ${userId}`);
    } else {
      await admin
        .from("facebook_data_deletion_requests")
        .update({
          status: "failed",
          processed_at: new Date().toISOString(),
          error_message: result.errors.join("; "),
        })
        .eq("confirmation_code", confirmationCode);

      console.error(`[MetaDataDeletion:${requestId}] Deletion failed:`, result.errors);
    }

    // Return Meta-required response format
    const statusUrl = buildStatusUrl(confirmationCode);
    return NextResponse.json({
      url: statusUrl,
      confirmation_code: confirmationCode,
    });
  } catch (error: any) {
    console.error(`[MetaDataDeletion:${requestId}] Unexpected error:`, error.message);
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
    console.error("[MetaDataDeletion] META_APP_SECRET not configured");
    return null;
  }

  const parts = signedRequest.split(".");
  if (parts.length !== 2) {
    console.error("[MetaDataDeletion] Invalid signed_request format");
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
    console.error("[MetaDataDeletion] Failed to parse payload JSON");
    return null;
  }

  // Verify algorithm
  if (payload.algorithm?.toUpperCase() !== "HMAC-SHA256") {
    console.error("[MetaDataDeletion] Unsupported algorithm:", payload.algorithm);
    return null;
  }

  // Verify signature
  const expectedSig = crypto
    .createHmac("sha256", appSecret)
    .update(encodedPayload)
    .digest();

  const signatureBuffer = Buffer.from(signature, "binary");

  if (!crypto.timingSafeEqual(signatureBuffer, expectedSig)) {
    console.error("[MetaDataDeletion] Signature verification failed");
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

/**
 * Build the status URL for the deletion request.
 */
function buildStatusUrl(confirmationCode: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://solarainsights.com";
  return `${baseUrl}/deletion-status?code=${confirmationCode}`;
}
