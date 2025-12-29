import Stripe from "stripe";
import { stripe, STRIPE_CONFIG } from "./client";
import { SupabaseClient } from "@supabase/supabase-js";

type MembershipPlan = "individual" | "family";

export interface ClaimResult {
  claimed: boolean;
  reason?: string;
  plan?: MembershipPlan;
}

/**
 * Resolve membership plan from a Stripe checkout session.
 *
 * Priority:
 * 1. session.metadata.plan (if present and valid)
 * 2. Infer from line item price ID
 */
function resolvePlanFromSession(
  session: Stripe.Checkout.Session
): MembershipPlan | null {
  // 1. Check metadata first
  const metadataPlan = session.metadata?.plan;
  if (metadataPlan === "individual" || metadataPlan === "family") {
    return metadataPlan;
  }

  // 2. Check line items price ID
  const lineItems = session.line_items?.data;
  if (!lineItems || lineItems.length === 0) {
    return null;
  }

  const price = lineItems[0].price;
  if (!price) {
    return null;
  }

  const priceId = price.id;
  const individualPriceId = STRIPE_CONFIG.priceIds.sanctuary;
  const familyPriceId = STRIPE_CONFIG.priceIds.family;

  if (priceId === individualPriceId) {
    return "individual";
  }

  if (priceId === familyPriceId) {
    return "family";
  }

  return null;
}

/**
 * Claim a Stripe checkout session for the current authenticated user.
 *
 * This links the payment to the user by ID (not email), fixing the
 * identity mismatch issue where OAuth users have different emails
 * than the Stripe checkout email.
 *
 * @param sessionId - Stripe checkout session ID (cs_...)
 * @param userId - Current authenticated Supabase user ID
 * @param supabase - Supabase client with admin privileges
 */
export async function claimCheckoutSession(
  sessionId: string,
  userId: string,
  supabase: SupabaseClient
): Promise<ClaimResult> {
  const logPrefix = `[ClaimSession]`;

  try {
    // Validate session ID format
    if (!sessionId || !sessionId.startsWith("cs_")) {
      return { claimed: false, reason: "Invalid session ID format" };
    }

    console.log(`${logPrefix} Claiming session ${sessionId} for user ${userId}`);

    // Retrieve the checkout session with expanded data
    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["subscription", "line_items.data.price"],
      });
    } catch (err: any) {
      console.error(`${logPrefix} Failed to retrieve session:`, err.message);
      return { claimed: false, reason: "Failed to retrieve checkout session" };
    }

    // Validate session status
    if (session.status !== "complete") {
      console.log(`${logPrefix} Session not complete: ${session.status}`);
      return { claimed: false, reason: `Session status is ${session.status}` };
    }

    // Check if payment was successful
    if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
      console.log(`${logPrefix} Payment not complete: ${session.payment_status}`);
      return { claimed: false, reason: `Payment status is ${session.payment_status}` };
    }

    // Extract Stripe data
    const stripeEmail = session.customer_details?.email || session.customer_email || null;
    const stripeCustomerId = typeof session.customer === "string" ? session.customer : null;
    const stripeSubscriptionId = typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription as Stripe.Subscription | null)?.id || null;

    // Determine subscription status
    let subscriptionStatus: "trialing" | "active" | null = null;
    if (session.subscription && typeof session.subscription === "object") {
      const sub = session.subscription as Stripe.Subscription;
      subscriptionStatus = sub.status === "trialing" ? "trialing" : "active";
    } else if (stripeSubscriptionId) {
      // Fetch subscription separately if only ID was returned
      try {
        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        subscriptionStatus = subscription.status === "trialing" ? "trialing" : "active";
      } catch {
        subscriptionStatus = "active"; // Fallback
      }
    }

    // Resolve membership plan
    const plan = resolvePlanFromSession(session);
    if (!plan) {
      console.error(`${logPrefix} Unable to resolve plan from session`);
      return { claimed: false, reason: "Unable to determine membership plan" };
    }

    console.log(`${logPrefix} Resolved: plan=${plan}, status=${subscriptionStatus}, email=${stripeEmail}`);

    // Check if user already has active membership
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("membership_plan, subscription_status")
      .eq("id", userId)
      .single();

    if (existingProfile) {
      const alreadyActive =
        (existingProfile.membership_plan === "individual" || existingProfile.membership_plan === "family") &&
        (existingProfile.subscription_status === "trialing" || existingProfile.subscription_status === "active");

      if (alreadyActive) {
        console.log(`${logPrefix} User already has active membership, skipping update`);
        return { claimed: true, reason: "Already has active membership", plan };
      }
    }

    // Update the current user's profile with membership data
    const updateData: Record<string, unknown> = {
      membership_plan: plan,
      subscription_status: subscriptionStatus,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      subscription_start_date: new Date().toISOString(),
    };

    // Store Stripe email separately (for billing display in Settings)
    if (stripeEmail) {
      updateData.stripe_email = stripeEmail;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", userId);

    if (updateError) {
      console.error(`${logPrefix} Failed to update profile:`, updateError.message);
      return { claimed: false, reason: `Database update failed: ${updateError.message}` };
    }

    console.log(`${logPrefix} Successfully claimed session for user ${userId}`);
    return { claimed: true, plan };
  } catch (error: any) {
    console.error(`${logPrefix} Unexpected error:`, error.message);
    return { claimed: false, reason: error.message };
  }
}
