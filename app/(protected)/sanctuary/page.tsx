"use client";

import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SanctuaryTabs } from "@/components/sanctuary/SanctuaryTabs";
import { TimeframeToggle } from "@/components/sanctuary/TimeframeToggle";
import { SolaraLogo } from "@/components/layout/SolaraLogo";
import { EmotionalCadenceTimeline } from "@/components/sanctuary/EmotionalCadenceTimeline";
import { SocialConnectModal } from "@/components/sanctuary/SocialConnectModal";
import { useSettings } from "@/providers/SettingsProvider";
import { useGeolocation } from "@/hooks/useGeolocation";
import { SanctuaryInsight, Timeframe, SocialProvider } from "@/types";
import { findTarotCard } from "@/lib/tarot";
// FEATURE DISABLED: Rune Whisper / Daily Sigil
// import { findRune } from "@/lib/runes";
import { pickRotatingMessage, getErrorCategory, type ApiErrorResponse } from "@/lib/ui/pickRotatingMessage";
import { useTranslations, useLocale } from "next-intl";

interface ErrorInfo {
  message: string;
  errorCode?: string;
  requestId?: string;
  retryAfterSeconds?: number;
  status: number;
}

function SanctuaryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, loading: profileLoading, error: profileError, refreshProfile } = useSettings();
  const { coords } = useGeolocation();
  const locale = useLocale();
  const t = useTranslations("sanctuary");
  const tCommon = useTranslations("common");

  // Ref for AbortController to prevent stampede on rapid changes
  const abortControllerRef = useRef<AbortController | null>(null);
  // Ref for attempt count (doesn't trigger re-renders, prevents infinite loop)
  const attemptCountRef = useRef(0);
  // Ref for deduplication - tracks the last requested key to avoid duplicate fetches
  const lastRequestKeyRef = useRef<string | null>(null);
  // Ref for 429 backoff - stores the timestamp when we're allowed to retry
  const retryAfterRef = useRef<number>(0);
  // Ref to track if a request is currently in flight (avoids stale closure with loading state)
  const isLoadingRef = useRef(false);

  const [timeframe, setTimeframe] = useState<Timeframe>("today");
  const [insight, setInsight] = useState<SanctuaryInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);

  // Social connect modal state
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [justConnectedProvider, setJustConnectedProvider] = useState<SocialProvider | null>(null);
  const [hasCheckedModalConditions, setHasCheckedModalConditions] = useState(false);

  // Reactivation toast state
  const [reactivatedToast, setReactivatedToast] = useState(false);

  // Check for OAuth return params (social=connected&provider=xxx)
  const socialParam = searchParams.get("social");
  const providerParam = searchParams.get("provider") as SocialProvider | null;
  const reactivatedParam = searchParams.get("reactivated");

  // Handle reactivation toast
  useEffect(() => {
    if (reactivatedParam === "true") {
      setReactivatedToast(true);
      // Clean URL without reload
      window.history.replaceState({}, "", "/sanctuary");
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => setReactivatedToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [reactivatedParam]);

  // Handle OAuth return and modal display logic (deferred persistence model)
  useEffect(() => {
    if (profileLoading || hasCheckedModalConditions) return;
    if (!profile) return;

    // If returning from OAuth, show modal with "connect another?" copy
    // The callback route already activated social_insights_enabled
    if (socialParam === "connected" && providerParam) {
      setJustConnectedProvider(providerParam);
      setShowSocialModal(true);
      // Clean URL without reload
      window.history.replaceState({}, "", "/sanctuary");
      // Refresh profile to get the updated enabled state from callback
      refreshProfile();
    }
    // If social insights not yet activated, check if there are connectable providers
    // This is the "activation" flow - modal shows but nothing persists until first connect
    else if (!profile.social_insights_activated_at) {
      checkForConnectableProviders();
    }

    setHasCheckedModalConditions(true);
  }, [profile, profileLoading, socialParam, providerParam, hasCheckedModalConditions, refreshProfile]);

  // Check if there are connectable providers that aren't connected
  const checkForConnectableProviders = async () => {
    try {
      const response = await fetch("/api/social/status");
      if (response.ok) {
        const data = await response.json();
        const hasConnectable = data.connections.some(
          (c: { isConfigured: boolean; status: string }) =>
            c.isConfigured && c.status === "disconnected"
        );
        if (hasConnectable) {
          setShowSocialModal(true);
        }
      }
    } catch (err) {
      console.error("Failed to check social status:", err);
    }
  };

  // Handle modal done - deferred persistence means we just close
  // If user connected at least one provider, social_insights is already enabled by callback
  // If user closed without connecting, nothing was persisted (feature stays off)
  const handleModalDone = async () => {
    setShowSocialModal(false);
    setJustConnectedProvider(null);
    // Refresh profile to ensure we have latest state
    await refreshProfile();
  };

  // Handle social insights toggle
  const handleToggleSocialInsights = async (enabled: boolean) => {
    try {
      if (enabled) {
        // When turning ON, check for connected providers first
        const response = await fetch("/api/social/status");
        if (response.ok) {
          const data = await response.json();
          const connectedCount = data.connections.filter(
            (c: { status: string }) => c.status === "connected"
          ).length;

          if (connectedCount === 0) {
            // No connected providers - just open modal, don't persist yet
            // Persistence will happen via OAuth callback on first connection
            setShowSocialModal(true);
            return;
          }
          // Has connected providers - persist enabled=true immediately
        }
      }

      // Persist the toggle state
      await fetch("/api/user/social-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      // Refresh profile to get updated values
      await refreshProfile();

      // If toggled OFF, close modal immediately
      if (!enabled) {
        setShowSocialModal(false);
      }
    } catch (err) {
      console.error("Failed to toggle social insights:", err);
    }
  };

  const loadInsight = useCallback(async () => {
    // Dedupe: Build request key and check if we're already fetching this exact request
    const requestKey = `${timeframe}:${locale}`;
    if (lastRequestKeyRef.current === requestKey && isLoadingRef.current) {
      console.log("[Sanctuary] Skipping duplicate request:", requestKey);
      return;
    }

    // 429 backoff: Check if we're still in cooldown period
    const now = Date.now();
    if (retryAfterRef.current > now) {
      const waitSeconds = Math.ceil((retryAfterRef.current - now) / 1000);
      console.log(`[Sanctuary] In 429 backoff, wait ${waitSeconds}s`);
      setError(`Please wait ${waitSeconds} seconds before trying again.`);
      setErrorInfo({
        message: `Rate limited. Retry in ${waitSeconds}s.`,
        retryAfterSeconds: waitSeconds,
        status: 429,
      });
      return;
    }

    // Abort any in-flight request to prevent stampede
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    lastRequestKeyRef.current = requestKey;

    isLoadingRef.current = true;
    setLoading(true);
    setError(null);
    setErrorInfo(null);
    attemptCountRef.current += 1;
    const currentAttempt = attemptCountRef.current;

    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeframe, language: locale }),
        signal: abortControllerRef.current.signal,
      });

      if (response.status === 401) {
        router.push("/sign-in");
        return;
      }

      // Check content-type to avoid parsing non-JSON responses
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        // Non-JSON response (HTML error page, etc.)
        const rotatingMessage = pickRotatingMessage({
          category: "non_json_response",
          attempt: currentAttempt,
        });
        setError(rotatingMessage);
        setErrorInfo({
          message: rotatingMessage,
          status: response.status,
        });
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        // Parse error response with errorCode and requestId
        const apiError = data as ApiErrorResponse;
        const category = getErrorCategory(response.status, apiError.errorCode);

        // Handle 429 with client-side backoff
        if (response.status === 429 && apiError.retryAfterSeconds) {
          retryAfterRef.current = Date.now() + apiError.retryAfterSeconds * 1000;
          console.log(`[Sanctuary] 429 received, backing off for ${apiError.retryAfterSeconds}s`);
        }

        const rotatingMessage = pickRotatingMessage({
          category,
          attempt: currentAttempt,
          retryAfterSeconds: apiError.retryAfterSeconds,
        });

        setError(rotatingMessage);
        setErrorInfo({
          message: rotatingMessage,
          errorCode: apiError.errorCode,
          requestId: apiError.requestId,
          retryAfterSeconds: apiError.retryAfterSeconds,
          status: response.status,
        });
        return;
      }

      const insightData: SanctuaryInsight = data;
      setInsight(insightData);
      attemptCountRef.current = 0; // Reset on success
    } catch (err: any) {
      // Ignore AbortError (expected when request is cancelled)
      if (err.name === "AbortError") {
        return;
      }
      console.error("Error loading insights:", err);
      const rotatingMessage = pickRotatingMessage({
        category: "provider_500",
        attempt: currentAttempt,
      });
      setError(rotatingMessage);
      setErrorInfo({
        message: rotatingMessage,
        status: 500,
      });
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
    }
  }, [timeframe, locale, router]);

  // Use stable primitive deps to prevent unnecessary re-fetches
  // Refetch when: timeframe changes, profile loads, locale changes
  useEffect(() => {
    if (!profileLoading && profile?.id) {
      loadInsight();
    }
    // Cleanup: abort on unmount or dep change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [timeframe, profileLoading, profile?.id, locale, loadInsight]);

  const timeframeLabel = t(`timeframes.${timeframe}`);

  // Handle profile loading errors
  if (profileError) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Card>
          <CardContent className="p-12 text-center space-y-4">
            <p className="text-accent-ink/70">
              {t("insights.errors.profileLoadError")}
            </p>
            <p className="text-sm text-danger-soft">{profileError}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              {tCommon("tryAgain")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      {/* Reactivation toast */}
      {reactivatedToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
          {t("insights.reactivated")}
        </div>
      )}

      {/* Social Insights toggle - only show when OFF */}
      {profile && !profile.social_insights_enabled && (
        <Card className="border-border-subtle bg-amber-50/50">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-accent-ink">{t("insights.socialInsights.paused")}</p>
              <p className="text-xs text-accent-ink/70 mt-1">
                {t("insights.socialInsights.pausedDescription")}
              </p>
            </div>
            <button
              onClick={() => handleToggleSocialInsights(true)}
              className="flex items-center gap-2 flex-shrink-0"
              aria-label="Enable social insights"
            >
              <span className="text-xs text-accent-ink/60">{tCommon("off").toUpperCase()}</span>
              <div className="w-11 h-7 rounded-full flex items-center px-1 transition-colors bg-gray-300">
                <div className="w-5 h-5 bg-white rounded-full transition-transform translate-x-0"></div>
              </div>
            </button>
          </CardContent>
        </Card>
      )}

      {/* Solara Logo - blended into background */}
      <div className="flex justify-center items-center pt-4 pb-8">
        <SolaraLogo />
      </div>

      {/* Tabs and timeframe - stacked on mobile, side-by-side on desktop */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <SanctuaryTabs />
        <div className="flex justify-center md:justify-end">
          <TimeframeToggle value={timeframe} onChange={(v) => setTimeframe(v as Timeframe)} />
        </div>
      </div>

      {/* Error state for incomplete profile */}
      {error && error.includes("birth signature") && (
        <Card className="border-border-subtle bg-accent-muted/20">
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-accent-ink/70">{error}</p>
            <Link href="/settings">
              <Button variant="gold">{t("insights.errors.birthSignatureRequired")}</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Error state with debug crumb (for non-profile errors) */}
      {error && !error.includes("birth signature") && !loading && (
        <Card className="border-border-subtle bg-accent-muted/20">
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-accent-ink/80 text-lg">{error}</p>

            {/* Debug crumb */}
            {errorInfo && (
              <p className="text-xs text-accent-ink/40 font-mono">
                {errorInfo.errorCode && `Code: ${errorInfo.errorCode}`}
                {errorInfo.requestId && ` • Req: ${errorInfo.requestId}`}
                {errorInfo.retryAfterSeconds && ` • Retry: ${errorInfo.retryAfterSeconds}s`}
                {!errorInfo.errorCode && !errorInfo.requestId && `Status: ${errorInfo.status}`}
              </p>
            )}

            <Button variant="outline" onClick={() => loadInsight()}>
              {tCommon("tryAgain")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {loading && !error && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-12 bg-accent-muted/10">
                  <div className="h-4 bg-accent-muted rounded w-3/4 mb-4"></div>
                  <div className="h-4 bg-accent-muted rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="space-y-6">
            <Card className="animate-pulse">
              <CardContent className="p-12 bg-accent-muted/10">
                <div className="h-4 bg-accent-muted rounded w-full"></div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Safety guard: prevent blank state when loading=false, insight=null, error=null */}
      {!loading && !insight && !error && (
        <Card className="border-border-subtle bg-accent-muted/20">
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-accent-ink/70">
              {t("insights.errors.insightLoadError")}
            </p>
            <Button variant="outline" onClick={() => loadInsight()}>
              {tCommon("tryAgain")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Content - only show when we have data and no errors */}
      {insight && !loading && !error && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal narrative */}
            <Card>
              <CardHeader>
                <div className="space-y-1">
                  <CardTitle>{t("insights.sunriseGuidance")}</CardTitle>
                  {profile?.zodiac_sign && (
                    <p className="text-sm text-accent-ink/60 uppercase tracking-wide">
                      {profile.zodiac_sign}
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-accent-ink/80 leading-relaxed whitespace-pre-line">
                  {insight.personalNarrative}
                </p>
              </CardContent>
            </Card>

            {/* Emotional Cadence - Day Arc Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>{t("insights.emotionalCadence.title")}</CardTitle>
                <p className="text-sm text-accent-ink/60">
                  {t("insights.energeticRhythm", { timeframe })}
                </p>
              </CardHeader>
              <CardContent>
                <EmotionalCadenceTimeline
                  dawn={insight.emotionalCadence?.dawn ?? "—"}
                  midday={insight.emotionalCadence?.midday ?? "—"}
                  dusk={insight.emotionalCadence?.dusk ?? "—"}
                  evening={insight.emotionalCadence?.evening ?? "—"}
                  midnight={insight.emotionalCadence?.midnight ?? "—"}
                  morning={insight.emotionalCadence?.morning ?? "—"}
                  coords={coords}
                />
              </CardContent>
            </Card>

            {/* Core themes and focus */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t("insights.coreThemesFor", { timeframe: timeframeLabel })}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {(insight.coreThemes ?? []).map((theme, i) => (
                      <li key={i} className="text-sm text-accent-ink/70 flex items-start gap-2">
                        <span className="text-accent-gold mt-1">✦</span>
                        <span>{theme}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t("insights.focusFor", { timeframe })}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-accent-ink/70 leading-relaxed">
                    {insight.focusForPeriod}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Tarot overview */}
            <Card>
              <CardHeader>
                <p className="micro-label mb-2">{t("insights.tarot.label")}</p>
                <CardTitle>{insight.tarot?.cardName ?? t("insights.tarot.yourCard")}</CardTitle>
                <p className="text-sm text-accent-ink/60">{insight.tarot?.arcanaType ?? ""}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const tarotCard = insight.tarot?.cardName ? findTarotCard(insight.tarot.cardName) : null;
                  return tarotCard ? (
                    <div className="mb-4 flex justify-center">
                      <Image
                        src={tarotCard.imageUrl}
                        alt={tarotCard.name}
                        width={128}
                        height={192}
                        className="h-48 w-auto rounded-xl object-contain shadow-md"
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-accent-ink/50 text-center mb-4">
                      {t("insights.tarot.matchError")}
                    </p>
                  );
                })()}
                <p className="text-sm text-accent-ink/70 leading-relaxed">
                  {insight.tarot?.summary ?? ""}
                </p>
                <p className="text-sm text-accent-ink/70 leading-relaxed">
                  {insight.tarot?.symbolism ?? ""}
                </p>
                <p className="text-sm text-accent-ink/70 leading-relaxed">
                  {insight.tarot?.guidance ?? ""}
                </p>
              </CardContent>
            </Card>

            {/* FEATURE DISABLED: Rune Whisper / Daily Sigil
            <Card>
              <CardHeader>
                <p className="micro-label mb-2">RUNE WHISPER — DAILY SIGIL</p>
                <CardTitle>{insight.rune?.name ?? "Your Rune"}{insight.rune?.keyword ? ` • ${insight.rune.keyword}` : ""}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const rune = insight.rune?.name ? findRune(insight.rune.name) : null;
                  return rune ? (
                    <div className="mb-4 flex justify-center">
                      <img
                        src={rune.imageUrl}
                        alt={rune.name}
                        className="h-32 w-auto object-contain"
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-accent-ink/50 text-center mb-4">
                      We had trouble matching this rune to our collection.
                    </p>
                  );
                })()}
                <p className="text-sm text-accent-ink/70 leading-relaxed">
                  {insight.rune?.meaning ?? ""}
                </p>
                {insight.rune?.affirmation && (
                  <p className="text-sm text-accent-ink/70 italic">
                    &quot;{insight.rune.affirmation}&quot;
                  </p>
                )}
              </CardContent>
            </Card>
            */}
          </div>

          {/* Right column (1/3 width) */}
          <div className="space-y-6">
            {/* Lucky Compass */}
            <Card>
              <CardHeader>
                <p className="micro-label mb-2">{t("insights.luckyCompass.label")}</p>
                <CardTitle className="text-lg">{t("insights.luckyCompass.numbers", { timeframe: timeframeLabel })}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  {(insight.luckyCompass?.numbers ?? []).map((num, i) => (
                    <div key={i} className="flex-1 pill bg-accent-muted text-center min-h-[72px] py-3 flex flex-col justify-center">
                      <p className="text-2xl font-bold text-accent-ink">{num.value}</p>
                      <p className="text-xs text-accent-ink/60 mt-1">{num.label}</p>
                    </div>
                  ))}
                </div>

                {(insight.luckyCompass?.numbers?.length ?? 0) > 0 && (
                  <div className="text-sm text-accent-ink/60 space-y-2">
                    {(insight.luckyCompass?.numbers ?? []).map((num, i) => (
                      <p key={i} className="min-h-[44px] flex items-start py-1">
                        <span className="font-medium text-accent-ink/80 mr-2">{num.value}:</span>
                        <span>{num.meaning}</span>
                      </p>
                    ))}
                  </div>
                )}

                <div>
                  <p className="micro-label mb-3">{t("insights.luckyCompass.powerWords")}</p>
                  <div className="flex flex-wrap gap-2">
                    {(insight.luckyCompass?.powerWords ?? []).map((word, i) => (
                      <span
                        key={i}
                        className="pill bg-white text-accent-ink text-sm border border-border-subtle min-h-[44px] px-4 flex items-center"
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                </div>

                {insight.luckyCompass?.handwrittenNote && (
                  <div className="pt-4 border-t border-border-subtle">
                    <p className="micro-label mb-2">{t("insights.luckyCompass.handwrittenNote")}</p>
                    <p className="text-sm text-accent-ink/70 italic leading-relaxed">
                      &quot;{insight.luckyCompass.handwrittenNote}&quot;
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      )}

      {/* Social Connect Modal */}
      <SocialConnectModal
        open={showSocialModal}
        onOpenChange={setShowSocialModal}
        onDone={handleModalDone}
        justConnectedProvider={justConnectedProvider}
      />
    </div>
  );
}

export default function SanctuaryInsightsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-accent-muted rounded w-1/4"></div>
            <div className="h-24 bg-accent-muted rounded"></div>
            <div className="h-12 bg-accent-muted rounded w-1/2"></div>
          </div>
        </div>
      }
    >
      <SanctuaryContent />
    </Suspense>
  );
}
