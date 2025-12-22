"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Check, AlertCircle, ExternalLink } from "lucide-react";
import { SocialProvider, SocialConnectionStatus } from "@/types";
import { cn } from "@/lib/utils";

// Provider configuration
const PROVIDERS: {
  id: SocialProvider;
  name: string;
  color: string;
  letter: string;
}[] = [
  {
    id: "facebook",
    name: "Facebook",
    color: "#1877F2",
    letter: "F",
  },
  {
    id: "instagram",
    name: "Instagram",
    color: "#E4405F",
    letter: "I",
  },
  {
    id: "tiktok",
    name: "TikTok",
    color: "#000000",
    letter: "T",
  },
  {
    id: "x",
    name: "X (Twitter)",
    color: "#000000",
    letter: "X",
  },
  {
    id: "reddit",
    name: "Reddit",
    color: "#FF4500",
    letter: "R",
  },
];

interface ProviderStatus {
  provider: SocialProvider;
  status: SocialConnectionStatus;
  handle: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  hasSummary: boolean;
}

function ConnectSocialContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Status state
  const [statuses, setStatuses] = useState<ProviderStatus[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [disconnecting, setDisconnecting] = useState<SocialProvider | null>(null);

  // Check for success/error from OAuth callback
  const success = searchParams.get("success");
  const error = searchParams.get("error");
  const callbackProvider = searchParams.get("provider");

  // Load status on mount
  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const response = await fetch("/api/social/status");
      if (response.ok) {
        const data = await response.json();
        setStatuses(data.connections);
      }
    } catch (err) {
      console.error("Failed to load social status:", err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleConnect = (provider: SocialProvider) => {
    // Redirect to OAuth connect endpoint with return_to for post-OAuth redirect
    window.location.href = `/api/social/oauth/${provider}/connect?return_to=/connect-social`;
  };

  const handleDisconnect = async (provider: SocialProvider) => {
    setDisconnecting(provider);
    try {
      const response = await fetch("/api/social/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      if (response.ok) {
        await loadStatus();
      }
    } catch (err) {
      console.error("Failed to disconnect:", err);
    } finally {
      setDisconnecting(null);
    }
  };

  const handleSkip = () => {
    router.push("/sanctuary");
  };

  const getStatusForProvider = (providerId: SocialProvider) => {
    return statuses.find((s) => s.provider === providerId);
  };

  const getStatusPill = (status: ProviderStatus | undefined) => {
    if (!status || status.status === "disconnected") {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
          Not connected
        </span>
      );
    }

    const styles: Record<SocialConnectionStatus, string> = {
      disconnected: "bg-gray-100 text-gray-600",
      connected: "bg-blue-100 text-blue-700",
      syncing: "bg-yellow-100 text-yellow-700",
      ready: "bg-green-100 text-green-700",
      needs_reauth: "bg-red-100 text-red-700",
    };

    const labels: Record<SocialConnectionStatus, string> = {
      disconnected: "Not connected",
      connected: "Connected",
      syncing: "Syncing...",
      ready: "Ready",
      needs_reauth: "Needs sign-in",
    };

    return (
      <span className={cn("text-xs px-2 py-0.5 rounded-full", styles[status.status])}>
        {labels[status.status]}
      </span>
    );
  };

  const getStatusDescription = (status: ProviderStatus | undefined) => {
    if (!status || status.status === "disconnected") {
      return "Connect to personalize your experience";
    }

    switch (status.status) {
      case "connected":
        return "Waiting to sync...";
      case "syncing":
        return "Analyzing your content...";
      case "ready":
        return status.handle ? `Connected as ${status.handle}` : "Social insights ready";
      case "needs_reauth":
        return "Please reconnect to continue";
      default:
        return "";
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="border-border-subtle">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            Social Insights (optional)
          </CardTitle>
          <p className="text-center text-sm text-accent-ink/60 mt-2">
            Connect your social accounts to personalize your Solara experience.
            We analyze your communication style—never your identity.
          </p>
        </CardHeader>
        <CardContent>
          {/* Success/Error messages from OAuth callback */}
          {success && callbackProvider && (
            <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
              <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-green-700">
                Successfully connected {PROVIDERS.find(p => p.id === callbackProvider)?.name || callbackProvider}!
                Your content is being analyzed.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">
                {error === "state_expired" && "Connection timed out. Please try again."}
                {error === "state_mismatch" && "Security check failed. Please try again."}
                {error === "access_denied" && "You denied access. Try again when ready."}
                {error === "server_error" && "Something went wrong. Please try again."}
                {!["state_expired", "state_mismatch", "access_denied", "server_error"].includes(error) &&
                  `Connection failed: ${error}`}
              </p>
            </div>
          )}

          {loadingStatus ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-accent-gold" />
            </div>
          ) : (
            <div className="space-y-4">
              {PROVIDERS.map((provider) => {
                const status = getStatusForProvider(provider.id);
                const isConnected = status?.status && status.status !== "disconnected";
                const isSyncing = status?.status === "syncing";
                const needsReauth = status?.status === "needs_reauth";
                const isDisconnecting = disconnecting === provider.id;

                return (
                  <div
                    key={provider.id}
                    className="border border-border-subtle rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
                          style={{ backgroundColor: provider.color }}
                        >
                          {provider.letter}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{provider.name}</p>
                            {getStatusPill(status)}
                          </div>
                          <p className="text-xs text-accent-ink/60">
                            {getStatusDescription(status)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSyncing && (
                          <Loader2 className="h-4 w-4 animate-spin text-accent-gold" />
                        )}

                        {!isConnected && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleConnect(provider.id)}
                            className="gap-1"
                          >
                            Connect
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}

                        {needsReauth && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleConnect(provider.id)}
                            className="gap-1"
                          >
                            Reconnect
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}

                        {isConnected && !needsReauth && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDisconnect(provider.id)}
                            disabled={isDisconnecting || isSyncing}
                            className="text-accent-ink/60 hover:text-red-600"
                          >
                            {isDisconnecting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              "Disconnect"
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Continue button */}
              <div className="pt-4">
                <Button
                  variant="outline"
                  onClick={handleSkip}
                  className="w-full"
                >
                  {statuses.some((s) => s.status === "ready")
                    ? "Continue to Sanctuary"
                    : "Skip for now"}
                </Button>
              </div>

              <div className="text-center text-xs text-accent-ink/60">
                <p>You can manage your connections anytime in Settings</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ConnectSocialPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto">
          <Card className="border-border-subtle">
            <CardContent className="py-8">
              <div className="flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-accent-gold" />
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <ConnectSocialContent />
    </Suspense>
  );
}
