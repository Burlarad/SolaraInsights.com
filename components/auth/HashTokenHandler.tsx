"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

/**
 * HashTokenHandler - Handles Supabase implicit flow tokens in URL hash
 *
 * When Supabase uses implicit flow (instead of PKCE), tokens are returned
 * in the URL hash fragment: example.com/#access_token=...
 *
 * This component runs on ALL pages and:
 * 1. Detects access_token in URL hash
 * 2. Lets Supabase client process the tokens
 * 3. Redirects user to appropriate page based on onboarding status
 *
 * This is a defensive fallback for when redirect_to URLs aren't in Supabase's
 * allowlist, causing implicit flow instead of PKCE.
 */

// Pages where we should NOT process hash tokens (to prevent infinite loops)
const SKIP_PATHS = new Set([
  "/sanctuary",
  "/set-password",
  "/onboarding",
  "/auth/callback",
  "/auth/post-callback",
]);

export function HashTokenHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // Skip on destination pages to prevent infinite loops
    if (SKIP_PATHS.has(pathname)) {
      return;
    }

    // Check if there's an access_token in the hash
    const hash = window.location.hash;
    if (!hash || !hash.includes("access_token=")) {
      return;
    }

    console.log("[HashTokenHandler] Detected access_token in URL hash on:", pathname);
    setProcessing(true);

    // Parse the hash fragment
    const hashParams = new URLSearchParams(hash.substring(1));
    const accessToken = hashParams.get("access_token");

    if (!accessToken) {
      console.error("[HashTokenHandler] No access_token found in hash");
      setProcessing(false);
      return;
    }

    // Let Supabase handle the session from the hash
    const handleHashTokens = async () => {
      try {
        // Wait a moment for Supabase to process the hash tokens
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Check if we now have a session
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
          console.error("[HashTokenHandler] Failed to get user after hash processing:", error?.message);
          // Clear the hash and redirect to sign-in
          window.history.replaceState(null, "", pathname);
          router.push("/sign-in?error=auth_failed");
          return;
        }

        console.log("[HashTokenHandler] Session established for user:", user.id);

        // Clear the hash from the URL (keep current pathname clean)
        window.history.replaceState(null, "", pathname);

        // Check user's onboarding status to determine redirect
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_onboarded")
          .eq("id", user.id)
          .single();

        if (profile?.is_onboarded) {
          console.log("[HashTokenHandler] User onboarded, redirecting to /sanctuary");
          router.replace("/sanctuary");
        } else {
          // User needs to complete setup
          console.log("[HashTokenHandler] User not onboarded, redirecting to /set-password");
          router.replace("/set-password");
        }
      } catch (err) {
        console.error("[HashTokenHandler] Error processing hash tokens:", err);
        window.history.replaceState(null, "", pathname);
        router.push("/sign-in?error=auth_failed");
      } finally {
        setProcessing(false);
      }
    };

    handleHashTokens();
  }, [pathname, router]);

  // Show loading state while processing tokens
  if (processing) {
    return (
      <div className="fixed inset-0 bg-background-cream flex items-center justify-center z-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-accent-gold/20 flex items-center justify-center mb-4 animate-pulse">
            <span className="text-3xl">✨</span>
          </div>
          <p className="text-accent-ink/70">Signing you in...</p>
        </div>
      </div>
    );
  }

  return null;
}
