import { NextRequest, NextResponse } from "next/server";
import { stripe, STRIPE_CONFIG } from "@/lib/stripe/client";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { plan, email: providedEmail } = body;

    // Validate plan
    if (!plan || (plan !== "individual" && plan !== "family")) {
      return NextResponse.json(
        { error: "Invalid plan", message: "Plan must be 'individual' or 'family'" },
        { status: 400 }
      );
    }

    // Determine email: prefer providedEmail, fallback to authenticated user
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    const email = providedEmail || user?.email;

    if (!email) {
      return NextResponse.json(
        { error: "Email required", message: "Email address is required for checkout" },
        { status: 400 }
      );
    }

    // Choose price ID based on plan
    const priceId = plan === "individual"
      ? STRIPE_CONFIG.priceIds.sanctuary
      : STRIPE_CONFIG.priceIds.family;

    if (!priceId) {
      return NextResponse.json(
        { error: "Configuration error", message: `Price ID not configured for ${plan} plan` },
        { status: 500 }
      );
    }

    // Build success and cancel URLs
    const appUrl =
      process.env.APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      customer_email: email,
      metadata: {
        plan,
        userId: user?.id || "",
      },
      subscription_data: {
        // 7-day trial is configured on the Stripe Price, but we can also set it here
        trial_period_days: 7,
      },
      success_url: `${appUrl}/welcome?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("[Stripe Checkout] Error:", error);
    return NextResponse.json(
      { error: "Checkout failed", message: error.message || "Unable to create checkout session" },
      { status: 500 }
    );
  }
}
