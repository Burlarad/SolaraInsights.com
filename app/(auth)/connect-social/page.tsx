"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, X, Check, AlertCircle } from "lucide-react";
import { SocialProvider, SocialConnectionStatus } from "@/types";
import { cn } from "@/lib/utils";

// Provider configuration
const PROVIDERS: {
  id: SocialProvider;
  name: string;
  color: string;
  letter: string;
  hint: string;
}[] = [
  {
    id: "facebook",
    name: "Facebook",
    color: "#1877F2",
    letter: "F",
    hint: "Copy some of your recent posts or status updates",
  },
  {
    id: "instagram",
    name: "Instagram",
    color: "#E4405F",
    letter: "I",
    hint: "Copy your recent captions and comments",
  },
  {
    id: "tiktok",
    name: "TikTok",
    color: "#000000",
    letter: "T",
    hint: "Copy your video descriptions and comments",
  },
  {
    id: "x",
    name: "X (Twitter)",
    color: "#000000",
    letter: "X",
    hint: "Copy some of your recent tweets",
  },
  {
    id: "reddit",
    name: "Reddit",
    color: "#FF4500",
    letter: "R",
    hint: "Copy some of your recent comments or posts",
  },
];

interface ProviderStatus {
  provider: SocialProvider;
  status: SocialConnectionStatus;
  handle: string | null;
  lastIngestedAt: string | null;
  lastError: string | null;
  hasSummary: boolean;
}

export default function ConnectSocialPage() {
  const router = useRouter();

  // Status state
  const [statuses, setStatuses] = useState<ProviderStatus[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<SocialProvider | null>(null);
  const [pasteContent, setPasteContent] = useState("");
  const [handle, setHandle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

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

  const openModal = (provider: SocialProvider) => {
    setSelectedProvider(provider);
    setPasteContent("");
    setHandle("");
    setSubmitError(null);
    setSubmitSuccess(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedProvider(null);
    setPasteContent("");
    setHandle("");
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  const handleSubmit = async () => {
    if (!selectedProvider || !pasteContent.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/social/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          handle: handle.trim() || undefined,
          payload: pasteContent.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSubmitError(data.message || "Failed to process content");
        return;
      }

      setSubmitSuccess(true);
      await loadStatus(); // Refresh statuses

      // Close modal after a brief delay
      setTimeout(() => {
        closeModal();
      }, 1500);
    } catch (err: any) {
      setSubmitError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
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
      return null;
    }

    const styles: Record<SocialConnectionStatus, string> = {
      disconnected: "",
      connected: "bg-blue-100 text-blue-700",
      processing: "bg-yellow-100 text-yellow-700",
      ready: "bg-green-100 text-green-700",
      failed: "bg-red-100 text-red-700",
    };

    const labels: Record<SocialConnectionStatus, string> = {
      disconnected: "",
      connected: "Connected",
      processing: "Processing...",
      ready: "Ready",
      failed: "Failed",
    };

    return (
      <span className={cn("text-xs px-2 py-0.5 rounded-full", styles[status.status])}>
        {labels[status.status]}
      </span>
    );
  };

  const selectedProviderConfig = PROVIDERS.find((p) => p.id === selectedProvider);

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="border-border-subtle">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            Social Insights (optional)
          </CardTitle>
          <p className="text-center text-sm text-accent-ink/60 mt-2">
            Share some of your social posts to personalize your Solara experience.
            We analyze your communication style—never your identity.
          </p>
        </CardHeader>
        <CardContent>
          {loadingStatus ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-accent-gold" />
            </div>
          ) : (
            <div className="space-y-4">
              {PROVIDERS.map((provider) => {
                const status = getStatusForProvider(provider.id);
                const isReady = status?.status === "ready";
                const isProcessing = status?.status === "processing";

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
                            {isReady
                              ? "Social insights ready"
                              : isProcessing
                              ? "Analyzing your content..."
                              : "Paste your content to analyze"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isReady && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openModal(provider.id)}
                          >
                            Refresh
                          </Button>
                        )}
                        {!isReady && !isProcessing && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openModal(provider.id)}
                          >
                            Add Data
                          </Button>
                        )}
                        {isProcessing && (
                          <Loader2 className="h-4 w-4 animate-spin text-accent-gold" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Skip button */}
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
                <p>You can add or update social data anytime in Settings</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paste Modal */}
      {modalOpen && selectedProviderConfig && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold"
                  style={{ backgroundColor: selectedProviderConfig.color }}
                >
                  {selectedProviderConfig.letter}
                </div>
                <div>
                  <CardTitle className="text-lg">
                    Add {selectedProviderConfig.name} Data
                  </CardTitle>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={closeModal}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {submitSuccess ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <Check className="h-6 w-6 text-green-600" />
                  </div>
                  <p className="font-medium text-green-700">Social insights generated!</p>
                  <p className="text-sm text-accent-ink/60 mt-1">
                    Your personalization data is ready
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-accent-ink/70 mb-4">
                      {selectedProviderConfig.hint}. We&apos;ll analyze your communication style
                      to personalize your Solara experience.
                    </p>
                  </div>

                  {submitError && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                      <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-red-700">{submitError}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Handle (optional)
                    </label>
                    <input
                      type="text"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      placeholder="@yourhandle"
                      className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-gold/50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Paste your content
                    </label>
                    <textarea
                      value={pasteContent}
                      onChange={(e) => setPasteContent(e.target.value)}
                      placeholder="Paste your posts, captions, comments, or any content that shows how you communicate..."
                      rows={8}
                      className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent-gold/50"
                    />
                    <p className="text-xs text-accent-ink/50 mt-1">
                      {pasteContent.length.toLocaleString()} / 50,000 characters
                    </p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      onClick={closeModal}
                      className="flex-1"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="gold"
                      onClick={handleSubmit}
                      className="flex-1"
                      disabled={isSubmitting || pasteContent.trim().length < 100}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Analyzing...
                        </>
                      ) : (
                        "Generate Insights"
                      )}
                    </Button>
                  </div>

                  <p className="text-xs text-accent-ink/50 text-center">
                    Your content is processed securely and never stored raw.
                    Only the AI-generated summary is saved.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
