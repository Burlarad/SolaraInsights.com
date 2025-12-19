"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SanctuaryTabs } from "@/components/sanctuary/SanctuaryTabs";
import { TimeframeToggle } from "@/components/sanctuary/TimeframeToggle";
import { GreetingCard } from "@/components/sanctuary/GreetingCard";
import { EmotionalCadenceTimeline } from "@/components/sanctuary/EmotionalCadenceTimeline";
import { useSettings } from "@/providers/SettingsProvider";
import { SanctuaryInsight, Timeframe } from "@/types";
import { findTarotCard } from "@/lib/tarot";
import { findRune } from "@/lib/runes";
import { pickRotatingMessage, getErrorCategory, type ApiErrorResponse } from "@/lib/ui/pickRotatingMessage";

interface ErrorInfo {
  message: string;
  errorCode?: string;
  requestId?: string;
  retryAfterSeconds?: number;
  status: number;
}

export default function SanctuaryInsightsPage() {
  const router = useRouter();
  const { profile, loading: profileLoading, error: profileError } = useSettings();

  const [timeframe, setTimeframe] = useState<Timeframe>("today");
  const [insight, setInsight] = useState<SanctuaryInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);

  // Journal state
  const [journalContent, setJournalContent] = useState("");
  const [isSavingJournal, setIsSavingJournal] = useState(false);
  const [journalSavedMessage, setJournalSavedMessage] = useState<string | null>(null);
  const [journalError, setJournalError] = useState<string | null>(null);

  const loadInsight = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorInfo(null);
    setAttemptCount((prev) => prev + 1);

    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeframe }),
      });

      if (response.status === 401) {
        router.push("/sign-in");
        return;
      }

      // Check content-type to avoid parsing non-JSON responses
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        // Non-JSON response (HTML error page, etc.)
        const category = getErrorCategory(response.status);
        const rotatingMessage = pickRotatingMessage({
          category: "non_json_response",
          attempt: attemptCount + 1,
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
        const rotatingMessage = pickRotatingMessage({
          category,
          attempt: attemptCount + 1,
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
      setAttemptCount(0); // Reset on success

      // Load journal entry after insight is loaded
      loadJournalEntry();
    } catch (err: any) {
      console.error("Error loading insights:", err);
      const rotatingMessage = pickRotatingMessage({
        category: "provider_500",
        attempt: attemptCount + 1,
      });
      setError(rotatingMessage);
      setErrorInfo({
        message: rotatingMessage,
        status: 500,
      });
    } finally {
      setLoading(false);
    }
  }, [timeframe, attemptCount, router]);

  const loadJournalEntry = async () => {
    try {
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split("T")[0];

      const response = await fetch(
        `/api/journal?date=${today}&timeframe=${timeframe}`
      );

      if (!response.ok) {
        console.error("Failed to load journal entry");
        return;
      }

      const data = await response.json();
      setJournalContent(data.content || "");
    } catch (err: any) {
      console.error("Error loading journal entry:", err);
    }
  };

  const saveJournalEntry = async () => {
    setIsSavingJournal(true);
    setJournalError(null);
    setJournalSavedMessage(null);

    try {
      const today = new Date().toISOString().split("T")[0];

      const response = await fetch("/api/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: today,
          timeframe,
          content: journalContent,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save journal entry");
      }

      // Show success message briefly
      setJournalSavedMessage("Saved");
      setTimeout(() => setJournalSavedMessage(null), 2000);
    } catch (err: any) {
      console.error("Error saving journal entry:", err);
      setJournalError("Unable to save. Please try again.");
      setTimeout(() => setJournalError(null), 3000);
    } finally {
      setIsSavingJournal(false);
    }
  };

  const handleJournalKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      saveJournalEntry();
    }
  };

  useEffect(() => {
    if (!profileLoading && profile) {
      loadInsight();
    }
  }, [timeframe, profileLoading, profile]);

  const timeframeLabel = timeframe === "today" ? "Today" : timeframe === "week" ? "Week" : timeframe === "month" ? "Month" : "Year";

  // Handle profile loading errors
  if (profileError) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Card>
          <CardContent className="p-12 text-center space-y-4">
            <p className="text-accent-ink/70">
              We had trouble loading your profile. Please try again, or contact support if this continues.
            </p>
            <p className="text-sm text-danger-soft">{profileError}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      {/* Timezone info */}
      <div className="flex items-center justify-between text-xs text-accent-ink/60">
        <div>
          <span className="font-medium">Local timezone:</span> {profile?.timezone || "Loading..."}
        </div>
        <div>Sanctuary insights</div>
      </div>

      {/* Greeting card */}
      <GreetingCard
        name={profile?.preferred_name || profile?.full_name || "Friend"}
        message={loading ? "Tuning your insights..." : error ? error : "Your insights are ready."}
      />

      {/* Tabs and timeframe */}
      <div className="flex items-center justify-between">
        <SanctuaryTabs />
        <TimeframeToggle value={timeframeLabel} onChange={(v) => setTimeframe(v.toLowerCase() as Timeframe)} />
      </div>

      {/* Error state for incomplete profile */}
      {error && error.includes("birth signature") && (
        <Card className="border-border-subtle bg-accent-muted/20">
          <CardContent className="p-8 text-center space-y-4">
            <p className="text-accent-ink/70">{error}</p>
            <Link href="/settings">
              <Button variant="gold">Tune your birth signature</Button>
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
              Try again
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

      {/* Content - only show when we have data and no errors */}
      {insight && !loading && !error && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal narrative */}
            <Card>
              <CardHeader>
                <div className="space-y-1">
                  <CardTitle>Sunrise guidance</CardTitle>
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
                <CardTitle>Emotional Cadence</CardTitle>
                <p className="text-sm text-accent-ink/60">
                  Your energetic rhythm for {timeframe}
                </p>
              </CardHeader>
              <CardContent>
                <EmotionalCadenceTimeline
                  dawn={insight.emotionalCadence?.dawn ?? "—"}
                  midday={insight.emotionalCadence?.midday ?? "—"}
                  dusk={insight.emotionalCadence?.dusk ?? "—"}
                />
              </CardContent>
            </Card>

            {/* Core themes and focus */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{timeframeLabel}&apos;s core themes</CardTitle>
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
                  <CardTitle className="text-lg">Focus for {timeframe}</CardTitle>
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
                <p className="micro-label mb-2">TAROT OVERVIEW — DAILY DRAW</p>
                <CardTitle>{insight.tarot?.cardName ?? "Your Card"}</CardTitle>
                <p className="text-sm text-accent-ink/60">{insight.tarot?.arcanaType ?? ""}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const tarotCard = insight.tarot?.cardName ? findTarotCard(insight.tarot.cardName) : null;
                  return tarotCard ? (
                    <div className="mb-4 flex justify-center">
                      <img
                        src={tarotCard.imageUrl}
                        alt={tarotCard.name}
                        className="h-48 w-auto rounded-xl object-contain shadow-md"
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-accent-ink/50 text-center mb-4">
                      We had trouble matching this tarot card to our deck.
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

            {/* Rune whisper */}
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
          </div>

          {/* Right column (1/3 width) */}
          <div className="space-y-6">
            {/* Lucky Compass */}
            <Card>
              <CardHeader>
                <p className="micro-label mb-2">LUCKY COMPASS — DAILY LUCK + LIGHT MARKERS</p>
                <CardTitle className="text-lg">{timeframeLabel}&apos;s numbers</CardTitle>
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
                  <p className="micro-label mb-3">POWER WORDS</p>
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
                    <p className="micro-label mb-2">A HANDWRITTEN NOTE</p>
                    <p className="text-sm text-accent-ink/70 italic leading-relaxed">
                      &quot;{insight.luckyCompass.handwrittenNote}&quot;
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Daily reflection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Daily reflection</CardTitle>
                <p className="text-sm text-accent-ink/60">
                  Let your notes stay private and gentle.
                </p>
              </CardHeader>
              <CardContent>
                <textarea
                  className="w-full h-32 px-3 py-2 rounded-lg border border-border-subtle bg-white resize-none focus:outline-none focus:ring-2 focus:ring-accent-gold/50 text-sm"
                  placeholder={insight.journalPrompt || "A few words for your sky today…"}
                  value={journalContent}
                  onChange={(e) => setJournalContent(e.target.value)}
                  onKeyDown={handleJournalKeyDown}
                  disabled={isSavingJournal}
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-accent-ink/60">
                    Press ⌘+Enter or Ctrl+Enter to save
                  </p>
                  {journalSavedMessage && (
                    <p className="text-xs text-accent-gold font-medium">
                      ✓ {journalSavedMessage}
                    </p>
                  )}
                  {journalError && (
                    <p className="text-xs text-danger-soft">
                      {journalError}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
