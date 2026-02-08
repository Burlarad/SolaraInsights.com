"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { SanctuaryTabs } from "@/components/sanctuary/SanctuaryTabs";
import { SolaraLogo } from "@/components/layout/SolaraLogo";
import type { FullBirthChartInsight, TabDeepDive } from "@/types/natalAI";
import { SolaraCard } from "@/components/ui/solara-card";
import { Button } from "@/components/ui/button";
import { pickRotatingMessage, getErrorCategory, type ApiErrorResponse } from "@/lib/ui/pickRotatingMessage";
import { AspectGrid, AspectList } from "@/components/charts/AspectGrid";
import { PlacePicker, type PlaceSelection } from "@/components/shared/PlacePicker";
import { BalanceCharts } from "@/components/charts/BalanceCharts";
import { useTranslations } from "next-intl";
import { useSettings } from "@/providers/SettingsProvider";

interface ErrorInfo {
  message: string;
  errorCode?: string;
  requestId?: string;
  retryAfterSeconds?: number;
  status: number;
}

/**
 * Reusable component for rendering a tab deep dive
 */
function DeepDiveCard({
  title,
  subtitle,
  deepDive,
}: {
  title: string;
  subtitle?: string;
  deepDive: TabDeepDive;
}) {
  return (
    <SolaraCard className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        {subtitle && <p className="text-sm text-accent-ink/60">{subtitle}</p>}
      </div>

      {/* Meaning - 2 paragraphs */}
      <div className="space-y-4">
        {deepDive.meaning.split("\n\n").map((para, idx) => (
          <p key={idx} className="text-base text-accent-ink/80 leading-relaxed">
            {para}
          </p>
        ))}
      </div>

      {/* Aligned - 3 bullets */}
      <div>
        <h3 className="text-sm font-medium text-accent-ink/70 mb-2">When You're Aligned</h3>
        <ul className="space-y-2">
          {deepDive.aligned.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-accent-ink/80">
              <span className="text-accent mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Off Course - 3 bullets */}
      <div>
        <h3 className="text-sm font-medium text-accent-ink/70 mb-2">When You're Off Course</h3>
        <ul className="space-y-2">
          {deepDive.offCourse.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-accent-ink/80">
              <span className="text-accent-ink/40 mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Decision Rule */}
      <div className="bg-accent-soft/30 rounded-lg p-4">
        <h3 className="text-sm font-medium text-accent-ink/70 mb-1">Decision Rule</h3>
        <p className="text-sm text-accent-ink font-medium">{deepDive.decisionRule}</p>
      </div>
    </SolaraCard>
  );
}

type SoulPathSection = "narrative" | "foundations" | "connections" | "patterns-path";

// Section labels are now translated in the component using t("sections.*")

const HOUSE_LABELS: Record<number, { ordinal: string; title: string }> = {
  1: { ordinal: "1st", title: "Self & Aura" },
  2: { ordinal: "2nd", title: "Money & Worth" },
  3: { ordinal: "3rd", title: "Mind & Messages" },
  4: { ordinal: "4th", title: "Home & Roots" },
  5: { ordinal: "5th", title: "Joy & Creation" },
  6: { ordinal: "6th", title: "Work & Well-Being" },
  7: { ordinal: "7th", title: "Partners & Mirrors" },
  8: { ordinal: "8th", title: "Intimacy & Transformation" },
  9: { ordinal: "9th", title: "Beliefs & Exploration" },
  10: { ordinal: "10th", title: "Career & Legacy" },
  11: { ordinal: "11th", title: "Community & Dreams" },
  12: { ordinal: "12th", title: "Inner World & Spirit" },
};

function formatHouseLabel(house: number): string {
  const meta = HOUSE_LABELS[house];
  if (!meta) return `${house}th House`;
  return `${meta.ordinal} House – ${meta.title}`;
}

type CheckoutInputs = {
  birth_date: string;
  birth_time: string;
  birth_lat: number;
  birth_lon: number;
  timezone: string;
};

type BirthChartResponse = {
  placements: any;
  insight: FullBirthChartInsight | null;
  chart_key?: string;
  is_official?: boolean;
  mode?: "official" | "checkout";
  error?: string;
  message?: string;
};

export default function BirthChartPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const attemptCountRef = useRef(0); // Use ref to avoid infinite loop
  const [incompleteProfile, setIncompleteProfile] = useState(false);
  const [insight, setInsight] = useState<FullBirthChartInsight | null>(null);
  const [placements, setPlacements] = useState<any | null>(null);
  const [activeSection, setActiveSection] = useState<SoulPathSection>("narrative");
  const [showAllAspects, setShowAllAspects] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState(false);
  const [checkoutPanelOpen, setCheckoutPanelOpen] = useState(false);
  const [checkoutDate, setCheckoutDate] = useState("");
  const [checkoutTime, setCheckoutTime] = useState("");
  const [checkoutPlace, setCheckoutPlace] = useState<PlaceSelection | null>(null);
  const activeCheckoutInputsRef = useRef<CheckoutInputs | null>(null);
  const checkoutPrefillDoneRef = useRef(false);
  const { profile } = useSettings();
  const t = useTranslations("astrology");
  const tCommon = useTranslations("common");

  // Derived state: check if insight has the full expected structure
  // Must validate ALL nested properties to prevent client-side crashes
  const hasFullInsight =
    insight !== null &&
    typeof insight.coreSummary?.headline === "string" &&
    typeof insight.coreSummary?.overallVibe === "string" &&
    typeof insight.sections?.identity === "string" &&
    typeof insight.sections?.emotions === "string" &&
    typeof insight.sections?.loveAndRelationships === "string" &&
    typeof insight.sections?.workAndMoney === "string" &&
    typeof insight.sections?.purposeAndGrowth === "string" &&
    typeof insight.sections?.innerWorld === "string";

  const fetchBirthChart = useCallback(async (checkoutInputs?: CheckoutInputs) => {
    setLoading(true);
    setError(null);
    setErrorInfo(null);
    setIncompleteProfile(false);
    attemptCountRef.current += 1;
    const currentAttempt = attemptCountRef.current;
    activeCheckoutInputsRef.current = checkoutInputs ?? null;

    try {
      const body = checkoutInputs
        ? { mode: "checkout" as const, inputs: checkoutInputs }
        : { mode: "official" as const };

      const res = await fetch("/api/birth-chart-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        setError("Please sign in to view your Soul Path.");
        setLoading(false);
        return;
      }

      // Check content-type to avoid parsing non-JSON
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const rotatingMessage = pickRotatingMessage({
          category: "non_json_response",
          attempt: currentAttempt,
        });
        setError(rotatingMessage);
        setErrorInfo({
          message: rotatingMessage,
          status: res.status,
        });
        setLoading(false);
        return;
      }

      const data = await res.json();

      if (res.status === 400) {
        // Check for incomplete profile error (both old and new endpoint formats)
        if (
          data?.error === "Incomplete profile" ||
          data?.errorCode === "INCOMPLETE_BIRTH_DATA" ||
          data?.errorCode === "INCOMPLETE_PREVIEW_DATA"
        ) {
          setIncompleteProfile(true);
          setLoading(false);
          return;
        }
      }

      if (!res.ok) {
        const apiError = data as ApiErrorResponse;
        const category = getErrorCategory(res.status, apiError.errorCode);
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
          status: res.status,
        });
        setLoading(false);
        return;
      }

      const chartData: BirthChartResponse = data;
      console.log("[BirthChart UI] Received placements:", chartData.placements);
      console.log("[BirthChart UI] Houses count:", chartData.placements?.houses?.length);
      console.log("[BirthChart UI] Houses array:", chartData.placements?.houses);
      setPlacements(chartData.placements || null);
      setInsight(chartData.insight ?? null);
      attemptCountRef.current = 0; // Reset on success
      setLoading(false);
    } catch (err) {
      console.error("[BirthChart] Client fetch error:", err);
      const rotatingMessage = pickRotatingMessage({
        category: "provider_500",
        attempt: currentAttempt,
      });
      setError(rotatingMessage);
      setErrorInfo({
        message: rotatingMessage,
        status: 500,
      });
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBirthChart();
  }, [fetchBirthChart]);

  const handleCheckoutGenerate = useCallback(() => {
    if (!checkoutDate || !checkoutTime || !checkoutPlace) return;
    setCheckoutMode(true);
    setCheckoutPanelOpen(false);
    fetchBirthChart({
      birth_date: checkoutDate,
      birth_time: checkoutTime,
      birth_lat: checkoutPlace.birth_lat,
      birth_lon: checkoutPlace.birth_lon,
      timezone: checkoutPlace.timezone,
    });
  }, [checkoutDate, checkoutTime, checkoutPlace, fetchBirthChart]);

  const handleReturnToOfficial = useCallback(() => {
    setCheckoutMode(false);
    setCheckoutPanelOpen(false);
    setCheckoutDate("");
    setCheckoutTime("");
    setCheckoutPlace(null);
    checkoutPrefillDoneRef.current = false;
    fetchBirthChart();
  }, [fetchBirthChart]);

  // Prefill checkout fields from Settings on first panel open
  useEffect(() => {
    if (!checkoutPanelOpen || checkoutPrefillDoneRef.current || !profile) return;
    checkoutPrefillDoneRef.current = true;
    if (!checkoutDate && profile.birth_date) setCheckoutDate(profile.birth_date);
    if (!checkoutTime && profile.birth_time) setCheckoutTime(profile.birth_time);
    if (
      !checkoutPlace &&
      profile.birth_lat != null &&
      profile.birth_lon != null &&
      profile.timezone
    ) {
      setCheckoutPlace({
        birth_lat: profile.birth_lat,
        birth_lon: profile.birth_lon,
        timezone: profile.timezone,
        birth_city: profile.birth_city ?? "",
        birth_region: profile.birth_region ?? "",
        birth_country: profile.birth_country ?? "",
      });
    }
  }, [checkoutPanelOpen, profile, checkoutDate, checkoutTime, checkoutPlace]);

  // Reset checkout state on unmount (defensive)
  useEffect(() => {
    return () => {
      activeCheckoutInputsRef.current = null;
      checkoutPrefillDoneRef.current = false;
    };
  }, []);

  // Build sections array with translations
  const SECTIONS: { id: SoulPathSection; label: string }[] = [
    { id: "narrative", label: t("sections.narrative") },
    { id: "foundations", label: t("sections.foundations") },
    { id: "connections", label: t("sections.connections") },
    { id: "patterns-path", label: t("sections.patternsPath") },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      {/* Solara Logo */}
      <div className="flex justify-center items-center pt-4 pb-8">
        <SolaraLogo />
      </div>

      {/* Tabs - centered */}
      <div className="flex justify-center">
        <SanctuaryTabs />
      </div>

      {/* Checkout Another Book */}
      {!loading && !error && !incompleteProfile && (
        <div className="max-w-3xl mx-auto">
          {checkoutMode ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 flex items-center justify-between gap-4">
              <p className="text-sm text-accent-ink/70">
                Viewing a checkout chart — temporary, not saved.
              </p>
              <Button variant="outline" size="sm" onClick={handleReturnToOfficial}>
                Return to My Book
              </Button>
            </div>
          ) : (
            <div>
              <button
                onClick={() => setCheckoutPanelOpen(!checkoutPanelOpen)}
                className="text-sm text-accent underline hover:no-underline"
              >
                {checkoutPanelOpen ? "Close" : "Checkout Another Book"}
              </button>
              {checkoutPanelOpen && (
                <div className="mt-4 rounded-xl border border-accent-soft bg-white/50 p-6 space-y-4">
                  <p className="text-sm text-accent-ink/70">
                    Generate a chart for different birth data. This is temporary and won't affect your saved chart.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-accent-ink/70 mb-1 block">Birth Date</label>
                      <input
                        type="date"
                        value={checkoutDate}
                        onChange={(e) => setCheckoutDate(e.target.value)}
                        className="w-full rounded-lg border border-accent-soft px-3 py-2 text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-accent-ink/70 mb-1 block">Birth Time</label>
                      <input
                        type="time"
                        value={checkoutTime}
                        onChange={(e) => setCheckoutTime(e.target.value)}
                        className="w-full rounded-lg border border-accent-soft px-3 py-2 text-sm bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-accent-ink/70 mb-1 block">Birth Location</label>
                    <PlacePicker
                      initialValue={
                        checkoutPlace
                          ? [checkoutPlace.birth_city, checkoutPlace.birth_region, checkoutPlace.birth_country]
                              .filter(Boolean)
                              .join(", ")
                          : ""
                      }
                      onSelect={(place) => setCheckoutPlace(place)}
                      onClear={() => setCheckoutPlace(null)}
                      placeholder="Search for birth city..."
                    />
                  </div>
                  <Button
                    onClick={handleCheckoutGenerate}
                    disabled={!checkoutDate || !checkoutTime || !checkoutPlace}
                  >
                    Generate Chart
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div>
          <p className="text-sm text-accent-ink/70">{t("calculating")}</p>
        </div>
      )}

      {!loading && incompleteProfile && (
        <div className="rounded-xl border border-accent-soft bg-accent-soft/30 p-8 space-y-3">
          <h2 className="text-lg font-semibold">{t("errors.incompleteProfile")}</h2>
          <p className="text-sm text-accent-ink/80">
            {t("errors.incompleteProfileDesc")}
          </p>
          <a
            href="/settings"
            className="inline-flex items-center text-sm font-medium text-accent underline"
          >
            {tCommon("goToSettings")}
          </a>
        </div>
      )}

      {!loading && error && !incompleteProfile && (
        <div className="rounded-xl border border-accent-soft bg-accent-soft/30 p-8 space-y-4 text-center">
          <p className="text-lg text-accent-ink/80">{error}</p>

          {/* Debug crumb */}
          {errorInfo && (
            <p className="text-xs text-accent-ink/40 font-mono">
              {errorInfo.errorCode && `Code: ${errorInfo.errorCode}`}
              {errorInfo.requestId && ` • Req: ${errorInfo.requestId}`}
              {errorInfo.retryAfterSeconds && ` • Retry: ${errorInfo.retryAfterSeconds}s`}
              {!errorInfo.errorCode && !errorInfo.requestId && `Status: ${errorInfo.status}`}
            </p>
          )}

          <Button variant="outline" onClick={() => fetchBirthChart(activeCheckoutInputsRef.current ?? undefined)}>
            {tCommon("tryAgain")}
          </Button>
        </div>
      )}

      {/* Section Toggle - Horizontal pills on md+, dropdown on mobile */}
      {!loading && !error && !incompleteProfile && (
        <>
          {/* Mobile: Dropdown */}
          <div className="md:hidden flex justify-center">
            <select
              value={activeSection}
              onChange={(e) => setActiveSection(e.target.value as SoulPathSection)}
              className="px-4 py-3 rounded-full border-0 bg-white/50 text-accent-ink font-cursive text-xl font-normal focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {SECTIONS.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>
          </div>

          {/* Desktop: Horizontal pills matching SanctuaryTabs */}
          <div className="hidden md:flex justify-center">
            <div className="inline-flex gap-2 p-1 bg-white/50 rounded-full">
              {SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`pill font-cursive text-xl md:text-2xl font-normal transition-all ${
                    activeSection === section.id
                      ? "bg-accent-ink text-white shadow-sm"
                      : "bg-transparent text-accent-ink hover:bg-white/80"
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Section Content */}
      {!loading && !error && !incompleteProfile && (
        <div className="max-w-3xl mx-auto">
          {/* Personal Narrative */}
          {activeSection === "narrative" && hasFullInsight && (
            <div className="space-y-6">
              <SolaraCard className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-2">{t("narrative.title")}</h2>
                  <p className="text-sm text-accent-ink/60">{t("narrative.subtitle")}</p>
                </div>

                {/* Headline */}
                <h3 className="text-xl md:text-2xl font-semibold leading-snug text-accent-ink">
                  {insight!.coreSummary.headline}
                </h3>

                {/* Overall Vibe */}
                <div className="text-base text-accent-ink/80 leading-relaxed space-y-4">
                  {insight!.coreSummary.overallVibe.split("\n\n").map((para, idx) => (
                    <p key={idx}>{para}</p>
                  ))}
                </div>

                {/* Life Sections */}
                <div className="space-y-6 pt-4 border-t border-accent-soft/30">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-accent-ink/70">{t("narrative.identity")}</h4>
                    <div className="text-base text-accent-ink/80 leading-relaxed space-y-4">
                      {insight!.sections.identity.split("\n\n").map((para, idx) => (
                        <p key={idx}>{para}</p>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-accent-ink/70">{t("narrative.emotions")}</h4>
                    <div className="text-base text-accent-ink/80 leading-relaxed space-y-4">
                      {insight!.sections.emotions.split("\n\n").map((para, idx) => (
                        <p key={idx}>{para}</p>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-accent-ink/70">{t("narrative.loveRelationships")}</h4>
                    <div className="text-base text-accent-ink/80 leading-relaxed space-y-4">
                      {insight!.sections.loveAndRelationships.split("\n\n").map((para, idx) => (
                        <p key={idx}>{para}</p>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-accent-ink/70">{t("narrative.workMoney")}</h4>
                    <div className="text-base text-accent-ink/80 leading-relaxed space-y-4">
                      {insight!.sections.workAndMoney.split("\n\n").map((para, idx) => (
                        <p key={idx}>{para}</p>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-accent-ink/70">{t("narrative.purposeGrowth")}</h4>
                    <div className="text-base text-accent-ink/80 leading-relaxed space-y-4">
                      {insight!.sections.purposeAndGrowth.split("\n\n").map((para, idx) => (
                        <p key={idx}>{para}</p>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-accent-ink/70">{t("narrative.innerWorld")}</h4>
                    <div className="text-base text-accent-ink/80 leading-relaxed space-y-4">
                      {insight!.sections.innerWorld.split("\n\n").map((para, idx) => (
                        <p key={idx}>{para}</p>
                      ))}
                    </div>
                  </div>
                </div>
              </SolaraCard>
            </div>
          )}

          {activeSection === "narrative" && !hasFullInsight && (
            <SolaraCard className="space-y-3">
              <h2 className="text-lg font-semibold">{t("narrative.notAvailable")}</h2>
              <p className="text-sm text-accent-ink/80 leading-relaxed">
                {t("narrative.notAvailableDesc")}
              </p>
            </SolaraCard>
          )}

          {/* Foundations - Planets + Houses */}
          {activeSection === "foundations" && placements && (
            <div className="space-y-8">
              {/* Planetary Placements */}
              {insight?.tabDeepDives?.planetaryPlacements && (
                <DeepDiveCard
                  title={t("planets.deepDiveTitle")}
                  subtitle={t("planets.subtitle")}
                  deepDive={insight.tabDeepDives.planetaryPlacements}
                />
              )}

              <SolaraCard className="space-y-4">
                <h2 className="text-xl font-semibold">{t("planets.title")}</h2>
                <p className="text-sm text-accent-ink/60 leading-relaxed">
                  {t("planets.description")}
                </p>
                <div className="space-y-4">
                  {placements.planets?.map((p: any) => (
                    <div key={p.name} className="pb-3 border-b border-accent-soft/30 last:border-0">
                      <div className="flex items-baseline justify-between gap-4 mb-1">
                        <span className="font-medium text-accent-ink">
                          {p.name}
                          {p.retrograde === true && " ℞"}
                        </span>
                        <span className="text-sm text-accent-ink/70">
                          {p.sign}
                          {p.house && <> — {p.house}th house</>}
                        </span>
                      </div>
                      <p className="text-sm text-accent-ink/60 leading-relaxed">
                        {p.name === "Sun" && "Your core sense of self and vitality."}
                        {p.name === "Moon" && "Your emotional landscape and inner world."}
                        {p.name === "Mercury" && "How you think, communicate, and process information."}
                        {p.name === "Venus" && "How you love, connect, and find beauty."}
                        {p.name === "Mars" && "Your drive, desire, and how you take action."}
                        {p.name === "Jupiter" && "Where you expand, believe, and find meaning."}
                        {p.name === "Saturn" && "Where you build structure and meet responsibility."}
                        {p.name === "Uranus" && "Where you innovate, rebel, and seek freedom."}
                        {p.name === "Neptune" && "Where you dream, dissolve boundaries, and connect to the sacred."}
                        {p.name === "Pluto" && "Where you transform, release, and reclaim power."}
                        {p.name === "North Node" && "Your invitation toward growth."}
                        {p.name === "Chiron" && "Where healing emerges from your deepest wounds."}
                      </p>
                    </div>
                  ))}
                </div>
              </SolaraCard>

              {/* Houses */}
              {insight?.tabDeepDives?.houses && (
                <DeepDiveCard
                  title={t("houses.deepDiveTitle")}
                  subtitle={t("houses.subtitle")}
                  deepDive={insight.tabDeepDives.houses}
                />
              )}

              <SolaraCard className="space-y-4">
                <h2 className="text-xl font-semibold">{t("houses.title")}</h2>
                <p className="text-sm text-accent-ink/60 leading-relaxed">
                  {t("houses.description")}
                </p>
                <div className="space-y-4">
                  {placements.houses
                    ?.filter((h: any) => !!h.signOnCusp)
                    .map((h: any) => {
                      const planetsInHouse = placements.planets?.filter(
                        (p: any) => p.house === h.house
                      );
                      return (
                        <div key={h.house} className="pb-3 border-b border-accent-soft/30 last:border-0">
                          <div className="flex items-baseline justify-between gap-4 mb-1">
                            <span className="font-medium text-accent-ink">
                              {formatHouseLabel(h.house)}
                            </span>
                            <span className="text-sm text-accent-ink/70">{h.signOnCusp}</span>
                          </div>
                          {planetsInHouse && planetsInHouse.length > 0 && (
                            <div className="text-sm text-accent-ink/60 mt-1">
                              {planetsInHouse.map((p: any) => p.name).join(", ")}
                            </div>
                          )}
                          <p className="text-sm text-accent-ink/60 leading-relaxed mt-2">
                            {h.house === 1 && "How you meet the world and present yourself."}
                            {h.house === 2 && "Your relationship with resources, worth, and stability."}
                            {h.house === 3 && "How you communicate, learn, and connect nearby."}
                            {h.house === 4 && "Your inner foundation, home, and emotional roots."}
                            {h.house === 5 && "Where you create, play, and express joy."}
                            {h.house === 6 && "Your daily rhythms, work, and well-being."}
                            {h.house === 7 && "How you partner, reflect, and relate one-to-one."}
                            {h.house === 8 && "Where you merge, transform, and face the unknown."}
                            {h.house === 9 && "Your search for meaning, belief, and expansion."}
                            {h.house === 10 && "Your public role, career, and visible legacy."}
                            {h.house === 11 && "Your vision for community, friendship, and the future."}
                            {h.house === 12 && "Your inner sanctuary, solitude, and the sacred."}
                          </p>
                        </div>
                      );
                    })}
                </div>
              </SolaraCard>
            </div>
          )}

          {/* Connections (Aspects) */}
          {activeSection === "connections" && placements?.aspects && (
            <div className="space-y-6">
              {/* Deep Dive Card (if available) */}
              {insight?.tabDeepDives?.aspects && (
                <DeepDiveCard
                  title={t("aspects.deepDiveTitle")}
                  subtitle={t("aspects.subtitle")}
                  deepDive={insight.tabDeepDives.aspects}
                />
              )}

              <SolaraCard className="space-y-4">
                <h2 className="text-xl font-semibold">{t("aspects.title")}</h2>
                <p className="text-sm text-accent-ink/60 leading-relaxed">
                  {t("aspects.description")}
                </p>

                {/* Visual Aspect Grid */}
                <div className="py-4">
                  <h3 className="text-sm font-medium text-accent-ink/70 mb-3">{t("aspects.grid")}</h3>
                  <AspectGrid
                    aspects={placements.aspects}
                    className="mb-4"
                  />
                </div>

                {/* Aspect List */}
                <div className="border-t border-accent-soft/30 pt-4">
                  <h3 className="text-sm font-medium text-accent-ink/70 mb-3">
                    {showAllAspects ? t("aspects.allAspects") : t("aspects.topAspects")}
                  </h3>
                  <AspectList
                    aspects={placements.aspects.slice(0, showAllAspects ? undefined : 10)}
                  />
                </div>

                {!showAllAspects && placements.aspects.length > 10 && (
                  <button
                    onClick={() => setShowAllAspects(true)}
                    className="text-sm text-accent underline hover:no-underline"
                  >
                    {t("aspects.showAll", { count: placements.aspects.length })}
                  </button>
                )}
                {showAllAspects && placements.aspects.length > 10 && (
                  <button
                    onClick={() => setShowAllAspects(false)}
                    className="text-sm text-accent underline hover:no-underline"
                  >
                    {t("aspects.showFewer")}
                  </button>
                )}
              </SolaraCard>
            </div>
          )}

          {/* Patterns & Path - Combined scrollable section */}
          {activeSection === "patterns-path" && placements && (
            <div className="space-y-8">
              {/* Patterns */}
              {placements?.calculated?.patterns && (
                <>
                  {insight?.tabDeepDives?.patterns && (
                    <DeepDiveCard
                      title={t("patterns.deepDiveTitle")}
                      subtitle={t("patterns.subtitle")}
                      deepDive={insight.tabDeepDives.patterns}
                    />
                  )}

                  <SolaraCard className="space-y-4">
                    <h2 className="text-xl font-semibold">{t("patterns.title")}</h2>
                    <p className="text-sm text-accent-ink/60 leading-relaxed">
                      {t("patterns.description")}
                    </p>
                    {placements.calculated.patterns.length > 0 ? (
                      <div className="space-y-5">
                        {placements.calculated.patterns.map((pattern: any, idx: number) => (
                          <div key={idx} className="pb-4 border-b border-accent-soft/30 last:border-0">
                            <h3 className="font-medium text-accent-ink mb-2">
                              {pattern.type === "t_square" && t("patterns.tSquare")}
                              {pattern.type === "grand_trine" && t("patterns.grandTrine")}
                            </h3>
                            {pattern.planets && (
                              <p className="text-sm text-accent-ink/70 mb-2">
                                {pattern.planets.join(" • ")}
                              </p>
                            )}
                            <p className="text-sm text-accent-ink/60 leading-relaxed">
                              {pattern.type === "t_square" && t("patterns.tSquareDesc")}
                              {pattern.type === "grand_trine" && t("patterns.grandTrineDesc")}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-accent-ink/60">{t("patterns.noPatterns")}</p>
                    )}
                  </SolaraCard>
                </>
              )}

              {/* Energy Shape */}
              {insight?.tabDeepDives?.energyShape && (
                <DeepDiveCard
                  title="What Your Energy Shape Means For You"
                  subtitle="Element and modality balance"
                  deepDive={insight.tabDeepDives.energyShape}
                />
              )}

              <SolaraCard className="space-y-6">
                <h2 className="text-xl font-semibold">Energy Shape</h2>
                <p className="text-sm text-accent-ink/60 leading-relaxed">
                  This shows how energy moves through you—the underlying rhythm of your chart and where certain qualities concentrate or disperse.
                </p>

                {placements.calculated?.chartType && (
                  <div>
                    <h3 className="text-sm font-medium text-accent-ink/70 mb-2">Chart Type</h3>
                    <p className="text-base text-accent-ink mb-1">
                      {placements.calculated.chartType === "day" ? "Day Chart" : "Night Chart"}
                    </p>
                    <p className="text-sm text-accent-ink/60 leading-relaxed">
                      {placements.calculated.chartType === "day"
                        ? "Your chart is oriented toward visibility and outward expression. Life often asks you to show up, be seen, and engage with the external world."
                        : "Your chart is oriented toward inner reflection and subtlety. Life often unfolds through inner processing, quiet observation, and behind-the-scenes work."}
                    </p>
                  </div>
                )}

                {placements.derived?.chartRuler && (
                  <div>
                    <h3 className="text-sm font-medium text-accent-ink/70 mb-2">Chart Ruler</h3>
                    <p className="text-base text-accent-ink mb-1">{placements.derived.chartRuler}</p>
                    <p className="text-sm text-accent-ink/60 leading-relaxed">
                      This planet guides the overall direction of your life and filters how you engage with the world.
                    </p>
                  </div>
                )}

                {placements.derived?.dominantPlanets && placements.derived.dominantPlanets.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-accent-ink/70 mb-2">Dominant Planets</h3>
                    <ul className="space-y-1 mb-2">
                      {placements.derived.dominantPlanets.slice(0, 3).map((dp: any) => (
                        <li key={dp.planet} className="text-base text-accent-ink">
                          {dp.planet}
                        </li>
                      ))}
                    </ul>
                    <p className="text-sm text-accent-ink/60 leading-relaxed">
                      These planets shape your experience most strongly—they appear in multiple key positions or form important connections.
                    </p>
                  </div>
                )}

                {placements.derived?.dominantSigns && placements.derived.dominantSigns.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-accent-ink/70 mb-2">Dominant Signs</h3>
                    <ul className="space-y-1 mb-2">
                      {placements.derived.dominantSigns.slice(0, 3).map((ds: any) => (
                        <li key={ds.sign} className="text-base text-accent-ink">
                          {ds.sign}
                        </li>
                      ))}
                    </ul>
                    <p className="text-sm text-accent-ink/60 leading-relaxed">
                      These signs color how you move through the world. Their qualities show up repeatedly in how you express yourself.
                    </p>
                  </div>
                )}

                {placements.derived?.elementBalance && placements.derived?.modalityBalance && (
                  <div className="py-4">
                    <BalanceCharts
                      elementBalance={placements.derived.elementBalance}
                      modalityBalance={placements.derived.modalityBalance}
                    />
                    <p className="text-sm text-accent-ink/60 leading-relaxed mt-4">
                      Elements show where your energy naturally gathers—whether in inspiration (fire), grounding (earth), thought (air), or emotion (water).
                      Modalities reflect how you engage—whether you initiate (cardinal), stabilize (fixed), or adapt (mutable).
                    </p>
                  </div>
                )}
              </SolaraCard>

              {/* Intensity Zones */}
              {placements?.calculated?.emphasis && (
                <>
                  {insight?.tabDeepDives?.intensityZones && (
                    <DeepDiveCard
                      title="What Your Intensity Zones Mean For You"
                      subtitle="Where energy clusters in your chart"
                      deepDive={insight.tabDeepDives.intensityZones}
                    />
                  )}

                  <SolaraCard className="space-y-6">
                    <h2 className="text-xl font-semibold">Intensity Zones</h2>
                    <p className="text-sm text-accent-ink/60 leading-relaxed">
                      This shows where life feels concentrated—where multiple planets gather, creating areas of heightened focus and recurring themes.
                    </p>

                    {placements.calculated.emphasis.signEmphasis &&
                      placements.calculated.emphasis.signEmphasis.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-accent-ink/70 mb-2">Sign Emphasis</h3>
                          <ul className="space-y-1 mb-2">
                            {placements.calculated.emphasis.signEmphasis.slice(0, 3).map((se: any) => (
                              <li key={se.sign} className="text-base text-accent-ink">
                                {se.sign} <span className="text-sm text-accent-ink/60">({se.count} planets)</span>
                              </li>
                            ))}
                          </ul>
                          <p className="text-sm text-accent-ink/60 leading-relaxed">
                            Multiple planets in these signs amplify their qualities—you might notice these themes appearing repeatedly in how you think, feel, and respond.
                          </p>
                        </div>
                      )}

                    {placements.calculated.emphasis.houseEmphasis &&
                      placements.calculated.emphasis.houseEmphasis.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-accent-ink/70 mb-2">House Emphasis</h3>
                          <ul className="space-y-1 mb-2">
                            {placements.calculated.emphasis.houseEmphasis.slice(0, 3).map((he: any) => (
                              <li key={he.house} className="text-base text-accent-ink">
                                {he.house}th House{" "}
                                <span className="text-sm text-accent-ink/60">({he.count} planets)</span>
                              </li>
                            ))}
                          </ul>
                          <p className="text-sm text-accent-ink/60 leading-relaxed">
                            These life areas ask a lot of you—they're where complexity, growth, and attention naturally gather.
                          </p>
                        </div>
                      )}

                    {placements.calculated.emphasis.stelliums &&
                      placements.calculated.emphasis.stelliums.length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-accent-ink/70 mb-2">Stelliums</h3>
                          <div className="space-y-4">
                            {placements.calculated.emphasis.stelliums.map((stellium: any, idx: number) => (
                              <div key={idx} className="pb-3 border-b border-accent-soft/30 last:border-0">
                                <p className="font-medium text-accent-ink mb-1">
                                  {stellium.type === "sign" && stellium.name}
                                  {stellium.type === "house" && `${stellium.name}th House`}
                                </p>
                                <p className="text-sm text-accent-ink/70 mb-2">
                                  {stellium.planets?.join(", ") || "—"}
                                </p>
                                <p className="text-sm text-accent-ink/60 leading-relaxed">
                                  A stellium here creates a concentrated beam of attention—multiple inner parts converging on one theme. This area tends to feel vivid, complex, and central to your experience.
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </SolaraCard>
                </>
              )}

              {/* Direction */}
              {(() => {
                const northNode = placements.planets?.find((p: any) => p.name === "North Node");
                const chiron = placements.planets?.find((p: any) => p.name === "Chiron");
                return (
                  <>
                    {insight?.tabDeepDives?.direction && (
                      <DeepDiveCard
                        title="What Your Direction Means For You"
                        subtitle="North Node, South Node, and life path"
                        deepDive={insight.tabDeepDives.direction}
                      />
                    )}

                    <SolaraCard className="space-y-6">
                      <h2 className="text-xl font-semibold">Direction</h2>
                      <p className="text-sm text-accent-ink/60 leading-relaxed">
                        This reflects growth, healing, and familiarity—where you're invited to stretch, where you naturally return, and where old wounds become sources of wisdom.
                      </p>

                      {northNode && (
                        <div>
                          <h3 className="font-medium text-accent-ink mb-2">North Node</h3>
                          <p className="text-sm text-accent-ink/70 mb-2">
                            {northNode.sign}
                            {northNode.house && ` — ${northNode.house}th house`}
                          </p>
                          <p className="text-sm text-accent-ink/60 leading-relaxed">
                            Your North Node is an invitation toward growth and unfamiliar territory. It points to qualities you're developing, even when they don't feel natural yet. This is where life asks you to stretch—not because you lack something, but because expansion lives here.
                          </p>
                        </div>
                      )}

                      {placements.calculated?.southNode && (
                        <div>
                          <h3 className="font-medium text-accent-ink mb-2">South Node</h3>
                          <p className="text-sm text-accent-ink/70 mb-2">
                            {placements.calculated.southNode.sign}
                            {placements.calculated.southNode.house &&
                              ` — ${placements.calculated.southNode.house}th house`}
                          </p>
                          <p className="text-sm text-accent-ink/60 leading-relaxed">
                            Your South Node represents familiar patterns and natural comfort. These are qualities you carry easily, perhaps from early life or past experience. The South Node isn't something to abandon, but rather a foundation to honor while you reach toward the North Node's invitation.
                          </p>
                        </div>
                      )}

                      {chiron && (
                        <div>
                          <h3 className="font-medium text-accent-ink mb-2">Chiron</h3>
                          <p className="text-sm text-accent-ink/70 mb-2">
                            {chiron.sign}
                            {chiron.house && ` — ${chiron.house}th house`}
                          </p>
                          <p className="text-sm text-accent-ink/60 leading-relaxed">
                            Chiron shows where healing and teaching emerge from your deepest wounds. What once hurt can become a source of compassion and guidance for others. Chiron doesn't promise that the wound disappears, but that it becomes medicine.
                          </p>
                        </div>
                      )}
                    </SolaraCard>
                  </>
                );
              })()}

              {/* Joy */}
              {placements?.calculated?.partOfFortune && (
                <>
                  {insight?.tabDeepDives?.joy && (
                    <DeepDiveCard
                      title="What Your Joy Means For You"
                      subtitle={`Part of Fortune in ${placements.calculated.partOfFortune.sign}${
                        placements.calculated.partOfFortune.house
                          ? ` — ${placements.calculated.partOfFortune.house}th house`
                          : ""
                      }`}
                      deepDive={insight.tabDeepDives.joy}
                    />
                  )}

                  <SolaraCard className="space-y-4">
                    <h2 className="text-xl font-semibold">Part of Fortune</h2>
                    <p className="text-sm text-accent-ink/60 leading-relaxed">
                      This reflects ease, joy, and natural alignment—where life feels generous and where you access flow without force.
                    </p>
                    <p className="text-base text-accent-ink mb-3">
                      {placements.calculated.partOfFortune.sign}
                      {placements.calculated.partOfFortune.house &&
                        ` — ${placements.calculated.partOfFortune.house}th house`}
                    </p>
                    <p className="text-sm text-accent-ink/60 leading-relaxed">
                      The Part of Fortune shows where natural joy and ease flow most readily in your life. This isn't about achievement or effort—it's where things align organically, where you feel instinctively at home.
                    </p>
                  </SolaraCard>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
