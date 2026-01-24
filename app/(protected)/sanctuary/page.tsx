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
import { SocialConnectModal } from "@/components/sanctuary/SocialConnectModal";
import { useSettings } from "@/providers/SettingsProvider";
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

      {/* Tabs - centered */}
      <div className="flex flex-col items-center gap-4">
        <SanctuaryTabs />
        <TimeframeToggle value={timeframe} onChange={(v) => setTimeframe(v as Timeframe)} />
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
        <div className="bg-white/60 backdrop-blur-sm rounded-3xl shadow-xl border border-white/80 max-w-3xl mx-auto overflow-hidden animate-pulse">
          {/* Quote skeleton */}
          <div className="bg-gradient-to-br from-accent-gold/10 via-accent-gold/5 to-transparent px-8 py-10 md:px-12 md:py-14 border-b border-accent-gold/10">
            <div className="text-center space-y-4">
              <div className="h-6 bg-accent-muted rounded w-3/4 mx-auto" />
              <div className="h-6 bg-accent-muted rounded w-1/2 mx-auto" />
              <div className="h-4 bg-accent-muted rounded w-1/4 mx-auto" />
            </div>
          </div>
          {/* Content skeleton */}
          <div className="px-8 py-10 md:px-12 md:py-12 space-y-10">
            <div className="space-y-4">
              <div className="h-4 bg-accent-muted rounded w-1/3 mx-auto" />
              <div className="h-4 bg-accent-muted rounded w-full" />
              <div className="h-4 bg-accent-muted rounded w-full" />
              <div className="h-4 bg-accent-muted rounded w-2/3" />
            </div>
            <div className="flex justify-center gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="text-center">
                  <div className="h-12 w-12 bg-accent-muted rounded-full mx-auto" />
                  <div className="h-3 bg-accent-muted rounded w-12 mt-2" />
                </div>
              ))}
            </div>
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
      {/* Main Insight Tablet */}
      {insight && !loading && !error && (
        <div className="bg-white/60 backdrop-blur-sm rounded-3xl shadow-xl border border-white/80 max-w-3xl mx-auto overflow-hidden">

          {/* Daily Wisdom Quote - Hero Section */}
          {insight.dailyWisdom?.quote && (
            <div className="bg-gradient-to-br from-accent-gold/10 via-accent-gold/5 to-transparent px-8 py-10 md:px-12 md:py-14 border-b border-accent-gold/10">
              <div className="text-center space-y-4">
                <p className="text-xl md:text-2xl font-serif text-accent-ink leading-relaxed italic">
                  &ldquo;{insight.dailyWisdom.quote}&rdquo;
                </p>
                <p className="text-sm font-medium text-accent-gold tracking-wide uppercase">
                  — {insight.dailyWisdom.author}
                </p>
              </div>
            </div>
          )}

          {/* Content Body */}
          <div className="px-8 py-10 md:px-12 md:py-12 space-y-10">

            {/* Your Daily Reading */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-accent-gold/30 to-transparent" />
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-gold">
                  {t("insights.yourReading")}
                </h2>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-accent-gold/30 to-transparent" />
              </div>
              {profile?.zodiac_sign && (
                <p className="text-center text-sm text-accent-ink/50 uppercase tracking-wide mb-4">
                  {profile.zodiac_sign} • {timeframeLabel}
                </p>
              )}
              <p className="text-accent-ink/85 leading-relaxed whitespace-pre-line text-center md:text-left">
                {insight.personalNarrative}
              </p>
            </section>

            {/* Tarot Card of the Day */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-accent-gold/30 to-transparent" />
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-gold">
                  {t("insights.tarot.label")}
                </h2>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-accent-gold/30 to-transparent" />
              </div>

              <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
                {/* Card Image */}
                {(() => {
                  const tarotCard = insight.tarot?.cardName ? findTarotCard(insight.tarot.cardName) : null;
                  return tarotCard ? (
                    <div className="flex-shrink-0">
                      <div className="relative">
                        <Image
                          src={tarotCard.imageUrl}
                          alt={tarotCard.name}
                          width={140}
                          height={210}
                          className="h-52 w-auto rounded-xl object-contain shadow-lg"
                        />
                        <div className="absolute inset-0 rounded-xl ring-1 ring-accent-gold/20" />
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Card Details */}
                <div className="flex-1 text-center md:text-left space-y-3">
                  <div>
                    <h3 className="text-xl font-semibold text-accent-ink">
                      {insight.tarot?.cardName ?? t("insights.tarot.yourCard")}
                    </h3>
                    <p className="text-sm text-accent-ink/50">{insight.tarot?.arcanaType ?? ""}</p>
                  </div>
                  <p className="text-accent-ink/80 leading-relaxed">
                    {insight.tarot?.summary ?? ""}
                  </p>
                  <p className="text-accent-ink/70 leading-relaxed text-sm">
                    {insight.tarot?.symbolism ?? ""}
                  </p>
                  <p className="text-accent-ink/70 leading-relaxed text-sm italic border-l-2 border-accent-gold/30 pl-4">
                    {insight.tarot?.guidance ?? ""}
                  </p>
                </div>
              </div>
            </section>

            {/* Lucky Numbers */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-accent-gold/30 to-transparent" />
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-gold">
                  {t("insights.luckyCompass.label")}
                </h2>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-accent-gold/30 to-transparent" />
              </div>

              {/* Numbers Display - Elegant Typography */}
              <div className="flex justify-center gap-8 md:gap-12 mb-6">
                {(insight.luckyCompass?.numbers ?? []).map((num, i) => (
                  <div key={i} className="text-center">
                    <p className="text-4xl md:text-5xl font-light text-accent-gold tracking-tight">
                      {num.value}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-accent-ink/40 mt-1">
                      {num.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* Number Meanings */}
              {(insight.luckyCompass?.numbers?.length ?? 0) > 0 && (
                <div className="space-y-2 text-center">
                  {(insight.luckyCompass?.numbers ?? []).map((num, i) => (
                    <p key={i} className="text-sm text-accent-ink/60">
                      <span className="font-medium text-accent-ink/70">{num.value}</span>
                      <span className="mx-2 text-accent-gold/50">·</span>
                      <span>{num.meaning}</span>
                    </p>
                  ))}
                </div>
              )}
            </section>

            {/* Core Themes */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-accent-gold/30 to-transparent" />
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-gold">
                  {t("insights.themes")}
                </h2>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-accent-gold/30 to-transparent" />
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                {(insight.coreThemes ?? []).map((theme, i) => (
                  <span
                    key={i}
                    className="px-4 py-2 text-sm text-accent-ink/80 bg-accent-gold/5 rounded-full border border-accent-gold/15"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </section>

            {/* Focus for the Period */}
            {insight.focusForPeriod && (
              <section className="bg-accent-muted/30 rounded-2xl p-6 text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent-gold mb-3">
                  {t("insights.focusFor", { timeframe })}
                </p>
                <p className="text-accent-ink/75 leading-relaxed">
                  {insight.focusForPeriod}
                </p>
              </section>
            )}

            {/* Power Words */}
            {(insight.luckyCompass?.powerWords?.length ?? 0) > 0 && (
              <section className="text-center pt-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-accent-ink/40 mb-3">
                  {t("insights.luckyCompass.powerWords")}
                </p>
                <div className="flex justify-center gap-6">
                  {(insight.luckyCompass?.powerWords ?? []).map((word, i) => (
                    <span
                      key={i}
                      className="text-lg font-light text-accent-gold tracking-wide"
                    >
                      {word}
                    </span>
                  ))}
                </div>
              </section>
            )}

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
