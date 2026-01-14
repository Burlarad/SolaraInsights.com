import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import Stripe from "stripe";
import { stripe, STRIPE_CONFIG } from "@/lib/stripe/client";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { resend, RESEND_CONFIG } from "@/lib/resend/client";
import { welcomeEmail } from "@/lib/email/templates";

type MembershipPlan = "individual" | "family";

/**
 * Foundation Ledger entry for tracking payments
 * Used for the give-back program
 */
interface FoundationLedgerEntry {
  entry_type: "accrual" | "disbursement";
  amount_cents: number;
  source: string;
  meta: Record<string, unknown>;
  stripe_event_id: string;
  country_code: string | null;
  region_code: string | null;
  city: string | null;
  user_id: string | null;
}

/**
 * Resolve the membership plan from a checkout session.
 *
 * Priority:
 * 1. session.metadata.plan (if present and valid)
 * 2. Infer from line item price ID (compare against configured price ids)
 */
async function resolvePlanFromSession(
  session: Stripe.Checkout.Session
): Promise<{ plan: MembershipPlan; priceId: string; source: "metadata" | "price_id" } | null> {
  // 1) Check metadata first
  const metadataPlan = session.metadata?.plan;
  if (metadataPlan === "individual" || metadataPlan === "family") {
    console.log(`[Webhook] Plan resolved from metadata: ${metadataPlan}`);
    return { plan: metadataPlan, priceId: "(from metadata)", source: "metadata" };
  }

  // 2) Retrieve session with expanded line_items to get price ID
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

  // 3) Compare against configured price IDs
  const individualPriceId = STRIPE_CONFIG.priceIds.sanctuary;
  const familyPriceId = STRIPE_CONFIG.priceIds.family;

  if (priceId === individualPriceId) {
    console.log(`[Webhook] Price ID matches configured sanctuary price → individual plan`);
    return { plan: "individual", priceId, source: "price_id" };
  }

  if (priceId === familyPriceId) {
    console.log(`[Webhook] Price ID matches configured family price → family plan`);
    return { plan: "family", priceId, source: "price_id" };
  }

  // 4) No match found
  console.error(`[Webhook] Unknown price ID: ${priceId}`);
  console.error(`[Webhook] Expected individual: ${individualPriceId || "(not set)"}`);
  console.error(`[Webhook] Expected family: ${familyPriceId || "(not set)"}`);
  return null;
}

/**
 * Stripe webhook handler
 * Handles subscription lifecycle events from Stripe
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    if (!STRIPE_CONFIG.webhookSecret) {
      console.error("[Webhook] STRIPE_WEBHOOK_SECRET not configured");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, STRIPE_CONFIG.webhookSecret);
    } catch (err: any) {
      console.error("[Webhook] Signature verification failed:", err.message);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    console.log(`[Webhook] Received event: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const result = await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        if (!result.success) {
          return NextResponse.json({ error: result.error }, { status: 400 });
        }
        break;
      }

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice, event.id);
        break;

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("[Webhook] Error:", error);
    return NextResponse.json({ error: "Webhook handler failed", message: error.message }, { status: 500 });
  }
}

/**
 * Handle checkout.session.completed
 * Creates or updates user profile with membership details
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<{ success: boolean; error?: string }> {
  console.log("[Webhook] ========== CHECKOUT PROCESSING ==========");
  console.log(`[Webhook] Session ID: ${session.id}`);
  console.log(`[Webhook] Mode: ${session.mode}`);

  const email = session.customer_details?.email || session.customer_email;
  const metadataUserId = session.metadata?.userId;
  const customerId = (session.customer as string) || null;
  const subscriptionId = (session.subscription as string) || null;

  console.log(`[Webhook] Email: ${email || "(none)"}`);
  console.log(`[Webhook] Metadata userId: ${metadataUserId || "(none)"}`);
  console.log(`[Webhook] Customer ID: ${customerId || "(none)"}`);
  console.log(`[Webhook] Subscription ID: ${subscriptionId || "(none)"}`);

  if (!email) {
    const error = "No email found in checkout session";
    console.error(`[Webhook] ${error}`);
    return { success: false, error };
  }

  const planResult = await resolvePlanFromSession(session);
  if (!planResult) {
    const error = `Unable to determine plan for session ${session.id}. Check configured Stripe price IDs in env.`;
    console.error(`[Webhook] ${error}`);
    return { success: false, error };
  }

  const { plan, priceId, source } = planResult;
  console.log(`[Webhook] Resolved plan: ${plan} (source: ${source}, priceId: ${priceId})`);

  const supabase = createAdminSupabaseClient();

  // Find or create user
  let profileUserId: string;

  if (metadataUserId) {
    console.log(`[Webhook] Using userId from metadata: ${metadataUserId}`);
    profileUserId = metadataUserId;
  } else {
    console.log(`[Webhook] No metadata.userId, finding/creating user by email...`);

    const { data: existingProfile } = await supabase.from("profiles").select("id").ilike("email", email).single();

    if (existingProfile) {
      console.log(`[Webhook] Found existing profile: ${existingProfile.id}`);
      profileUserId = existingProfile.id;
    } else {
      console.log(`[Webhook] Creating new user for email: ${email}`);
      const randomPassword = randomBytes(32).toString("hex");

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: randomPassword,
        email_confirm: true,
      });

      if (createError) {
        if (createError.message.includes("already") || createError.message.includes("exists")) {
          console.log(`[Webhook] User exists in auth, looking up...`);
          const { data: existingUsers } = await supabase.auth.admin.listUsers();
          const existingUser = existingUsers?.users.find((u) => u.email === email);
          if (existingUser) {
            console.log(`[Webhook] Found existing auth user: ${existingUser.id}`);
            profileUserId = existingUser.id;
          } else {
            const error = `User exists but lookup failed`;
            console.error(`[Webhook] ${error}`);
            return { success: false, error };
          }
        } else {
          const error = `Failed to create user: ${createError.message}`;
          console.error(`[Webhook] ${error}`);
          return { success: false, error };
        }
      } else if (!newUser.user) {
        const error = `Failed to create user: Unknown error`;
        console.error(`[Webhook] ${error}`);
        return { success: false, error };
      } else {
        console.log(`[Webhook] Created new user: ${newUser.user.id}`);
        profileUserId = newUser.user.id;
      }
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
      subscriptionStatus = "active";
    }
  }

  const updateData = {
    membership_plan: plan,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    subscription_status: subscriptionStatus,
    subscription_start_date: new Date().toISOString(),
  };

  console.log(`[Webhook] Updating profile ${profileUserId} with:`, JSON.stringify(updateData, null, 2));

  const { data: updatedRows, error: updateError } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", profileUserId)
    .select("id");

  if (updateError) {
    const error = `Failed to update profile: ${updateError.message}`;
    console.error(`[Webhook] ${error}`);
    return { success: false, error };
  }

  console.log(`[Webhook] Profile updated successfully (rows affected: ${updatedRows?.length ?? 0})`);
  console.log("[Webhook] ========== CHECKOUT COMPLETE ==========");

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

    const emailTemplate = welcomeEmail(plan, appUrl);
    await resend.emails.send({
      from: RESEND_CONFIG.fromEmail,
      to: email,
      subject: "Your Solara Sanctuary membership is active",
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    console.log(`[Webhook] Welcome email sent to ${email}`);
  } catch (error) {
    console.error("[Webhook] Failed to send welcome email:", error);
  }
}

/**
 * Handle invoice.payment_succeeded
 * Records an accrual entry in foundation_ledger for the give-back program.
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice, stripeEventId: string) {
  console.log("[Webhook] ========== INVOICE PAYMENT SUCCEEDED ==========");
  console.log(`[Webhook] Invoice ID: ${invoice.id}`);
  console.log(`[Webhook] Event ID: ${stripeEventId}`);
  console.log(`[Webhook] Amount paid: ${invoice.amount_paid} ${invoice.currency}`);

  // Skip $0 invoices (trials, free plans)
  if (invoice.amount_paid <= 0) {
    console.log("[Webhook] Skipping $0 invoice (trial or free plan)");
    return;
  }

  const supabase = createAdminSupabaseClient();

  // Extract location
  const location = await extractBillingLocation(invoice);

  // Try to find user by Stripe customer ID
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

  let userId: string | null = null;
  if (customerId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .single();

    if (profile) {
      userId = profile.id;
      console.log(`[Webhook] Mapped to user: ${userId}`);
    }
  }

  // Extract subscription + price/product (robust across Stripe type versions)
  const invoiceAny = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
  };

  const subscriptionId: string | null =
    typeof invoiceAny.subscription === "string"
      ? invoiceAny.subscription
      : invoiceAny.subscription?.id ?? (invoice as any)?.parent?.subscription_details?.subscription ?? null;

  let priceId: string | null = null;
  let productId: string | null = null;

  const firstLineAny = (invoice as any)?.lines?.data?.[0] as any;

  // Common shape: line.price
  const linePrice = firstLineAny?.price;
  if (typeof linePrice === "string") {
    priceId = linePrice;
  } else if (linePrice && typeof linePrice === "object") {
    priceId = typeof linePrice.id === "string" ? linePrice.id : null;
    const prod = linePrice.product;
    productId = typeof prod === "string" ? prod : prod?.id ?? null;
  }

  // Newer shape: pricing.price_details
  if (!priceId) {
    const pd = firstLineAny?.pricing?.price_details;

    const pdPrice = pd?.price;
    if (typeof pdPrice === "string") {
      priceId = pdPrice;
    } else if (pdPrice && typeof pdPrice === "object") {
      priceId = typeof pdPrice.id === "string" ? pdPrice.id : null;
    }

    const pdProduct = pd?.product;
    if (!productId) {
      if (typeof pdProduct === "string") {
        productId = pdProduct;
      } else if (pdProduct && typeof pdProduct === "object") {
        productId = typeof pdProduct.id === "string" ? pdProduct.id : null;
      }
    }
  }

  const ledgerEntry: FoundationLedgerEntry = {
    entry_type: "accrual",
    amount_cents: invoice.amount_paid,
    source: "stripe:invoice.payment_succeeded",
    stripe_event_id: stripeEventId,
    country_code: location.countryCode,
    region_code: location.regionCode,
    city: location.city,
    user_id: userId,
    meta: {
      stripe_event_id: stripeEventId,
      invoice_id: invoice.id,
      customer_id: customerId,
      subscription_id: subscriptionId,
      price_id: priceId,
      product_id: productId,
      amount_total: invoice.total,
      amount_paid: invoice.amount_paid,
      currency: invoice.currency,
      created: invoice.created,
      user_id_if_mapped: userId,
      billing_reason: (invoice as any).billing_reason ?? null,
    },
  };

  console.log("[Webhook] Recording foundation ledger entry:", JSON.stringify(ledgerEntry, null, 2));

  const { error } = await supabase.from("foundation_ledger").insert(ledgerEntry);

  if (error) {
    // Idempotency: unique constraint on stripe_event_id
    if (error.code === "23505" && error.message.includes("stripe_event_id")) {
      console.log(`[Webhook] Duplicate event ${stripeEventId} - already processed, skipping`);
      return;
    }

    console.error("[Webhook] Failed to record foundation ledger entry:", error);
    return;
  }

  console.log(`[Webhook] Foundation ledger entry recorded: ${invoice.amount_paid} cents`);
  console.log("[Webhook] ========== INVOICE PROCESSING COMPLETE ==========");
}

/**
 * Extract billing location from invoice/customer
 */
async function extractBillingLocation(
  invoice: Stripe.Invoice
): Promise<{
  countryCode: string | null;
  regionCode: string | null;
  city: string | null;
}> {
  // Invoice-level address first
  const address = invoice.customer_address;

  if (address?.country) {
    const countryCode = address.country; // ISO 3166-1 alpha-2
    const regionCode = address.state ? `${countryCode}-${address.state}` : null;
    const city = address.city || null;

    console.log(`[Webhook] Location from invoice: ${countryCode}, ${regionCode}, ${city}`);
    return { countryCode, regionCode, city };
  }

  // Fallback: customer default address
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

  if (customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);

      if (customer && !customer.deleted && customer.address?.country) {
        const countryCode = customer.address.country;
        const regionCode = customer.address.state ? `${countryCode}-${customer.address.state}` : null;
        const city = customer.address.city || null;

        console.log(`[Webhook] Location from customer: ${countryCode}, ${regionCode}, ${city}`);
        return { countryCode, regionCode, city };
      }
    } catch (err: any) {
      console.error(`[Webhook] Failed to retrieve customer for location: ${err.message}`);
    }
  }

  console.log("[Webhook] No billing location available");
  return { countryCode: null, regionCode: null, city: null };
}