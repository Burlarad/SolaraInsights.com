"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Script from "next/script";
import { Card, CardContent } from "@/components/ui/card";
import { useSettings } from "@/providers/SettingsProvider";
import { hasActiveMembership } from "@/lib/membership/status";

// Stripe Pricing Table configuration from environment
const STRIPE_PRICING_TABLE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID;
const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

export default function JoinPage() {
  const router = useRouter();
  const { profile, loading: profileLoading } = useSettings();

  // Check if user already has active membership
  useEffect(() => {
    if (!profileLoading && hasActiveMembership(profile)) {
      // Already has membership - redirect
      router.push("/sanctuary");
    }
  }, [profile, profileLoading, router]);

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-accent-ink/60">Loading...</p>
      </div>
    );
  }

  // Check if Stripe env vars are configured
  const isStripeConfigured = STRIPE_PRICING_TABLE_ID && STRIPE_PUBLISHABLE_KEY;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-serif text-accent-ink">Choose your plan</h1>
        <p className="text-accent-ink/70">
          All plans include a 7-day free trial. Cancel anytime.
        </p>
      </div>

      {/* Stripe Pricing Table */}
      {isStripeConfigured ? (
        <>
          {/* Load Stripe Pricing Table script */}
          <Script
            src="https://js.stripe.com/v3/pricing-table.js"
            strategy="afterInteractive"
          />

          {/* Stripe Pricing Table web component */}
          <div className="w-full max-w-4xl mx-auto">
            <stripe-pricing-table
              pricing-table-id={STRIPE_PRICING_TABLE_ID}
              publishable-key={STRIPE_PUBLISHABLE_KEY}
            />
          </div>
        </>
      ) : (
        /* Fallback when Stripe is not configured */
        <Card className="border-border-subtle">
          <CardContent className="py-12 text-center">
            <p className="text-accent-ink/70">
              Pricing is temporarily unavailable. Please try again later.
            </p>
            <p className="text-sm text-accent-ink/50 mt-2">
              If you&apos;re the site administrator, check that NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID
              and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY are configured.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Foundation message */}
      <div className="text-center text-xs text-accent-ink/60">
        <p>
          A portion of your subscription supports families through the Solara Foundation
        </p>
      </div>

      {/* Sign in link */}
      <div className="text-center text-sm">
        <span className="text-accent-ink/60">Already have an account? </span>
        <Link href="/sign-in" className="text-accent-gold hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
