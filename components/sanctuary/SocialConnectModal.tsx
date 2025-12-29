"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Check, ExternalLink } from "lucide-react";
import { SocialProvider } from "@/types";
import { cn } from "@/lib/utils";

// Provider configuration (only connectable ones)
// Note: X OAuth disabled - requires X Basic tier ($100/mo) for /users/me endpoint
// The API filters by isConfigured, so X won't show when X_OAUTH_ENABLED=false
const PROVIDERS: {
  id: SocialProvider;
  name: string;
  color: string;
  letter: string;
}[] = [
  { id: "facebook", name: "Facebook", color: "#1877F2", letter: "F" },
  { id: "tiktok", name: "TikTok", color: "#000000", letter: "T" },
  { id: "x", name: "X (Twitter)", color: "#000000", letter: "X" },
  { id: "reddit", name: "Reddit", color: "#FF4500", letter: "R" },
  { id: "instagram", name: "Instagram", color: "#E4405F", letter: "I" },
];

interface ProviderStatus {
  provider: SocialProvider;
  status: "connected" | "disconnected" | "needs_reauth";
  isConfigured: boolean;
  hasSummary: boolean;
}

interface SocialConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  justConnectedProvider?: SocialProvider | null;
}

export function SocialConnectModal({
  open,
  onOpenChange,
  onDone,
  justConnectedProvider,
}: SocialConnectModalProps) {
  const [statuses, setStatuses] = useState<ProviderStatus[]>([]);
  const [loading, setLoading] = useState(true);

  // Load status when modal opens
  useEffect(() => {
    if (open) {
      loadStatus();
    }
  }, [open]);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/social/status");
      if (response.ok) {
        const data = await response.json();
        setStatuses(data.connections);
      }
    } catch (err) {
      console.error("Failed to load social status:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = (provider: SocialProvider) => {
    // Redirect to OAuth with return_to=/sanctuary so modal reopens
    window.location.href = `/api/social/oauth/${provider}/connect?return_to=/sanctuary`;
  };

  const handleDone = () => {
    // Deferred persistence model: just close the modal
    // If user connected anything, social_insights was activated by the OAuth callback
    // If user didn't connect, nothing was persisted and feature stays off
    onDone();
  };

  // Filter to only show connectable providers (configured + enabled)
  const connectableProviders = PROVIDERS.filter((p) => {
    const status = statuses.find((s) => s.provider === p.id);
    return status?.isConfigured;
  });

  // Check if all connectable providers are connected
  const allConnected = connectableProviders.every((p) => {
    const status = statuses.find((s) => s.provider === p.id);
    return status?.status === "connected";
  });

  // Count connected providers
  const connectedCount = statuses.filter(
    (s) => s.isConfigured && s.status === "connected"
  ).length;

  // Determine modal copy based on context
  const isReturningFromConnect = !!justConnectedProvider;
  const isFirstTimeActivation = connectedCount === 0 && !isReturningFromConnect;

  const title = isReturningFromConnect
    ? "Want to connect another?"
    : isFirstTimeActivation
      ? "Enhance Your Insights"
      : "Connect Your Accounts";

  const description = isReturningFromConnect
    ? "You can connect more accounts for richer, more personalized guidance."
    : isFirstTimeActivation
      ? "Connect your social accounts for personalized insights based on your communication style."
      : "Connect additional accounts for even richer insights.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-accent-gold" />
          </div>
        ) : (
          <div className="space-y-3 py-4">
            {connectableProviders.map((provider) => {
              const status = statuses.find((s) => s.provider === provider.id);
              const isConnected = status?.status === "connected";
              const justConnected = justConnectedProvider === provider.id;

              return (
                <div
                  key={provider.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-colors",
                    isConnected
                      ? "border-green-200 bg-green-50/50"
                      : "border-border-subtle hover:border-accent-gold/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                      style={{ backgroundColor: provider.color }}
                    >
                      {provider.letter}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{provider.name}</p>
                      {isConnected && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          {justConnected ? "Just connected!" : "Connected"}
                        </p>
                      )}
                    </div>
                  </div>

                  {!isConnected && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConnect(provider.id)}
                      className="gap-1 text-xs"
                    >
                      Connect
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              );
            })}

            {connectableProviders.length === 0 && (
              <p className="text-center text-sm text-accent-ink/60 py-4">
                No social providers are currently available.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            variant="gold"
            onClick={handleDone}
            className="w-full"
          >
            {connectedCount > 0 || allConnected
              ? "Continue to Sanctuary"
              : isFirstTimeActivation
                ? "Maybe Later"
                : "Done"}
          </Button>
          <p className="text-xs text-center text-accent-ink/50">
            {connectedCount > 0
              ? "You can connect more anytime in Settings."
              : "You can activate Social Insights anytime in Settings."}
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
