import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { resend, RESEND_CONFIG, isResendConfigured } from "@/lib/resend/client";
import { passwordResetEmail } from "@/lib/email/templates";

/**
 * Custom password reset endpoint that uses Resend for email delivery.
 *
 * This approach:
 * 1. Uses Supabase Admin API to generate a password reset link
 * 2. Sends the email through Resend with branded template
 * 3. From address: Solara@solarainsights.com
 *
 * Benefits:
 * - Full control over email template and branding
 * - Emails from verified Solara domain (better deliverability)
 * - Consistent "from" address across all auth emails
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      console.log(`[ResetPassword:${requestId}] Missing or invalid email`);
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log(`[ResetPassword:${requestId}] Invalid email format`);
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    console.log(`[ResetPassword:${requestId}] Processing reset request`);

    // Check if Resend is configured
    if (!isResendConfigured()) {
      console.error(`[ResetPassword:${requestId}] Resend not configured - RESEND_API_KEY missing`);
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      );
    }

    // Get the app URL for the redirect
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://solarainsights.com";
    const redirectTo = `${appUrl}/reset-password`;

    // Use Supabase Admin to generate the reset link
    const admin = createAdminSupabaseClient();

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo,
      },
    });

    if (linkError) {
      // Log the error but don't reveal if user exists
      console.error(`[ResetPassword:${requestId}] generateLink error:`, linkError.message);

      // Always return success to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: "If an account exists with this email, you will receive a password reset link.",
      });
    }

    if (!linkData?.properties?.action_link) {
      console.error(`[ResetPassword:${requestId}] No action_link in response`);
      // Still return success to prevent enumeration
      return NextResponse.json({
        success: true,
        message: "If an account exists with this email, you will receive a password reset link.",
      });
    }

    const resetLink = linkData.properties.action_link;
    console.log(`[ResetPassword:${requestId}] Generated reset link successfully`);

    // Send email via Resend with branded template
    const resetEmailTemplate = passwordResetEmail(resetLink);
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: RESEND_CONFIG.fromEmail,
      to: email,
      subject: "Reset your Solara password",
      html: resetEmailTemplate.html,
      text: resetEmailTemplate.text,
    });

    if (emailError) {
      console.error(`[ResetPassword:${requestId}] Resend error:`, emailError.message);
      return NextResponse.json(
        { error: "Failed to send email. Please try again." },
        { status: 500 }
      );
    }

    console.log(`[ResetPassword:${requestId}] Email sent successfully via Resend, id: ${emailData?.id}`);

    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, you will receive a password reset link.",
    });
  } catch (err: any) {
    console.error(`[ResetPassword:${requestId}] Unexpected error:`, err.message);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
