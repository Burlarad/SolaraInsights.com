import { redirect } from "next/navigation";
import { NavBar } from "@/components/layout/NavBar";
import { Footer } from "@/components/layout/Footer";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Profile } from "@/types";

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

  // Check if user has paid access (membership_plan + subscription_status)
  const isPaid =
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
  const isReady = typedProfile.is_onboarded === true;

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
      <NavBar />
      <main className="pt-20 min-h-screen">
        {children}
      </main>
      <Footer />
    </>
  );
}
