import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { resend, RESEND_CONFIG, isResendConfigured } from "@/lib/resend/client";
import { verificationEmail, signInEmail } from "@/lib/email/templates";
import { claimCheckoutSession } from "@/lib/stripe/claimCheckoutSession";
import { checkRateLimit } from "@/lib/cache/rateLimit";

/**
 * POST /api/auth/complete-signup
 *
 * Sends email verification for users completing signup after Stripe checkout.
 * Creates Supabase user and sends verification email.
 *
 * Body:
 * - email: User's email address
 * - session_id: Stripe checkout session ID
 *
 * Flow:
 * 1. Validate Stripe session is complete
 * 2. Create user in Supabase (unconfirmed)
 * 3. Send verification email with link to /set-password
 * 4. User clicks link → /set-password → /onboarding
 *
 * If user already exists (webhook race): sends magiclink instead
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

    // Rate limit: 5 requests per hour (3600 seconds) per email
    const rateLimitKey = `complete-signup:${email.toLowerCase()}`;
    const rateLimitResult = await checkRateLimit(rateLimitKey, 5, 3600);

    if (!rateLimitResult.success) {
      console.log(`[CompleteSignup:${requestId}] Rate limited for email: ${email}`);
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again later." },
        { status: 429, headers: { "Cache-Control": "no-store" } }
      );
    }

    console.log(`[CompleteSignup:${requestId}] Processing signup for: ${email}`);

    // Retrieve Stripe checkout session
    let stripeSession;
    try {
      stripeSession = await stripe.checkout.sessions.retrieve(session_id);
    } catch (stripeError: any) {
      console.error(`[CompleteSignup:${requestId}] Stripe error:`, stripeError.message);
      return NextResponse.json(
        { error: "Invalid or expired checkout session" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Require session to be complete
    if (stripeSession.status !== "complete") {
      console.log(`[CompleteSignup:${requestId}] Session not complete: ${stripeSession.status}`);
      return NextResponse.json(
        { error: "Checkout session is not complete" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    // Check Resend is configured
    if (!isResendConfigured()) {
      console.error(`[CompleteSignup:${requestId}] Resend not configured`);
      return NextResponse.json(
        { error: "Email service unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const admin = createAdminSupabaseClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://solarainsights.com";

    // Check if user already exists
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find(
      u => u.email?.toLowerCase() === email.trim().toLowerCase()
    );

    if (existingUser) {
      console.log(`[CompleteSignup:${requestId}] User already exists, sending magiclink`);
      return handleExistingUserFlow(admin, existingUser, appUrl, requestId, session_id);
    }

    // Create user (unconfirmed - will verify via email)
    // Generate a random temporary password (user will set real password on /set-password)
    const tempPassword = crypto.randomUUID();

    const { data: userData, error: createError } = await admin.auth.admin.createUser({
      email: email.trim(),
      password: tempPassword,
      email_confirm: false,
    });

    if (createError) {
      // Double-check for race condition - need to look up the user
      if (createError.message.includes("already") || createError.message.includes("exists")) {
        console.log(`[CompleteSignup:${requestId}] Race condition - user exists, looking up...`);
        const { data: raceUsers } = await admin.auth.admin.listUsers();
        const raceUser = raceUsers?.users.find(
          u => u.email?.toLowerCase() === email.trim().toLowerCase()
        );
        if (raceUser) {
          return handleExistingUserFlow(admin, raceUser, appUrl, requestId, session_id);
        }
      }

      console.error(`[CompleteSignup:${requestId}] Create user error:`, createError.message);
      return NextResponse.json(
        { error: createError.message || "Failed to create user" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!userData.user) {
      console.error(`[CompleteSignup:${requestId}] No user returned from createUser`);
      return NextResponse.json(
        { error: "Failed to create user" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const userId = userData.user.id;
    console.log(`[CompleteSignup:${requestId}] Created user: ${userId}`);

    // Create profile row
    const { error: profileError } = await admin
      .from("profiles")
      .upsert({
        id: userId,
        email: email.trim(),
        timezone: "UTC",
        language: "en",
        is_onboarded: false,
        is_comped: false,
        role: "user",
        social_insights_enabled: false,
        is_hibernated: false,
        stripe_customer_id: typeof stripeSession.customer === "string"
          ? stripeSession.customer
          : stripeSession.customer?.id || null,
      }, { onConflict: "id" });

    if (profileError) {
      console.error(`[CompleteSignup:${requestId}] Profile creation error:`, profileError.message);
    } else {
      console.log(`[CompleteSignup:${requestId}] Profile created`);
    }

    // Claim the Stripe checkout session to set membership_plan and subscription_status
    // This ensures the user has active membership when they reach /onboarding
    // (Cookie-based claiming fails if email verification takes > 15 minutes)
    const claimResult = await claimCheckoutSession(session_id, userId, admin);
    if (claimResult.claimed) {
      console.log(`[CompleteSignup:${requestId}] Stripe session claimed: plan=${claimResult.plan}`);
    } else {
      console.warn(`[CompleteSignup:${requestId}] Stripe session claim failed: ${claimResult.reason}`);
      // Continue anyway - webhook may have already processed, or will process later
    }

    // Generate verification link → redirect to /set-password after verification
    const redirectTo = `${appUrl}/auth/callback?next=/set-password`;

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: email.trim(),
      options: {
        redirectTo,
      },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error(`[CompleteSignup:${requestId}] generateLink error:`, linkError?.message);
      return NextResponse.json(
        { error: "Failed to generate verification link" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const verificationLink = linkData.properties.action_link;

    // Send verification email
    const verification = verificationEmail(verificationLink);
    const { error: emailError } = await resend.emails.send({
      from: RESEND_CONFIG.fromEmail,
      to: email.trim(),
      subject: "Verify your email to enter Solara",
      html: verification.html,
      text: verification.text,
    });

    if (emailError) {
      console.error(`[CompleteSignup:${requestId}] Resend error:`, emailError.message);
      return NextResponse.json(
        { error: "Failed to send verification email" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    console.log(`[CompleteSignup:${requestId}] Verification email sent`);

    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    console.error(`[CompleteSignup:${requestId}] Unexpected error:`, error.message);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

/**
 * Handle existing user - send magiclink based on onboarding status
 */
async function handleExistingUserFlow(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  user: { id: string; email?: string },
  appUrl: string,
  requestId: string,
  sessionId: string
): Promise<NextResponse> {
  const email = user.email;
  if (!email) {
    return NextResponse.json(
      { error: "User has no email" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  // Claim the Stripe checkout session for existing user
  // This ensures membership is linked even if webhook hasn't processed yet
  const claimResult = await claimCheckoutSession(sessionId, user.id, admin);
  if (claimResult.claimed) {
    console.log(`[CompleteSignup:${requestId}] Stripe session claimed for existing user: plan=${claimResult.plan}`);
  } else {
    console.warn(`[CompleteSignup:${requestId}] Stripe session claim failed for existing user: ${claimResult.reason}`);
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("is_onboarded")
    .eq("id", user.id)
    .single();

  const isOnboarded = profile?.is_onboarded === true;
  console.log(`[CompleteSignup:${requestId}] Existing user onboarded: ${isOnboarded}`);

  // Redirect based on status
  const redirectTo = isOnboarded
    ? `${appUrl}/auth/callback?next=/sanctuary`
    : `${appUrl}/auth/callback?next=/set-password`;

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.error(`[CompleteSignup:${requestId}] generateLink error:`, linkError?.message);
    return NextResponse.json(
      { error: "Failed to send sign-in link" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const signInLink = linkData.properties.action_link;

  const emailTemplate = isOnboarded
    ? signInEmail(signInLink)
    : verificationEmail(signInLink);
  const { error: emailError } = await resend.emails.send({
    from: RESEND_CONFIG.fromEmail,
    to: email,
    subject: isOnboarded ? "Sign in to Solara" : "Continue setting up Solara",
    html: emailTemplate.html,
    text: emailTemplate.text,
  });

  if (emailError) {
    console.error(`[CompleteSignup:${requestId}] Resend error:`, emailError.message);
  } else {
    console.log(`[CompleteSignup:${requestId}] Email sent to existing user`);
  }

  return NextResponse.json(
    { success: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}
