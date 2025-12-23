import { redirect } from "next/navigation";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Profile } from "@/types";

/**
 * Check if dev paywall bypass is enabled.
 * HARD SAFETY: Only works in development, never in production.
 */
function isDevPaywallBypassed(): boolean {
  const bypass = process.env.DEV_PAYWALL_BYPASS === "true";

  if (!bypass) return false;

  // HARD SAFETY 1: Never in production NODE_ENV
  if (process.env.NODE_ENV === "production") {
    console.warn("[PAYWALL] DEV_PAYWALL_BYPASS ignored - NODE_ENV is production");
    return false;
  }

  // HARD SAFETY 2: Never on production domain
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  if (siteUrl === "https://solarainsights.com") {
    console.warn("[PAYWALL] DEV_PAYWALL_BYPASS ignored - production domain");
    return false;
  }

  return true;
}

// Log on module load if bypass is active
if (isDevPaywallBypassed()) {
  console.warn("⚠️  [PAYWALL] DEV_PAYWALL_BYPASS=true - Payment gates BYPASSED for dev");
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

  // Check if dev bypass is active
  const devBypass = isDevPaywallBypassed();

  // Check if user has paid access (membership_plan + subscription_status)
  const isPaid =
    devBypass || // DEV BYPASS
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
  // DEV BYPASS: Skip onboarding check too
  const isReady = devBypass || typedProfile.is_onboarded === true;

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
      {devBypass && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-orange-500 text-white text-center py-1 text-sm font-semibold">
          DEV MODE: Payment + Onboarding gates BYPASSED (DEV_PAYWALL_BYPASS=true)
        </div>
      )}
      <NavBar />
      <main className={`${devBypass ? "pt-28" : "pt-20"} min-h-screen`}>
        {children}
      </main>
      <Footer />
    </>
  );
}
