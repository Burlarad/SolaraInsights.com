import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { resend, RESEND_CONFIG, isResendConfigured } from "@/lib/resend/client";
import { checkRateLimit } from "@/lib/cache/rateLimit";
import { verificationEmail, signInEmail, continueSetupEmail } from "@/lib/email/templates";

/**
 * POST /api/auth/resend-signup-link
 *
 * Resends a magic link for signup verification or sign-in.
 * Rate limited to 1 request per 60 seconds per (email + session_id).
 *
 * Body:
 * - email: User's email address
 * - session_id: Stripe checkout session ID (validates they completed payment)
 *
 * Behavior:
 * - If user exists: send sign-in link (redirect based on onboarding status)
 * - If user doesn't exist: send verification link (redirect to onboarding)
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const body = await req.json();
    const { email, session_id } = body;

    // Validate required fields
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!session_id || typeof session_id !== "string") {
      return NextResponse.json(
        { error: "session_id is required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!session_id.startsWith("cs_")) {
      return NextResponse.json(
        { error: "Invalid session_id format" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Rate limit: 1 resend per 60 seconds per email+session combo
    const rateLimitKey = `resend-signup:${email.toLowerCase()}:${session_id}`;
    const rateLimit = await checkRateLimit(rateLimitKey, 1, 60);

    if (!rateLimit.success) {
      const retryAfter = Math.ceil((rateLimit.resetAt - Date.now()) / 1000);
      console.log(`[ResendSignup:${requestId}] Rate limited for ${email}`);
      return NextResponse.json(
        {
          error: "rate_limited",
          message: "Please wait before requesting another email.",
          retryAfterSeconds: retryAfter,
        },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      );
    }

    console.log(`[ResendSignup:${requestId}] Processing resend for: ${email}`);

    // Check Resend is configured
    if (!isResendConfigured()) {
      console.error(`[ResendSignup:${requestId}] Resend not configured`);
      return NextResponse.json(
        { error: "Email service unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Retrieve Stripe checkout session (authoritative source)
    let stripeSession;
    try {
      stripeSession = await stripe.checkout.sessions.retrieve(session_id);
    } catch (stripeError: any) {
      console.error(`[ResendSignup:${requestId}] Stripe error:`, stripeError.message);
      return NextResponse.json(
        { error: "Invalid or expired checkout session" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Require session to be complete
    if (stripeSession.status !== "complete") {
      console.log(`[ResendSignup:${requestId}] Session not complete: ${stripeSession.status}`);
      return NextResponse.json(
        { error: "Checkout session is not complete" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const admin = createAdminSupabaseClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://solarainsights.com";

    // Check if user already exists
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find(
      u => u.email?.toLowerCase() === email.trim().toLowerCase()
    );

    let redirectTo: string;
    let subject: string;
    let isExistingUser = false;
    let isOnboarded = false;

    if (existingUser) {
      isExistingUser = true;

      // Check onboarding status (same indicator as protected layout)
      const { data: profile } = await admin
        .from("profiles")
        .select("is_onboarded")
        .eq("id", existingUser.id)
        .single();

      isOnboarded = profile?.is_onboarded === true;

      // Redirect based on onboarding status
      redirectTo = isOnboarded
        ? `${appUrl}/auth/callback?next=/sanctuary`
        : `${appUrl}/auth/callback?next=/set-password`;

      subject = isOnboarded ? "Sign in to Solara" : "Continue setting up Solara";
      console.log(`[ResendSignup:${requestId}] Existing user, onboarded: ${isOnboarded}`);
    } else {
      // New user - goes to set-password after verification
      redirectTo = `${appUrl}/auth/callback?next=/set-password`;
      subject = "Verify your email to enter Solara";
      console.log(`[ResendSignup:${requestId}] New user, will go to set-password`);
    }

    // Generate magic link
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: email.trim(),
      options: {
        redirectTo,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error(`[ResendSignup:${requestId}] generateLink error:`, linkError?.message);
      return NextResponse.json(
        { error: "Failed to generate email link" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const magicLink = linkData.properties.action_link;

    // Choose template based on user state
    const emailTemplate = isExistingUser && isOnboarded
      ? signInEmail(magicLink)
      : isExistingUser
        ? continueSetupEmail(magicLink)
        : verificationEmail(magicLink);

    // Send email via Resend
    const { error: emailError } = await resend.emails.send({
      from: RESEND_CONFIG.fromEmail,
      to: email.trim(),
      subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    if (emailError) {
      console.error(`[ResendSignup:${requestId}] Resend error:`, emailError.message);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    console.log(`[ResendSignup:${requestId}] Email sent successfully`);

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    console.error(`[ResendSignup:${requestId}] Unexpected error:`, error.message);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
