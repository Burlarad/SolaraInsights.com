import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, STRIPE_CONFIG } from "@/lib/stripe/client";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { resend, RESEND_CONFIG } from "@/lib/resend/client";

type MembershipPlan = "individual" | "family";

/**
 * Resolve the membership plan from a checkout session.
 *
 * Priority:
 * 1. session.metadata.plan (if present and valid)
 * 2. Infer from line item price ID (compare against STRIPE_PRICE_ID / STRIPE_FAMILY_PRICE_ID)
 *
 * @returns The resolved plan info, or null if unable to determine
 */
async function resolvePlanFromSession(
  session: Stripe.Checkout.Session
): Promise<{ plan: MembershipPlan; priceId: string; source: "metadata" | "price_id" } | null> {
  // 1. Check metadata first
  const metadataPlan = session.metadata?.plan;
  if (metadataPlan === "individual" || metadataPlan === "family") {
    console.log(`[Webhook] Plan resolved from metadata: ${metadataPlan}`);
    return { plan: metadataPlan, priceId: "(from metadata)", source: "metadata" };
  }

  // 2. Retrieve session with expanded line_items to get price ID
  console.log(`[Webhook] No valid metadata.plan, retrieving session with line_items...`);

  let expandedSession: Stripe.Checkout.Session;
  try {
    expandedSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["line_items.data.price"],
    });
  } catch (err: any) {
    console.error(`[Webhook] Failed to retrieve expanded session: ${err.message}`);
    return null;
  }

  // Get the first line item's price ID
  const lineItems = expandedSession.line_items?.data;
  if (!lineItems || lineItems.length === 0) {
    console.error(`[Webhook] No line items found in session ${session.id}`);
    return null;
  }

  const firstLineItem = lineItems[0];
  const price = firstLineItem.price;
  if (!price) {
    console.error(`[Webhook] No price found on line item for session ${session.id}`);
    return null;
  }

  const priceId = price.id;
  console.log(`[Webhook] Found price ID: ${priceId}`);

  // 3. Compare against configured price IDs
  const individualPriceId = STRIPE_CONFIG.priceIds.sanctuary;
  const familyPriceId = STRIPE_CONFIG.priceIds.family;

  if (priceId === individualPriceId) {
    console.log(`[Webhook] Price ID matches STRIPE_PRICE_ID → individual plan`);
    return { plan: "individual", priceId, source: "price_id" };
  }

  if (priceId === familyPriceId) {
    console.log(`[Webhook] Price ID matches STRIPE_FAMILY_PRICE_ID → family plan`);
    return { plan: "family", priceId, source: "price_id" };
  }

  // 4. No match found
  console.error(`[Webhook] Unknown price ID: ${priceId}`);
  console.error(`[Webhook] Expected individual (STRIPE_PRICE_ID): ${individualPriceId || "(not set)"}`);
  console.error(`[Webhook] Expected family (STRIPE_FAMILY_PRICE_ID): ${familyPriceId || "(not set)"}`);
  return null;
}

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
      case "checkout.session.completed": {
        const result = await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        if (!result.success) {
          // Return 400 for plan resolution failures so Stripe knows something went wrong
          return NextResponse.json(
            { error: result.error },
            { status: 400 }
          );
        }
        break;
      }

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
 *
 * Works with both:
 * - Custom checkout (has metadata.plan and metadata.userId)
 * - Pricing Table checkout (no metadata, must infer from price ID)
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<{ success: boolean; error?: string }> {
  console.log("[Webhook] ========== CHECKOUT PROCESSING ==========");
  console.log(`[Webhook] Session ID: ${session.id}`);
  console.log(`[Webhook] Mode: ${session.mode}`);

  const email = session.customer_details?.email || session.customer_email;
  const metadataUserId = session.metadata?.userId;
  const customerId = session.customer as string | null;
  const subscriptionId = session.subscription as string | null;

  console.log(`[Webhook] Email: ${email || "(none)"}`);
  console.log(`[Webhook] Metadata userId: ${metadataUserId || "(none)"}`);
  console.log(`[Webhook] Customer ID: ${customerId || "(none)"}`);
  console.log(`[Webhook] Subscription ID: ${subscriptionId || "(none)"}`);

  // Validate email
  if (!email) {
    const error = "No email found in checkout session";
    console.error(`[Webhook] ${error}`);
    return { success: false, error };
  }

  // Resolve plan (metadata or price ID inference)
  const planResult = await resolvePlanFromSession(session);
  if (!planResult) {
    const error = `Unable to determine plan for session ${session.id}. Check STRIPE_PRICE_ID and STRIPE_FAMILY_PRICE_ID env vars.`;
    console.error(`[Webhook] ${error}`);
    return { success: false, error };
  }

  const { plan, priceId, source } = planResult;
  console.log(`[Webhook] Resolved plan: ${plan} (source: ${source}, priceId: ${priceId})`);

  const supabase = createAdminSupabaseClient();

  // Find or create user
  let profileUserId: string;

  if (metadataUserId) {
    // User was authenticated during checkout
    console.log(`[Webhook] Using userId from metadata: ${metadataUserId}`);
    profileUserId = metadataUserId;
  } else {
    // User was not authenticated (Pricing Table flow) - find or create by email
    console.log(`[Webhook] No metadata.userId, finding/creating user by email...`);

    // First, try to find existing user by email
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find(u => u.email === email);

    if (existingUser) {
      console.log(`[Webhook] Found existing user: ${existingUser.id}`);
      profileUserId = existingUser.id;
    } else {
      // Create new user with random password (they'll set it in /welcome)
      console.log(`[Webhook] Creating new user for email: ${email}`);
      const randomPassword = Math.random().toString(36).slice(-16) + Math.random().toString(36).slice(-16);

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: randomPassword,
        email_confirm: true, // Auto-confirm since they paid
      });

      if (createError || !newUser.user) {
        const error = `Failed to create user: ${createError?.message || "Unknown error"}`;
        console.error(`[Webhook] ${error}`);
        return { success: false, error };
      }

      console.log(`[Webhook] Created new user: ${newUser.user.id}`);
      profileUserId = newUser.user.id;
    }
  }

  // Fetch subscription to get trial status
  let subscriptionStatus: "trialing" | "active" | null = null;
  if (subscriptionId && typeof subscriptionId === "string") {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      subscriptionStatus = subscription.status === "trialing" ? "trialing" : "active";
      console.log(`[Webhook] Subscription status: ${subscriptionStatus}`);
    } catch (err: any) {
      console.error(`[Webhook] Failed to fetch subscription: ${err.message}`);
      subscriptionStatus = "active"; // Fallback
    }
  }

  // Update profile with membership details
  const updateData = {
    membership_plan: plan,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    subscription_status: subscriptionStatus,
    subscription_start_date: new Date().toISOString(),
  };

  console.log(`[Webhook] Updating profile ${profileUserId} with:`, JSON.stringify(updateData, null, 2));

  const { error: updateError, count } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", profileUserId);

  if (updateError) {
    const error = `Failed to update profile: ${updateError.message}`;
    console.error(`[Webhook] ${error}`);
    return { success: false, error };
  }

  console.log(`[Webhook] Profile updated successfully (rows affected: ${count ?? "unknown"})`);
  console.log("[Webhook] ========== CHECKOUT COMPLETE ==========");

  // Send welcome email
  await sendWelcomeEmail(email, plan);

  return { success: true };
}

/**
 * Handle customer.subscription.updated
 * Updates subscription status when it changes
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log("[Webhook] Processing customer.subscription.updated");

  const customerId = subscription.customer as string;
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
async function sendWelcomeEmail(email: string, plan: MembershipPlan) {
  try {
    const appUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
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
