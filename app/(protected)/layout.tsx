import { redirect } from "next/navigation";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Profile } from "@/types";

/**
 * Check if paywall bypass is enabled for development/testing.
 * SAFETY: Only works in dev environments, never in production.
 */
function isPaywallDisabled(): boolean {
  const paywallDisabled = process.env.PAYWALL_DISABLED === "true";

  if (!paywallDisabled) return false;

  // SAFETY CHECK 1: Never bypass in production NODE_ENV
  if (process.env.NODE_ENV === "production") {
    console.warn("[PAYWALL] PAYWALL_DISABLED ignored - NODE_ENV is production");
    return false;
  }

  // SAFETY CHECK 2: Never bypass if pointing to production URL
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  if (siteUrl.includes("solarainsights.com")) {
    console.warn("[PAYWALL] PAYWALL_DISABLED ignored - NEXT_PUBLIC_SITE_URL is production");
    return false;
  }

  return true;
}

// Log warning on module load if paywall is disabled
if (isPaywallDisabled()) {
  console.warn("⚠️  [PAYWALL] PAYWALL_DISABLED=true - Payment and onboarding gates BYPASSED for dev/testing");
}

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth guard: Check if user is authenticated
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If no user, redirect to sign-in
  if (!user) {
    redirect("/sign-in");
  }

  // Fetch user profile to check membership and onboarding status
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // Profile should exist (created by SettingsProvider), but if not, redirect to join
    redirect("/join");
  }

  const typedProfile = profile as Profile;

  // Check if paywall bypass is active (dev/testing only)
  const bypassPaywall = isPaywallDisabled();

  // Check if user has paid access (membership_plan + subscription_status)
  const isPaid =
    bypassPaywall || // DEV BYPASS
    typedProfile.role === "admin" ||
    typedProfile.is_comped === true ||
    (typedProfile.membership_plan !== "none" &&
      (typedProfile.subscription_status === "trialing" ||
       typedProfile.subscription_status === "active"));

  // If not paid, redirect to join
  if (!isPaid) {
    redirect("/join");
  }

  // If paid but not onboarded, redirect to welcome or onboarding
  // BYPASS: Skip onboarding check if paywall is disabled
  const isReady = bypassPaywall || typedProfile.is_onboarded === true;

  if (!isReady) {
    // If they have started onboarding, go to onboarding
    // Otherwise, go to welcome to set up identity
    if (typedProfile.onboarding_started_at) {
      redirect("/onboarding");
    } else {
      redirect("/welcome");
    }
  }

  // User is authenticated, paid, and onboarded - allow access
  return (
    <>
      {bypassPaywall && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-orange-500 text-white text-center py-1 text-sm font-semibold">
          DEV MODE: Paywall + Onboarding gates DISABLED (PAYWALL_DISABLED=true)
        </div>
      )}
      <NavBar />
      <main className={`${bypassPaywall ? "pt-28" : "pt-20"} min-h-screen`}>
        {children}
      </main>
      <Footer />
    </>
  );
}
