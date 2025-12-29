import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/client";

/**
 * GET /api/stripe/session-info
 *
 * Retrieves basic info from a Stripe checkout session.
 * Used to prefill email on /welcome after returning from Stripe Pricing Table.
 *
 * Query params:
 * - session_id: Stripe checkout session ID (must start with cs_)
 *
 * Returns:
 * - email: Customer email from checkout
 * - session_status: complete | open | expired
 * - mode: subscription | payment
 */
export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);

  try {
    const sessionId = req.nextUrl.searchParams.get("session_id");

    // Validate session_id is present and has correct format
    if (!sessionId) {
      console.log(`[SessionInfo:${requestId}] Missing session_id`);
      return NextResponse.json(
        { error: "session_id is required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!sessionId.startsWith("cs_")) {
      console.log(`[SessionInfo:${requestId}] Invalid session_id format: ${sessionId.slice(0, 10)}...`);
      return NextResponse.json(
        { error: "Invalid session_id format" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    console.log(`[SessionInfo:${requestId}] Retrieving session: ${sessionId.slice(0, 20)}...`);

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Extract email (customer_details.email takes priority)
    const email = session.customer_details?.email || session.customer_email || null;

    if (!email) {
      console.log(`[SessionInfo:${requestId}] No email found on session`);
      return NextResponse.json(
        { error: "No email on session" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    console.log(`[SessionInfo:${requestId}] Found email, status: ${session.status}, mode: ${session.mode}`);

    return NextResponse.json(
      {
        email,
        session_status: session.status,
        mode: session.mode,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    console.error(`[SessionInfo:${requestId}] Error:`, error.message);

    // Handle Stripe-specific errors
    if (error.type === "StripeInvalidRequestError") {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { error: "Failed to retrieve session info" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
