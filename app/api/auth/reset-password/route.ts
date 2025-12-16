import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { resend, RESEND_CONFIG, isResendConfigured } from "@/lib/resend/client";

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
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: RESEND_CONFIG.fromEmail,
      to: email,
      subject: "Reset your Solara password",
      html: getPasswordResetEmailHtml(resetLink),
      text: getPasswordResetEmailText(resetLink),
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

/**
 * HTML email template for password reset
 */
function getPasswordResetEmailHtml(resetLink: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #eaeaea;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: #1a1a1a;">Solara Insights</h1>
              <p style="margin: 10px 0 0; font-size: 14px; color: #666;">Your cosmic guide to self-discovery</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 22px; font-weight: 600; color: #1a1a1a;">Reset Your Password</h2>

              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
                We received a request to reset the password for your Solara account. Click the button below to create a new password.
              </p>

              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #C9A227 0%, #D4AF37 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; box-shadow: 0 2px 4px rgba(201, 162, 39, 0.3);">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0; font-size: 14px; line-height: 1.6; color: #666;">
                This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
              </p>

              <p style="margin: 20px 0 0; font-size: 14px; line-height: 1.6; color: #666;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>

              <p style="margin: 10px 0 0; font-size: 12px; line-height: 1.6; color: #999; word-break: break-all;">
                ${resetLink}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #fafafa; border-top: 1px solid #eaeaea; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #999; text-align: center;">
                This email was sent by Solara Insights. If you have questions, please contact us at support@solarainsights.com.
              </p>
              <p style="margin: 10px 0 0; font-size: 12px; color: #999; text-align: center;">
                © ${new Date().getFullYear()} Solara Insights. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * Plain text email template for password reset
 */
function getPasswordResetEmailText(resetLink: string): string {
  return `
Solara Insights - Password Reset

We received a request to reset the password for your Solara account.

Click this link to reset your password:
${resetLink}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.

If you have questions, please contact us at support@solarainsights.com.

© ${new Date().getFullYear()} Solara Insights. All rights reserved.
`.trim();
}
