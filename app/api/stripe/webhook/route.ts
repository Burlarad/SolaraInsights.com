import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, STRIPE_CONFIG } from "@/lib/stripe/client";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { resend, RESEND_CONFIG } from "@/lib/resend/client";

/**
 * Stripe webhook handler
 * Handles subscription lifecycle events from Stripe
 */
export async function POST(req: NextRequest) {
  try {
    // Get the raw body as text
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    if (!STRIPE_CONFIG.webhookSecret) {
      console.error("[Webhook] STRIPE_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 }
      );
    }

    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        STRIPE_CONFIG.webhookSecret
      );
    } catch (err: any) {
      console.error("[Webhook] Signature verification failed:", err.message);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    console.log(`[Webhook] Received event: ${event.type}`);

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[Webhook] Error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed", message: error.message },
      { status: 500 }
    );
  }
}

/**
 * Handle checkout.session.completed
 * Creates or updates user profile with membership details
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log("[Webhook] Processing checkout.session.completed");

  const email = session.customer_details?.email || session.customer_email;
  const plan = session.metadata?.plan as "individual" | "family" | undefined;
  const userId = session.metadata?.userId;
  const customerId = session.customer as string | null;
  const subscriptionId = session.subscription as string | null;

  if (!email) {
    console.error("[Webhook] No email found in checkout session");
    return;
  }

  if (!plan) {
    console.error("[Webhook] No plan found in metadata");
    return;
  }

  const supabase = createAdminSupabaseClient();

  // Find or create user
  let profileUserId: string;

  if (userId) {
    // User was authenticated during checkout
    profileUserId = userId;
  } else {
    // User was not authenticated - need to find or create
    // First, try to find existing user by email
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find(u => u.email === email);

    if (existingUser) {
      profileUserId = existingUser.id;
    } else {
      // Create new user with random password (they'll set it in /welcome)
      const randomPassword = Math.random().toString(36).slice(-16) + Math.random().toString(36).slice(-16);

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: randomPassword,
        email_confirm: true, // Auto-confirm since they paid
      });

      if (createError || !newUser.user) {
        console.error("[Webhook] Failed to create user:", createError);
        return;
      }

      profileUserId = newUser.user.id;
    }
  }

  // Fetch subscription to get trial status
  let subscriptionStatus: "trialing" | "active" | null = null;
  if (subscriptionId && typeof subscriptionId === "string") {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      subscriptionStatus = subscription.status === "trialing" ? "trialing" : "active";
    } catch (err) {
      console.error("[Webhook] Failed to fetch subscription:", err);
      subscriptionStatus = "active"; // Fallback
    }
  }

  // Update profile with membership details
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      membership_plan: plan,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      subscription_status: subscriptionStatus,
      subscription_start_date: new Date().toISOString(),
    })
    .eq("id", profileUserId);

  if (updateError) {
    console.error("[Webhook] Failed to update profile:", updateError);
    return;
  }

  console.log(`[Webhook] Updated profile for user ${profileUserId} with ${plan} plan`);

  // Send welcome email
  await sendWelcomeEmail(email, plan);

  // TODO: Schedule reminder emails if is_onboarded === false
  // - Day 3: Gentle reminder to complete onboarding
  // - Day 5: Second reminder with tips
  // - Day 10: Final reminder before trial ends
}

/**
 * Handle customer.subscription.updated
 * Updates subscription status when it changes
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log("[Webhook] Processing customer.subscription.updated");

  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;
  const status = subscription.status;

  const supabase = createAdminSupabaseClient();

  // Map Stripe status to our schema
  let subscriptionStatus: "active" | "canceled" | "past_due" | "trialing" | null;
  switch (status) {
    case "active":
      subscriptionStatus = "active";
      break;
    case "canceled":
      subscriptionStatus = "canceled";
      break;
    case "past_due":
      subscriptionStatus = "past_due";
      break;
    case "trialing":
      subscriptionStatus = "trialing";
      break;
    default:
      subscriptionStatus = null;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      subscription_status: subscriptionStatus,
      subscription_end_date:
        status === "canceled" && subscription.cancel_at
          ? new Date(subscription.cancel_at * 1000).toISOString()
          : null,
    })
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error("[Webhook] Failed to update subscription status:", error);
    return;
  }

  console.log(`[Webhook] Updated subscription status to ${subscriptionStatus} for customer ${customerId}`);
}

/**
 * Handle customer.subscription.deleted
 * Marks subscription as canceled when deleted
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log("[Webhook] Processing customer.subscription.deleted");

  const customerId = subscription.customer as string;

  const supabase = createAdminSupabaseClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      subscription_status: "canceled",
      subscription_end_date: new Date().toISOString(),
    })
    .eq("stripe_customer_id", customerId);

  if (error) {
    console.error("[Webhook] Failed to mark subscription as canceled:", error);
    return;
  }

  console.log(`[Webhook] Marked subscription as canceled for customer ${customerId}`);
}

/**
 * Send welcome email after successful payment
 */
async function sendWelcomeEmail(email: string, plan: "individual" | "family") {
  try {
    const appUrl =
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    await resend.emails.send({
      from: RESEND_CONFIG.fromEmail,
      to: email,
      subject: "Your Solara Sanctuary membership is active",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #D4AF37; text-align: center;">Welcome to Solara</h1>

          <p>Your ${plan === "family" ? "Family" : "Individual"} membership is now active.</p>

          <p>Your 7-day free trial has begun. During this time, you'll have full access to:</p>

          <ul>
            <li>Daily, weekly, monthly, and yearly insights</li>
            <li>Complete birth chart analysis</li>
            <li>Relationship insights</li>
            <li>Journaling with guided prompts</li>
            ${plan === "family" ? "<li>Up to 5 family member profiles</li>" : ""}
          </ul>

          <p style="text-align: center; margin: 32px 0;">
            <a
              href="${appUrl}/welcome"
              style="background-color: #D4AF37; color: #1A1A1A; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;"
            >
              Finish setting up your Sanctuary
            </a>
          </p>

          <p style="color: #666; font-size: 14px;">
            A portion of your subscription supports families through the Solara Foundation.
          </p>

          <p style="color: #666; font-size: 14px;">
            Stay luminous,<br />
            The Solara Team
          </p>
        </div>
      `,
    });

    console.log(`[Webhook] Welcome email sent to ${email}`);
  } catch (error) {
    console.error("[Webhook] Failed to send welcome email:", error);
    // Don't throw - email failure shouldn't fail the webhook
  }
}
