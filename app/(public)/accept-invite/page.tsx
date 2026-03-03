"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * Inner component — uses useSearchParams(), must be inside <Suspense>.
 *
 * Flow:
 *   1. Read token from URL
 *   2. Check if user is authenticated (client-side)
 *   3. If not → redirect to /sign-in?returnTo=/accept-invite?token=...
 *   4. If yes → auto-call POST /api/seats/accept
 *   5. On success → redirect to /sanctuary
 *   6. On error → show message
 */
function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "accepting" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMessage("Invalid invitation link. Please check the link in your email.");
      return;
    }

    const supabase = createBrowserSupabaseClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        // Redirect to sign-in with returnTo so user lands back here after auth
        const returnTo = encodeURIComponent(`/accept-invite?token=${token}`);
        router.replace(`/sign-in?returnTo=${returnTo}`);
        return;
      }

      // User is authenticated — accept the invite
      setStatus("accepting");
      fetch("/api/seats/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
        .then(async (res) => {
          if (res.ok) {
            setStatus("success");
            setTimeout(() => router.replace("/sanctuary"), 1500);
          } else {
            const data = await res.json();
            setStatus("error");
            setErrorMessage(data.message || "Unable to accept invitation.");
          }
        })
        .catch(() => {
          setStatus("error");
          setErrorMessage("Something went wrong. Please try again.");
        });
    });
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4">
        {status === "loading" && (
          <p className="text-muted-foreground">Checking your invitation…</p>
        )}

        {status === "accepting" && (
          <p className="text-muted-foreground">Accepting your invitation…</p>
        )}

        {status === "success" && (
          <>
            <h1 className="text-2xl font-semibold">You&apos;re in!</h1>
            <p className="text-muted-foreground">
              Your invitation has been accepted. Redirecting to your Sanctuary…
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <h1 className="text-2xl font-semibold">Invitation issue</h1>
            <p className="text-muted-foreground">{errorMessage}</p>
            <Button variant="outline" onClick={() => router.push("/")}>
              Go home
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6">
          <p className="text-muted-foreground">Loading…</p>
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  );
}
