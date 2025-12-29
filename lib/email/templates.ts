/**
 * Shared email templates for Solara
 *
 * All transactional emails use consistent branding and structure.
 * Templates are exported as functions that return { html, text } objects.
 */

const BRAND = {
  name: "Solara Insights",
  tagline: "Your cosmic guide to self-discovery",
  support: "support@solarainsights.com",
  goldGradient: "linear-gradient(135deg, #C9A227 0%, #D4AF37 100%)",
} as const;

/**
 * Base email wrapper with consistent styling
 */
function wrapHtml(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #eaeaea;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: #1a1a1a;">${BRAND.name}</h1>
              <p style="margin: 10px 0 0; font-size: 14px; color: #666;">${BRAND.tagline}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 40px; background-color: #fafafa; border-top: 1px solid #eaeaea; border-radius: 0 0 12px 12px;">
              <p style="margin: 0; font-size: 12px; color: #999; text-align: center;">
                &copy; ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Gold CTA button
 */
function ctaButton(link: string, text: string): string {
  return `<table role="presentation" style="width: 100%; border-collapse: collapse;">
  <tr>
    <td align="center" style="padding: 20px 0;">
      <a href="${link}" style="display: inline-block; padding: 14px 32px; background: ${BRAND.goldGradient}; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
        ${text}
      </a>
    </td>
  </tr>
</table>`;
}

// =============================================================================
// Email Templates
// =============================================================================

export interface EmailTemplate {
  html: string;
  text: string;
}

/**
 * Email verification (new users from /welcome)
 */
export function verificationEmail(link: string): EmailTemplate {
  const html = wrapHtml(
    "Verify Your Email",
    `<h2 style="margin: 0 0 20px; font-size: 22px; font-weight: 600; color: #1a1a1a;">Verify Your Email</h2>
<p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
  Welcome to Solara! Click the button below to verify your email and set your password.
</p>
${ctaButton(link, "Verify Email")}
<p style="margin: 20px 0 0; font-size: 14px; color: #666;">
  This link expires in 24 hours.
</p>`
  );

  const text = `${BRAND.name} - Verify Your Email

Welcome to Solara! Click this link to verify your email and set your password:
${link}

This link expires in 24 hours.

© ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.`;

  return { html, text };
}

/**
 * Sign-in email (existing onboarded users)
 */
export function signInEmail(link: string): EmailTemplate {
  const html = wrapHtml(
    "Sign in to Solara",
    `<h2 style="margin: 0 0 20px; font-size: 22px; font-weight: 600; color: #1a1a1a;">Sign In</h2>
<p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
  Click below to sign in to your Solara account.
</p>
${ctaButton(link, "Sign In")}
<p style="margin: 20px 0 0; font-size: 14px; color: #666;">
  If you didn't request this, you can safely ignore this email.
</p>`
  );

  const text = `${BRAND.name} - Sign In

Click this link to sign in to your Solara account:
${link}

If you didn't request this, you can safely ignore this email.

© ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.`;

  return { html, text };
}

/**
 * Password reset email
 */
export function passwordResetEmail(link: string): EmailTemplate {
  const html = wrapHtml(
    "Reset Your Password",
    `<h2 style="margin: 0 0 20px; font-size: 22px; font-weight: 600; color: #1a1a1a;">Reset Your Password</h2>
<p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
  We received a request to reset the password for your Solara account. Click the button below to create a new password.
</p>
${ctaButton(link, "Reset Password")}
<p style="margin: 20px 0 0; font-size: 14px; line-height: 1.6; color: #666;">
  This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
</p>
<p style="margin: 20px 0 0; font-size: 14px; line-height: 1.6; color: #666;">
  If the button doesn't work, copy and paste this link into your browser:
</p>
<p style="margin: 10px 0 0; font-size: 12px; line-height: 1.6; color: #999; word-break: break-all;">
  ${link}
</p>`
  );

  const text = `${BRAND.name} - Password Reset

We received a request to reset the password for your Solara account.

Click this link to reset your password:
${link}

This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.

If you have questions, please contact us at ${BRAND.support}.

© ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.`;

  return { html, text };
}

/**
 * Welcome email after Stripe checkout
 */
export function welcomeEmail(plan: "individual" | "family", appUrl: string): EmailTemplate {
  const planName = plan === "family" ? "Family" : "Individual";
  const familyFeature = plan === "family" ? "<li>Up to 5 family member profiles</li>" : "";

  const html = wrapHtml(
    "Welcome to Solara",
    `<h2 style="margin: 0 0 20px; font-size: 22px; font-weight: 600; color: #1a1a1a;">Welcome to Solara!</h2>
<p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
  Your ${planName} membership is now active.
</p>
<p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
  Your 7-day free trial has begun. During this time, you'll have full access to:
</p>
<ul style="margin: 0 0 20px; padding-left: 20px; font-size: 16px; line-height: 1.8; color: #4a4a4a;">
  <li>Daily, weekly, monthly, and yearly insights</li>
  <li>Complete birth chart analysis</li>
  <li>Relationship insights</li>
  <li>Journaling with guided prompts</li>
  ${familyFeature}
</ul>
${ctaButton(`${appUrl}/welcome`, "Finish Setting Up Your Sanctuary")}
<p style="margin: 20px 0 0; font-size: 14px; color: #666;">
  A portion of your subscription supports families through the Solara Foundation.
</p>`
  );

  const text = `${BRAND.name} - Welcome!

Your ${planName} membership is now active.

Your 7-day free trial has begun. During this time, you'll have full access to:
- Daily, weekly, monthly, and yearly insights
- Complete birth chart analysis
- Relationship insights
- Journaling with guided prompts
${plan === "family" ? "- Up to 5 family member profiles\n" : ""}
Finish setting up your Sanctuary: ${appUrl}/welcome

A portion of your subscription supports families through the Solara Foundation.

Stay luminous,
The Solara Team

© ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.`;

  return { html, text };
}

/**
 * Continue setup email (existing non-onboarded users)
 */
export function continueSetupEmail(link: string): EmailTemplate {
  const html = wrapHtml(
    "Continue Setting Up Solara",
    `<h2 style="margin: 0 0 20px; font-size: 22px; font-weight: 600; color: #1a1a1a;">Continue Your Setup</h2>
<p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #4a4a4a;">
  You're almost there! Click the button below to continue setting up your Solara account.
</p>
${ctaButton(link, "Continue Setup")}
<p style="margin: 20px 0 0; font-size: 14px; color: #666;">
  This link expires in 24 hours.
</p>`
  );

  const text = `${BRAND.name} - Continue Your Setup

You're almost there! Click this link to continue setting up your Solara account:
${link}

This link expires in 24 hours.

© ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.`;

  return { html, text };
}
