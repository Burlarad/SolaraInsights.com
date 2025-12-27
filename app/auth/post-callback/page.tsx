"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toSafeInternalPath } from "@/lib/validation/internalUrl";
import {
  getOauthAttempts,
  incrementOauthAttempts,
} from "@/lib/auth/oauthSession";

/**
 * Check if a provider is already connected for Social Insights.
 * Returns true if connected, false otherwise.
 */
async function checkProviderConnected(provider: string): Promise<boolean> {
  try {
    const response = await fetch("/api/social/status");
    if (!response.ok) {
      console.warn("[PostCallback] Failed to fetch social status");
      return false;
    }
    const data = await response.json();
    const connection = data.connections?.find(
      (c: { provider: string; status: string }) => c.provider === provider
    );
    return connection?.status === "connected";
  } catch (err) {
    console.error("[PostCallback] Error checking provider status:", err);
    return false;
  }
}

/**
 * Post-OAuth callback page
 *
 * This client component handles the final redirect after OAuth authentication.
 * It reads the intended destination from sessionStorage (set before OAuth started)
 * and optionally triggers a Social Insights connect flow.
 *
 * Flow:
 * 1. Read oauth_next (destination) and oauth_post_action (auto-connect) from sessionStorage
 * 2. Clear both immediately to prevent loops
 * 3. If oauth_post_action is "auto_connect:{provider}":
 *    a. Check if provider is already connected
 *    b. If not connected and attempts < max, redirect to connect endpoint
 *    c. If connected or max attempts reached, continue to destination
 * 4. Navigate to destination
 */
export default function PostCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState("Completing sign in...");

  useEffect(() => {
    async function handlePostCallback() {
      // Read from sessionStorage
      const storedNext = sessionStorage.getItem("oauth_next");
      const postAction = sessionStorage.getItem("oauth_post_action");
      const attemptCount = getOauthAttempts();

      console.log(`[PostCallback] oauth_next: ${storedNext || "(not set)"}`);
      console.log(`[PostCallback] oauth_post_action: ${postAction || "(not set)"}`);
      console.log(`[PostCallback] oauth_connect_attempts: ${attemptCount}`);

      // Clear immediately to prevent loops
      sessionStorage.removeItem("oauth_next");
      sessionStorage.removeItem("oauth_post_action");

      // Validate destination using shared helper
      const destination = toSafeInternalPath(storedNext);
      console.log(`[PostCallback] Validated destination: ${destination}`);

      // Check for auto-connect action
      if (postAction && postAction.startsWith("auto_connect:")) {
        const provider = postAction.replace("auto_connect:", "");
        console.log(`[PostCallback] Auto-connect requested for provider: ${provider}`);

        // Guard against infinite loops - max 1 attempt
        if (attemptCount >= 1) {
          console.warn(`[PostCallback] Max connect attempts reached (${attemptCount}), skipping auto-connect`);
          router.replace(destination);
          return;
        }

        // Check if already connected
        setStatus("Checking Social Insights...");
        const alreadyConnected = await checkProviderConnected(provider);

        if (alreadyConnected) {
          console.log(`[PostCallback] Provider ${provider} already connected, skipping auto-connect`);
          router.replace(destination);
          return;
        }

        // Not connected - trigger connect flow
        console.log(`[PostCallback] Provider ${provider} not connected, redirecting to connect flow`);
        setStatus("Connecting Social Insights...");

        // Increment attempt counter before redirecting
        incrementOauthAttempts();

        // Build connect URL with return_to pointing to final destination
        const connectUrl = `/api/social/oauth/${provider}/connect?return_to=${encodeURIComponent(destination)}`;
        console.log(`[PostCallback] Redirecting to: ${connectUrl}`);

        // Use window.location for full navigation (not router.push)
        // This ensures cookies are properly set by the connect endpoint
        window.location.href = connectUrl;
        return;
      }

      // No auto-connect action, proceed to destination
      router.replace(destination);
    }

    handlePostCallback();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-accent-gold-light to-accent-gold mb-4 animate-pulse">
          <span className="text-xl">&#9788;</span>
        </div>
        <p className="text-accent-ink/60">{status}</p>
      </div>
    </div>
  );
}
