"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SanctuaryTabs } from "@/components/sanctuary/SanctuaryTabs";
import { SolaraLogo } from "@/components/layout/SolaraLogo";
import { PlacePicker, type PlaceSelection } from "@/components/shared/PlacePicker";
import { useSettings } from "@/providers/SettingsProvider";
import { SolaraCard } from "@/components/ui/solara-card";
import { AspectGrid, AspectList } from "@/components/charts/AspectGrid";
import { BalanceCharts } from "@/components/charts/BalanceCharts";
import { useTranslations } from "next-intl";
import type { FullBirthChartInsight, TabDeepDive } from "@/types/natalAI";
import type { NumerologySystem, CycleNumbers } from "@/types/numerology";

// ============================================================================
// TYPES
// ============================================================================

type LibraryTab = "astrology" | "numerology" | "recent";

type ShelfEntry = {
  book_key: string;
  book_type?: string;
  label: string | null;
  last_opened_at: string;
  created_at: string;
};

type AstrologyBookResponse = {
  placements: any;
  insight: FullBirthChartInsight | null;
  chart_key: string;
  is_official: boolean;
  mode: string;
};

type NumerologyNarrativeSection = { heading: string; body: string };
type NumerologyNarrative = { sections: NumerologyNarrativeSection[] };
type NumerologyNumber = { value: number; master?: number };
type CoreNumbers = {
  lifePath: NumerologyNumber;
  birthday: NumerologyNumber;
  expression: NumerologyNumber;
  soulUrge: NumerologyNumber;
  personality: NumerologyNumber;
  maturity: NumerologyNumber;
};
type Pinnacles = {
  first: { number: number; startAge: number; endAge: number };
  second: { number: number; startAge: number; endAge: number };
  third: { number: number; startAge: number; endAge: number };
  fourth: { number: number; startAge: number; endAge: null };
};
type NumerologyComputeResult = {
  coreNumbers: CoreNumbers;
  pinnacles: Pinnacles;
  challenges: { first: number; second: number; third: number; fourth: number };
  luckyNumbers: { primary: number; secondary: number[]; all: number[] };
  karmicDebt: { hasKarmicDebt: boolean; numbers: number[]; sources?: { number: number; source: string }[] };
};

type NumerologyBookResponse = {
  numerology: NumerologyComputeResult;
  narrative: NumerologyNarrative | null;
  cycles: CycleNumbers;
  numerology_key: string;
  input: { first_name: string; middle_name?: string; last_name: string; birth_date: string };
  is_official: boolean;
  mode: string;
  system: string;
};

type RecentEntry = ShelfEntry & { book_type: string };

type SoulPathSection = "narrative" | "foundations" | "connections" | "patterns-path";

// ============================================================================
// CONSTANTS
// ============================================================================

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

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function LibraryPage() {
  const [activeTab, setActiveTab] = useState<LibraryTab>("astrology");

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      <div className="flex justify-center items-center pt-4 pb-8">
        <SolaraLogo />
      </div>

      <div className="flex justify-center">
        <SanctuaryTabs />
      </div>

      {/* Library sub-tabs */}
      <div className="flex justify-center">
        <div className="inline-flex gap-1 p-1 bg-white/50 rounded-full">
          {(["astrology", "numerology", "recent"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-accent-ink text-white"
                  : "text-accent-ink hover:bg-white/80"
              }`}
            >
              {tab === "recent" ? "Recent Books" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "astrology" && <AstrologyTab />}
      {activeTab === "numerology" && <NumerologyTab />}
      {activeTab === "recent" && <RecentBooksTab />}
    </div>
  );
}

// ============================================================================
// ASTROLOGY TAB — Full chart with shelf counter
// ============================================================================

function AstrologyTab() {
  const { profile } = useSettings();
  const t = useTranslations("astrology");
  const tCommon = useTranslations("common");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [book, setBook] = useState<AstrologyBookResponse | null>(null);
  const [missingBirthTime, setMissingBirthTime] = useState(false);
  const [activeSection, setActiveSection] = useState<SoulPathSection>("narrative");
  const [showAllAspects, setShowAllAspects] = useState(false);

  // Shelf state
  const [shelf, setShelf] = useState<ShelfEntry[]>([]);
  const [officialKey, setOfficialKey] = useState<string | null>(null);
  const [currentBookKey, setCurrentBookKey] = useState<string | null>(null);

  // Checkout form
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutDate, setCheckoutDate] = useState("");
  const [checkoutTime, setCheckoutTime] = useState("");
  const [checkoutPlace, setCheckoutPlace] = useState<PlaceSelection | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const checkoutPrefillDoneRef = useRef(false);

  const refreshShelf = useCallback(async () => {
    try {
      const res = await fetch("/api/birth-chart-library");
      if (res.ok) {
        const data = await res.json();
        setShelf(data.shelf || []);
        setOfficialKey(data.official_key || null);
      }
    } catch {
      // non-critical
    }
  }, []);

  const loadOfficial = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMissingBirthTime(false);

    try {
      const res = await fetch("/api/birth-chart-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "official" }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data?.errorCode === "INCOMPLETE_BIRTH_DATA") {
          setMissingBirthTime(true);
          setLoading(false);
          return;
        }
        setError(data.message || "Failed to load official chart.");
        setLoading(false);
        return;
      }

      setBook(data);
      if (data.chart_key) setCurrentBookKey(data.chart_key);
      void refreshShelf();
    } catch {
      setError("Failed to load astrology chart. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [refreshShelf]);

  const loadBookByKey = useCallback(async (bookKey: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/birth-chart-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "load", chart_key: bookKey }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Failed to load book.");
        setLoading(false);
        return;
      }

      const chartData: AstrologyBookResponse = await res.json();
      setBook(chartData);
      if (chartData.chart_key) setCurrentBookKey(chartData.chart_key);
      void refreshShelf();
    } catch {
      setError("Failed to load book.");
    } finally {
      setLoading(false);
    }
  }, [refreshShelf]);

  const handleReturnToOfficial = useCallback(() => {
    setShowCheckout(false);
    checkoutPrefillDoneRef.current = false;
    loadOfficial();
  }, [loadOfficial]);

  useEffect(() => {
    loadOfficial();
    void refreshShelf();
  }, [loadOfficial, refreshShelf]);

  // Prefill checkout fields from Settings on first panel open
  useEffect(() => {
    if (!showCheckout || checkoutPrefillDoneRef.current || !profile) return;
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
  }, [showCheckout, profile, checkoutDate, checkoutTime, checkoutPlace]);

  async function handleCheckout() {
    if (!checkoutDate || !checkoutTime || !checkoutPlace) return;
    setCheckoutLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/birth-chart-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "checkout",
          inputs: {
            birth_date: checkoutDate,
            birth_time: checkoutTime,
            birth_lat: checkoutPlace.birth_lat,
            birth_lon: checkoutPlace.birth_lon,
            timezone: checkoutPlace.timezone,
          },
          birth_city: checkoutPlace.birth_city || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to generate chart.");
        return;
      }

      setBook(data);
      if (data.chart_key) setCurrentBookKey(data.chart_key);
      setShowCheckout(false);
      setCheckoutDate("");
      setCheckoutTime("");
      setCheckoutPlace(null);
      checkoutPrefillDoneRef.current = false;
      void refreshShelf();
    } catch {
      setError("Failed to generate chart. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  // Derived
  const insight = book?.insight ?? null;
  const placements = book?.placements ?? null;
  const isViewingOfficial = currentBookKey === officialKey;
  const shelfIndex = shelf.findIndex((s) => s.book_key === currentBookKey);

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

  const SECTIONS: { id: SoulPathSection; label: string }[] = [
    { id: "narrative", label: t("sections.narrative") },
    { id: "foundations", label: t("sections.foundations") },
    { id: "connections", label: t("sections.connections") },
    { id: "patterns-path", label: t("sections.patternsPath") },
  ];

  if (loading) {
    return <LoadingSpinner message={t("calculating")} />;
  }

  if (missingBirthTime) {
    return (
      <div className="space-y-6">
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-12 text-center space-y-4">
            <h2 className="text-xl font-semibold text-accent-ink">Birth Time Required</h2>
            <p className="text-accent-ink/70 max-w-md mx-auto">
              Your official astrology book requires an accurate birth time. Please add your birth time in Settings, or use the checkout form below to generate a chart with manual inputs.
            </p>
            <Button variant="gold" asChild>
              <a href="/settings">{tCommon("goToSettings")}</a>
            </Button>
          </CardContent>
        </Card>
        <CheckoutButton show={showCheckout} onToggle={() => setShowCheckout(!showCheckout)} />
        {showCheckout && (
          <AstrologyCheckoutForm
            date={checkoutDate}
            time={checkoutTime}
            place={checkoutPlace}
            loading={checkoutLoading}
            onDateChange={setCheckoutDate}
            onTimeChange={setCheckoutTime}
            onPlaceChange={setCheckoutPlace}
            onSubmit={handleCheckout}
          />
        )}
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="space-y-4">
        <Card className="border-danger-soft/20">
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-accent-ink/70">{error || "Failed to load astrology chart."}</p>
            <Button variant="outline" onClick={() => loadOfficial()}>
              {tCommon("tryAgain")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Shelf counter + switcher */}
      {shelf.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium text-accent-ink/50 uppercase tracking-wide">
            Book {shelfIndex >= 0 ? shelfIndex + 1 : 1} of {shelf.length}
          </span>
          <select
            value={currentBookKey || ""}
            onChange={(e) => {
              const key = e.target.value;
              if (!key) return;
              if (key === officialKey) {
                handleReturnToOfficial();
              } else {
                loadBookByKey(key);
              }
            }}
            className="rounded-lg border border-accent-soft px-3 py-1.5 text-sm bg-white text-accent-ink/80 min-w-[180px]"
          >
            {shelf.map((entry) => (
              <option key={entry.book_key} value={entry.book_key}>
                {entry.book_key === officialKey ? "Official" : entry.label || "Checkout"}
              </option>
            ))}
          </select>
          {!isViewingOfficial && (
            <Button variant="outline" size="sm" onClick={handleReturnToOfficial}>
              Return to Official
            </Button>
          )}
        </div>
      )}

      {/* Checkout form toggle */}
      <CheckoutButton show={showCheckout} onToggle={() => setShowCheckout(!showCheckout)} />
      {showCheckout && (
        <AstrologyCheckoutForm
          date={checkoutDate}
          time={checkoutTime}
          place={checkoutPlace}
          loading={checkoutLoading}
          onDateChange={setCheckoutDate}
          onTimeChange={setCheckoutTime}
          onPlaceChange={setCheckoutPlace}
          onSubmit={handleCheckout}
        />
      )}

      {/* Section toggle pills */}
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

        {/* Desktop: Horizontal pills */}
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

      {/* Section content */}
      <div className="max-w-3xl mx-auto">
        {/* Personal Narrative */}
        {activeSection === "narrative" && hasFullInsight && (
          <div className="space-y-6">
            <SolaraCard className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">{t("narrative.title")}</h2>
                <p className="text-sm text-accent-ink/60">{t("narrative.subtitle")}</p>
              </div>

              <h3 className="text-xl md:text-2xl font-semibold leading-snug text-accent-ink">
                {insight!.coreSummary.headline}
              </h3>

              <div className="text-base text-accent-ink/80 leading-relaxed space-y-4">
                {insight!.coreSummary.overallVibe.split("\n\n").map((para, idx) => (
                  <p key={idx}>{para}</p>
                ))}
              </div>

              <div className="space-y-6 pt-4 border-t border-accent-soft/30">
                {([
                  ["identity", t("narrative.identity")],
                  ["emotions", t("narrative.emotions")],
                  ["loveAndRelationships", t("narrative.loveRelationships")],
                  ["workAndMoney", t("narrative.workMoney")],
                  ["purposeAndGrowth", t("narrative.purposeGrowth")],
                  ["innerWorld", t("narrative.innerWorld")],
                ] as [keyof typeof insight.sections, string][]).map(([key, label]) => (
                  <div key={key} className="space-y-3">
                    <h4 className="text-sm font-medium text-accent-ink/70">{label}</h4>
                    <div className="text-base text-accent-ink/80 leading-relaxed space-y-4">
                      {(insight!.sections[key] as string).split("\n\n").map((para, idx) => (
                        <p key={idx}>{para}</p>
                      ))}
                    </div>
                  </div>
                ))}
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
            {insight?.tabDeepDives?.planetaryPlacements && (
              <DeepDiveCard
                title={t("planets.deepDiveTitle")}
                subtitle={t("planets.subtitle")}
                deepDive={insight.tabDeepDives.planetaryPlacements}
              />
            )}

            <SolaraCard className="space-y-4">
              <h2 className="text-xl font-semibold">{t("planets.title")}</h2>
              <p className="text-sm text-accent-ink/60 leading-relaxed">{t("planets.description")}</p>
              <div className="space-y-4">
                {placements.planets?.map((p: any) => (
                  <div key={p.name} className="pb-3 border-b border-accent-soft/30 last:border-0">
                    <div className="flex items-baseline justify-between gap-4 mb-1">
                      <span className="font-medium text-accent-ink">
                        {p.name}
                        {p.retrograde === true && " \u211E"}
                      </span>
                      <span className="text-sm text-accent-ink/70">
                        {p.sign}
                        {p.house && <> &mdash; {p.house}th house</>}
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

            {insight?.tabDeepDives?.houses && (
              <DeepDiveCard
                title={t("houses.deepDiveTitle")}
                subtitle={t("houses.subtitle")}
                deepDive={insight.tabDeepDives.houses}
              />
            )}

            <SolaraCard className="space-y-4">
              <h2 className="text-xl font-semibold">{t("houses.title")}</h2>
              <p className="text-sm text-accent-ink/60 leading-relaxed">{t("houses.description")}</p>
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
            {insight?.tabDeepDives?.aspects && (
              <DeepDiveCard
                title={t("aspects.deepDiveTitle")}
                subtitle={t("aspects.subtitle")}
                deepDive={insight.tabDeepDives.aspects}
              />
            )}

            <SolaraCard className="space-y-4">
              <h2 className="text-xl font-semibold">{t("aspects.title")}</h2>
              <p className="text-sm text-accent-ink/60 leading-relaxed">{t("aspects.description")}</p>

              <div className="py-4">
                <h3 className="text-sm font-medium text-accent-ink/70 mb-3">{t("aspects.grid")}</h3>
                <AspectGrid aspects={placements.aspects} className="mb-4" />
              </div>

              <div className="border-t border-accent-soft/30 pt-4">
                <h3 className="text-sm font-medium text-accent-ink/70 mb-3">
                  {showAllAspects ? t("aspects.allAspects") : t("aspects.topAspects")}
                </h3>
                <AspectList aspects={placements.aspects.slice(0, showAllAspects ? undefined : 10)} />
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

        {/* Patterns & Path */}
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
                  <p className="text-sm text-accent-ink/60 leading-relaxed">{t("patterns.description")}</p>
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
                              {pattern.planets.join(" \u2022 ")}
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
                      <li key={dp.planet} className="text-base text-accent-ink">{dp.planet}</li>
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
                      <li key={ds.sign} className="text-base text-accent-ink">{ds.sign}</li>
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
                                {stellium.planets?.join(", ") || "\u2014"}
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
                          {northNode.house && ` \u2014 ${northNode.house}th house`}
                        </p>
                        <p className="text-sm text-accent-ink/60 leading-relaxed">
                          Your North Node is an invitation toward growth and unfamiliar territory. It points to qualities you're developing, even when they don't feel natural yet.
                        </p>
                      </div>
                    )}

                    {placements.calculated?.southNode && (
                      <div>
                        <h3 className="font-medium text-accent-ink mb-2">South Node</h3>
                        <p className="text-sm text-accent-ink/70 mb-2">
                          {placements.calculated.southNode.sign}
                          {placements.calculated.southNode.house &&
                            ` \u2014 ${placements.calculated.southNode.house}th house`}
                        </p>
                        <p className="text-sm text-accent-ink/60 leading-relaxed">
                          Your South Node represents familiar patterns and natural comfort. These are qualities you carry easily. The South Node isn't something to abandon, but rather a foundation to honor while you reach toward the North Node's invitation.
                        </p>
                      </div>
                    )}

                    {chiron && (
                      <div>
                        <h3 className="font-medium text-accent-ink mb-2">Chiron</h3>
                        <p className="text-sm text-accent-ink/70 mb-2">
                          {chiron.sign}
                          {chiron.house && ` \u2014 ${chiron.house}th house`}
                        </p>
                        <p className="text-sm text-accent-ink/60 leading-relaxed">
                          Chiron shows where healing and teaching emerge from your deepest wounds. What once hurt can become a source of compassion and guidance for others.
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
                        ? ` \u2014 ${placements.calculated.partOfFortune.house}th house`
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
                      ` \u2014 ${placements.calculated.partOfFortune.house}th house`}
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
    </div>
  );
}

// ============================================================================
// NUMEROLOGY TAB — Full view with shelf counter
// ============================================================================

function NumerologyTab() {
  const t = useTranslations("numerology");
  const tCommon = useTranslations("common");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [book, setBook] = useState<NumerologyBookResponse | null>(null);
  const [system, setSystem] = useState<NumerologySystem>("pythagorean");
  const [appendixOpen, setAppendixOpen] = useState(false);

  // Shelf state
  const [shelf, setShelf] = useState<ShelfEntry[]>([]);
  const [officialKey, setOfficialKey] = useState<string | null>(null);
  const [currentBookKey, setCurrentBookKey] = useState<string | null>(null);

  // Checkout form
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutName, setCheckoutName] = useState("");
  const [checkoutDate, setCheckoutDate] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const refreshShelf = useCallback(async () => {
    try {
      const res = await fetch("/api/numerology-library");
      if (res.ok) {
        const data = await res.json();
        setShelf(data.shelf || []);
        setOfficialKey(data.official_key || null);
      }
    } catch {
      // non-critical
    }
  }, []);

  const loadBookByKey = useCallback(
    async (bookKey: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/numerology-library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "load", book_key: bookKey, system }),
        });
        const result = await res.json();
        if (!res.ok) {
          setError(result.message || "Failed to load book");
          return;
        }
        setBook(result);
        setCurrentBookKey(result.numerology_key);
        await refreshShelf();
      } catch {
        setError("Failed to load book. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [system, refreshShelf]
  );

  const loadOfficial = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/numerology-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "official", system }),
      });
      const result = await res.json();

      if (!res.ok) {
        const code = result?.errorCode || result?.code;
        if (code === "MISSING_NAME" || code === "MISSING_BIRTH_NAME") {
          setError("birth_name_required");
        } else if (code === "MISSING_BIRTH_DATE") {
          setError("birth_date_required");
        } else {
          setError(result.message || "Failed to load numerology profile");
        }
        return;
      }

      setBook(result);
      setCurrentBookKey(result.numerology_key);
      await refreshShelf();
    } catch {
      setError("Failed to load numerology profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [system, refreshShelf]);

  const handleReturnToOfficial = useCallback(() => {
    setShowCheckout(false);
    loadOfficial();
  }, [loadOfficial]);

  useEffect(() => {
    loadOfficial();
  }, [loadOfficial]);

  async function handleCheckout() {
    if (!checkoutName.trim() || !checkoutDate) return;
    setCheckoutLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/numerology-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "checkout",
          system,
          input: { full_name: checkoutName.trim(), birth_date: checkoutDate },
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        setError(result.message || "Failed to generate numerology");
        return;
      }

      setBook(result);
      setCurrentBookKey(result.numerology_key);
      setShowCheckout(false);
      setCheckoutName("");
      setCheckoutDate("");
      await refreshShelf();
    } catch {
      setError("Failed to generate numerology. Please try again.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  // Derived
  const isViewingOfficial = currentBookKey === officialKey;
  const shelfIndex = shelf.findIndex((s) => s.book_key === currentBookKey);

  if (loading) {
    return <LoadingSpinner message={t("calculating")} />;
  }

  // Error states
  if (error === "birth_name_required") {
    return (
      <div className="space-y-6">
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-12 text-center space-y-4">
            <h2 className="text-xl font-semibold text-accent-ink">{t("errors.nameRequired")}</h2>
            <p className="text-accent-ink/70 max-w-md mx-auto">{t("errors.nameRequiredMessage")}</p>
            <Button variant="gold" asChild>
              <a href="/settings">{tCommon("goToSettings")}</a>
            </Button>
          </CardContent>
        </Card>
        <CheckoutButton show={showCheckout} onToggle={() => setShowCheckout(!showCheckout)} label="Checkout a Numerology Book" />
        {showCheckout && (
          <NumerologyCheckoutForm
            name={checkoutName}
            date={checkoutDate}
            loading={checkoutLoading}
            onNameChange={setCheckoutName}
            onDateChange={setCheckoutDate}
            onSubmit={handleCheckout}
          />
        )}
      </div>
    );
  }

  if (error === "birth_date_required") {
    return (
      <div className="space-y-6">
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-12 text-center space-y-4">
            <h2 className="text-xl font-semibold text-accent-ink">{t("errors.birthDateRequired")}</h2>
            <p className="text-accent-ink/70 max-w-md mx-auto">{t("errors.birthDateRequiredMessage")}</p>
            <Button variant="gold" asChild>
              <a href="/settings">{tCommon("goToSettings")}</a>
            </Button>
          </CardContent>
        </Card>
        <CheckoutButton show={showCheckout} onToggle={() => setShowCheckout(!showCheckout)} label="Checkout a Numerology Book" />
        {showCheckout && (
          <NumerologyCheckoutForm
            name={checkoutName}
            date={checkoutDate}
            loading={checkoutLoading}
            onNameChange={setCheckoutName}
            onDateChange={setCheckoutDate}
            onSubmit={handleCheckout}
          />
        )}
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="space-y-4">
        <Card className="border-danger-soft/20">
          <CardContent className="py-12 text-center space-y-4">
            <p className="text-accent-ink/70">{error || t("errors.loadFailed")}</p>
            <Button variant="outline" onClick={() => loadOfficial()}>
              {tCommon("tryAgain")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { numerology, narrative, cycles } = book;
  const { coreNumbers, pinnacles, challenges, luckyNumbers, karmicDebt } = numerology;

  const birthYear = parseInt(book.input.birth_date.split("-")[0]);
  const currentYear = new Date().getFullYear();
  const currentAge = currentYear - birthYear;

  const getCurrentPinnacle = () => {
    if (currentAge < pinnacles.first.endAge) return { ...pinnacles.first, period: "First" };
    if (currentAge < pinnacles.second.endAge) return { ...pinnacles.second, period: "Second" };
    if (currentAge < pinnacles.third.endAge) return { ...pinnacles.third, period: "Third" };
    return { ...pinnacles.fourth, period: "Fourth" };
  };
  const currentPinnacle = getCurrentPinnacle();

  return (
    <div className="space-y-6">
      {/* Shelf counter + switcher */}
      {shelf.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/60 rounded-xl p-4 border border-border-subtle">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-accent-ink/70">
              Book {shelfIndex >= 0 ? shelfIndex + 1 : 1} of {shelf.length}
            </span>
            {shelf.length > 1 && (
              <select
                className="text-sm border border-border-subtle rounded-lg px-3 py-1.5 bg-white text-accent-ink"
                value={currentBookKey || ""}
                onChange={(e) => {
                  if (e.target.value && e.target.value !== currentBookKey) {
                    if (e.target.value === officialKey) {
                      handleReturnToOfficial();
                    } else {
                      loadBookByKey(e.target.value);
                    }
                  }
                }}
              >
                {shelf.map((entry) => (
                  <option key={entry.book_key} value={entry.book_key}>
                    {entry.label || "Book"}{entry.book_key === officialKey ? " (Official)" : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isViewingOfficial && officialKey && (
              <Button variant="outline" size="sm" onClick={handleReturnToOfficial}>
                Return to Official
              </Button>
            )}
          </div>
        </div>
      )}

      {/* System toggle */}
      <div className="flex justify-center">
        <div className="flex gap-2 p-1 bg-white/50 rounded-full">
          {(["pythagorean", "chaldean"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSystem(s)}
              className={`px-4 py-2 rounded-full font-cursive text-xl font-normal transition-all ${
                system === s ? "bg-accent-ink text-white" : "text-accent-ink hover:bg-white/80"
              }`}
            >
              {t(`systems.${s}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Checkout form toggle */}
      <CheckoutButton show={showCheckout} onToggle={() => setShowCheckout(!showCheckout)} label="Checkout a Numerology Book" />
      {showCheckout && (
        <NumerologyCheckoutForm
          name={checkoutName}
          date={checkoutDate}
          loading={checkoutLoading}
          onNameChange={setCheckoutName}
          onDateChange={setCheckoutDate}
          onSubmit={handleCheckout}
        />
      )}

      {/* Narrative (MAIN content at top) */}
      {narrative && narrative.sections && narrative.sections.length > 0 && (
        <section className="space-y-6">
          {narrative.sections.map((section, i) => (
            <div key={i} className="space-y-3">
              <h2 className="text-lg font-semibold text-accent-gold">{section.heading}</h2>
              <div className="prose prose-sm max-w-none text-accent-ink/85 leading-relaxed">
                {section.body.split("\n\n").map((paragraph, j) => (
                  <p key={j} className="mb-4 last:mb-0">{paragraph}</p>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {!narrative && (
        <Card className="bg-white/50">
          <CardContent className="py-8 text-center">
            <p className="text-accent-ink/60">
              Narrative is being generated. This may take a moment on first load.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Personal Cycles */}
      {cycles && (
        <section>
          <h2 className="text-lg font-semibold text-accent-gold mb-4">{t("cycles.title")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-white border-border-subtle">
              <CardContent className="p-5">
                <p className="text-xs text-accent-ink/60 uppercase tracking-wide mb-1">
                  {t("cycles.personalYear")}
                </p>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-3xl font-bold text-accent-gold">{cycles.personalYear}</p>
                  <span className="text-sm font-medium text-accent-ink/70">
                    {t(`numbers.${cycles.personalYear}.keyword`)}
                  </span>
                </div>
                <p className="text-sm text-accent-ink/80 leading-relaxed">
                  {t(`numbers.${cycles.personalYear}.yearGuidance`)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border-border-subtle">
              <CardContent className="p-5">
                <p className="text-xs text-accent-ink/60 uppercase tracking-wide mb-1">
                  {t("cycles.personalMonth")}
                </p>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-3xl font-bold text-accent-gold">{cycles.personalMonth}</p>
                  <span className="text-sm font-medium text-accent-ink/70">
                    {t(`numbers.${cycles.personalMonth}.keyword`)}
                  </span>
                </div>
                <p className="text-sm text-accent-ink/80 leading-relaxed">
                  {t(`numbers.${cycles.personalMonth}.monthGuidance`)}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white border-border-subtle">
              <CardContent className="p-5">
                <p className="text-xs text-accent-ink/60 uppercase tracking-wide mb-1">
                  {t("cycles.personalDay")}
                </p>
                <div className="flex items-baseline gap-2 mb-2">
                  <p className="text-3xl font-bold text-accent-gold">{cycles.personalDay}</p>
                  <span className="text-sm font-medium text-accent-ink/70">
                    {t(`numbers.${cycles.personalDay}.keyword`)}
                  </span>
                </div>
                <p className="text-sm text-accent-ink/80 leading-relaxed">
                  {t(`numbers.${cycles.personalDay}.dayGuidance`)}
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      {/* Appendix (Numbers — collapsible) */}
      <section>
        <button
          onClick={() => setAppendixOpen(!appendixOpen)}
          className="flex items-center gap-2 text-lg font-semibold text-accent-gold mb-4 hover:opacity-80 transition-opacity"
        >
          <span className={`transition-transform ${appendixOpen ? "rotate-90" : ""}`}>&#9654;</span>
          Numbers &amp; Meanings
        </button>

        {appendixOpen && (
          <div className="space-y-8">
            {/* Core Numbers */}
            <div>
              <h3 className="text-base font-semibold text-accent-ink/80 mb-3">{t("coreNumbers.title")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {([
                  ["lifePath", t("coreNumbers.lifePath"), t("coreNumbers.lifePathDesc")],
                  ["expression", t("coreNumbers.expression"), t("coreNumbers.expressionDesc")],
                  ["soulUrge", t("coreNumbers.soulUrge"), t("coreNumbers.soulUrgeDesc")],
                  ["personality", t("coreNumbers.personality"), t("coreNumbers.personalityDesc")],
                  ["birthday", t("coreNumbers.birthday"), t("coreNumbers.birthdayDesc")],
                  ["maturity", t("coreNumbers.maturity"), t("coreNumbers.maturityDesc")],
                ] as [keyof CoreNumbers, string, string][]).map(([key, label, desc]) => {
                  const num = coreNumbers[key];
                  const displayNumber = num.master || num.value;
                  return (
                    <Card key={key} className="bg-white border-border-subtle hover:shadow-md transition-shadow">
                      <CardContent className="p-5">
                        <p className="text-xs text-accent-ink/60 uppercase tracking-wide mb-1">{label}</p>
                        <div className="flex items-baseline gap-2 mb-1">
                          <p className="text-3xl font-bold text-accent-gold">{num.value}</p>
                          {num.master && (
                            <span className="text-sm text-accent-gold/60">({num.master})</span>
                          )}
                          <span className="text-sm font-medium text-accent-ink/70">
                            {t(`numbers.${displayNumber}.keyword`)}
                          </span>
                        </div>
                        <p className="text-xs text-accent-ink/50 mb-3">{desc}</p>
                        <p className="text-sm text-accent-ink/80 leading-relaxed">
                          {t(`numbers.${displayNumber}.description`)}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Current Pinnacle */}
            <div>
              <h3 className="text-base font-semibold text-accent-ink/80 mb-3">{t("lifePeriods.title")}</h3>
              <Card className="bg-gradient-to-br from-accent-gold/5 to-transparent border-accent-gold/20">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-sm text-accent-ink/60">{t("lifePeriods.currentPinnacle")}</p>
                      <div className="flex items-baseline gap-2">
                        <p className="text-4xl font-bold text-accent-gold">{currentPinnacle.number}</p>
                        <span className="text-sm font-medium text-accent-ink/70">
                          {t(`numbers.${currentPinnacle.number}.keyword`)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-accent-ink/60">{currentPinnacle.period} {t("lifePeriods.period")}</p>
                      <p className="text-sm text-accent-ink/70">
                        {t("lifePeriods.ages")} {currentPinnacle.startAge || 0} - {currentPinnacle.endAge || t("lifePeriods.onwards")}
                      </p>
                    </div>
                  </div>
                  <p className="text-accent-ink/80">{t(`numbers.${currentPinnacle.number}.description`)}</p>
                </CardContent>
              </Card>

              {/* All Pinnacles Timeline */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                {[pinnacles.first, pinnacles.second, pinnacles.third, pinnacles.fourth].map(
                  (p, i) => {
                    const isActive =
                      (i === 0 && currentAge < pinnacles.first.endAge) ||
                      (i === 1 && currentAge >= pinnacles.first.endAge && currentAge < pinnacles.second.endAge) ||
                      (i === 2 && currentAge >= pinnacles.second.endAge && currentAge < pinnacles.third.endAge) ||
                      (i === 3 && currentAge >= pinnacles.third.endAge);

                    return (
                      <div
                        key={i}
                        className={`p-4 rounded-lg ${
                          isActive
                            ? "bg-accent-gold/20 border border-accent-gold/40"
                            : "bg-white border border-border-subtle"
                        }`}
                      >
                        <p className="text-xs text-accent-ink/60 mb-1">
                          {t(`lifePeriods.pinnacles.${["first", "second", "third", "fourth"][i]}`)}
                        </p>
                        <div className="flex items-baseline gap-2 mb-1">
                          <p className={`text-2xl font-bold ${isActive ? "text-accent-gold" : "text-accent-ink"}`}>
                            {p.number}
                          </p>
                          <span className="text-xs font-medium text-accent-ink/60">
                            {t(`numbers.${p.number}.keyword`)}
                          </span>
                        </div>
                        <p className="text-xs text-accent-ink/50 mb-2">
                          {t("lifePeriods.ages")} {p.startAge || 0} - {p.endAge || t("lifePeriods.onwards")}
                        </p>
                        <p className="text-xs text-accent-ink/70 line-clamp-2">
                          {t(`numbers.${p.number}.brief`)}
                        </p>
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {/* Challenges */}
            <div>
              <h3 className="text-base font-semibold text-accent-ink/80 mb-3">{t("challenges.title")}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[challenges.first, challenges.second, challenges.third, challenges.fourth].map(
                  (c, i) => (
                    <Card key={i} className="bg-white border-border-subtle">
                      <CardContent className="p-4">
                        <p className="text-xs text-accent-ink/60 mb-1">
                          {t(`challenges.${["first", "second", "third", "main"][i]}`)}
                        </p>
                        <div className="flex items-baseline gap-2 mb-2">
                          <p className="text-2xl font-bold text-accent-ink">{c}</p>
                          <span className="text-xs font-medium text-accent-ink/60">
                            {t(`numbers.${c}.keyword`)}
                          </span>
                        </div>
                        <p className="text-xs text-accent-ink/70 line-clamp-2">
                          {t(`challengeMeanings.${c}`)}
                        </p>
                      </CardContent>
                    </Card>
                  )
                )}
              </div>
            </div>

            {/* Lucky Numbers */}
            <div>
              <h3 className="text-base font-semibold text-accent-ink/80 mb-3">{t("luckyNumbers.title")}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {luckyNumbers.all.map((num, i) => {
                  const isMaster = num === 11 || num === 22 || num === 33;
                  return (
                    <Card
                      key={i}
                      className={`border-border-subtle ${
                        i === 0 ? "bg-accent-gold/10 border-accent-gold/30" : "bg-white"
                      }`}
                    >
                      <CardContent className="p-4 text-center">
                        <div
                          className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-3 ${
                            i === 0
                              ? "bg-accent-gold text-white"
                              : "bg-accent-gold/10 text-accent-gold border border-accent-gold/30"
                          }`}
                        >
                          {num}
                        </div>
                        <p className="text-sm font-medium text-accent-ink mb-1">
                          {t(`numbers.${num}.keyword`)}
                        </p>
                        {isMaster && (
                          <p className="text-xs text-accent-gold font-medium mb-1">{tCommon("masterNumber")}</p>
                        )}
                        <p className="text-xs text-accent-ink/60">{t(`numbers.${num}.energy`)}</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Karmic Debt */}
            {karmicDebt.hasKarmicDebt && (
              <div>
                <h3 className="text-base font-semibold text-accent-ink/80 mb-3">{t("karmicDebt.title")}</h3>
                <div className="space-y-4">
                  {karmicDebt.numbers.map((num) => (
                    <Card key={num} className="bg-white border-border-subtle">
                      <CardContent className="p-6">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-xl flex-shrink-0">
                            {num}
                          </div>
                          <div>
                            <p className="font-medium text-accent-ink">
                              {t("karmicDebt.title")} {num}: {t(`karmicDebt.${num}.label`)}
                            </p>
                            <p className="text-sm text-accent-ink/70 mt-1">
                              {t(`karmicDebt.${num}.meaning`)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ============================================================================
// RECENT BOOKS TAB
// ============================================================================

function RecentBooksTab() {
  const [entries, setEntries] = useState<RecentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "astrology" | "numerology">("all");
  const [openedBook, setOpenedBook] = useState<{
    type: "astrology" | "numerology";
    data: AstrologyBookResponse | NumerologyBookResponse;
  } | null>(null);
  const [bookLoading, setBookLoading] = useState(false);

  const fetchRecent = useCallback(async () => {
    setLoading(true);
    try {
      const [astroRes, numRes] = await Promise.all([
        fetch("/api/birth-chart-library"),
        fetch("/api/numerology-library"),
      ]);

      const all: RecentEntry[] = [];

      if (astroRes.ok) {
        const astro = await astroRes.json();
        for (const entry of astro.shelf || []) {
          all.push({ ...entry, book_type: "astrology" });
        }
      }

      if (numRes.ok) {
        const num = await numRes.json();
        for (const entry of num.shelf || []) {
          all.push({ ...entry, book_type: "numerology" });
        }
      }

      all.sort((a, b) => new Date(b.last_opened_at).getTime() - new Date(a.last_opened_at).getTime());
      setEntries(all);
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  const handleOpen = async (entry: RecentEntry) => {
    setBookLoading(true);
    setOpenedBook(null);

    try {
      if (entry.book_type === "astrology") {
        const res = await fetch("/api/birth-chart-library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "load", chart_key: entry.book_key }),
        });
        if (res.ok) {
          const data = await res.json();
          setOpenedBook({ type: "astrology", data });
          void fetchRecent();
        }
      } else {
        const res = await fetch("/api/numerology-library", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "load", book_key: entry.book_key }),
        });
        if (res.ok) {
          const data = await res.json();
          setOpenedBook({ type: "numerology", data });
          void fetchRecent();
        }
      }
    } catch {
      // ignore
    } finally {
      setBookLoading(false);
    }
  };

  const handleRemove = async (entry: RecentEntry) => {
    try {
      const res = await fetch("/api/library-checkouts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ book_type: entry.book_type, book_key: entry.book_key }),
      });
      if (res.ok) {
        setEntries((prev) => prev.filter((e) => !(e.book_key === entry.book_key && e.book_type === entry.book_type)));
        if (openedBook && entry.book_key === (
          openedBook.type === "astrology"
            ? (openedBook.data as AstrologyBookResponse).chart_key
            : (openedBook.data as NumerologyBookResponse).numerology_key
        )) {
          setOpenedBook(null);
        }
      }
    } catch {
      // ignore
    }
  };

  const filtered = filter === "all" ? entries : entries.filter((e) => e.book_type === filter);

  if (loading) {
    return <LoadingSpinner message="Loading recent books..." />;
  }

  return (
    <div className="space-y-6">
      {/* Filter chips */}
      <div className="flex gap-2">
        {(["all", "astrology", "numerology"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              filter === f
                ? "bg-accent-gold/20 text-accent-gold border border-accent-gold/30"
                : "bg-white text-accent-ink/60 border border-border-subtle hover:bg-white/80"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <Card className="bg-white/50">
          <CardContent className="py-12 text-center">
            <p className="text-accent-ink/60">
              {filter === "all"
                ? "No books checked out yet. Use the Astrology or Numerology tabs to generate your first book."
                : `No ${filter} books in your recent history.`}
            </p>
          </CardContent>
        </Card>
      )}

      {filtered.map((entry) => (
        <Card key={`${entry.book_type}-${entry.book_key}`} className="bg-white border-border-subtle">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    entry.book_type === "astrology"
                      ? "bg-blue-50 text-blue-600"
                      : "bg-purple-50 text-purple-600"
                  }`}
                >
                  {entry.book_type === "astrology" ? "Astrology" : "Numerology"}
                </span>
              </div>
              <p className="text-sm font-medium text-accent-ink truncate">
                {entry.label || "Book"}
              </p>
              <p className="text-xs text-accent-ink/50">
                {formatRelativeTime(entry.last_opened_at)}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpen(entry)}
                disabled={bookLoading}
              >
                Open
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRemove(entry)}
                className="text-red-500 hover:text-red-600 hover:border-red-200"
              >
                Remove
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {bookLoading && <LoadingSpinner message="Loading book..." />}

      {openedBook && openedBook.type === "astrology" && (
        <div className="space-y-4 pt-4 border-t border-border-subtle">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-accent-gold">Astrology Book</h3>
            <Button variant="outline" size="sm" onClick={() => setOpenedBook(null)}>
              Close
            </Button>
          </div>
          <InlineAstrologyViewer book={openedBook.data as AstrologyBookResponse} />
        </div>
      )}

      {openedBook && openedBook.type === "numerology" && (
        <div className="space-y-4 pt-4 border-t border-border-subtle">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-accent-gold">Numerology Book</h3>
            <Button variant="outline" size="sm" onClick={() => setOpenedBook(null)}>
              Close
            </Button>
          </div>
          <InlineNumerologyViewer book={openedBook.data as NumerologyBookResponse} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// INLINE VIEWERS (for Recent Books "Open" action)
// ============================================================================

function InlineAstrologyViewer({ book }: { book: AstrologyBookResponse }) {
  const insight = book.insight;
  if (!insight) {
    return <p className="text-accent-ink/60 text-sm">No narrative available for this chart.</p>;
  }

  return (
    <div className="space-y-4">
      {insight.coreSummary?.headline && (
        <h2 className="text-xl font-semibold text-accent-gold">{insight.coreSummary.headline}</h2>
      )}
      {insight.coreSummary?.overallVibe && (
        <div className="prose prose-sm max-w-none text-accent-ink/85 leading-relaxed">
          {insight.coreSummary.overallVibe.split("\n\n").map((p, i) => (
            <p key={i} className="mb-4 last:mb-0">{p}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function InlineNumerologyViewer({ book }: { book: NumerologyBookResponse }) {
  const narrative = book.narrative;
  if (!narrative || !narrative.sections?.length) {
    return <p className="text-accent-ink/60 text-sm">No narrative available for this book.</p>;
  }

  return (
    <div className="space-y-4">
      {narrative.sections.map((section, i) => (
        <div key={i} className="space-y-2">
          <h3 className="text-base font-semibold text-accent-gold">{section.heading}</h3>
          <div className="prose prose-sm max-w-none text-accent-ink/85 leading-relaxed">
            {section.body.split("\n\n").map((p, j) => (
              <p key={j} className="mb-3 last:mb-0">{p}</p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// SHARED HELPERS / SUB-COMPONENTS
// ============================================================================

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

      <div className="space-y-4">
        {deepDive.meaning.split("\n\n").map((para, idx) => (
          <p key={idx} className="text-base text-accent-ink/80 leading-relaxed">{para}</p>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-medium text-accent-ink/70 mb-2">When You're Aligned</h3>
        <ul className="space-y-2">
          {deepDive.aligned.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-accent-ink/80">
              <span className="text-accent mt-0.5">&bull;</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-sm font-medium text-accent-ink/70 mb-2">When You're Off Course</h3>
        <ul className="space-y-2">
          {deepDive.offCourse.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm text-accent-ink/80">
              <span className="text-accent-ink/40 mt-0.5">&bull;</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-accent-soft/30 rounded-lg p-4">
        <h3 className="text-sm font-medium text-accent-ink/70 mb-1">Decision Rule</h3>
        <p className="text-sm text-accent-ink font-medium">{deepDive.decisionRule}</p>
      </div>
    </SolaraCard>
  );
}

function LoadingSpinner({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center gap-3">
        <div className="w-6 h-6 rounded-full border-2 border-accent-gold/30 border-t-accent-gold animate-spin" />
        <span className="text-accent-ink/60">{message}</span>
      </div>
    </div>
  );
}

function CheckoutButton({
  show,
  onToggle,
  label = "Checkout Another Book",
}: {
  show: boolean;
  onToggle: () => void;
  label?: string;
}) {
  return (
    <div className="flex justify-center">
      <Button variant="outline" onClick={onToggle}>
        {show ? "Cancel" : label}
      </Button>
    </div>
  );
}

function AstrologyCheckoutForm({
  date,
  time,
  place,
  loading,
  onDateChange,
  onTimeChange,
  onPlaceChange,
  onSubmit,
}: {
  date: string;
  time: string;
  place: PlaceSelection | null;
  loading: boolean;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
  onPlaceChange: (v: PlaceSelection | null) => void;
  onSubmit: () => void;
}) {
  return (
    <Card className="border-accent-gold/30 bg-accent-gold/5">
      <CardContent className="p-6 space-y-4">
        <h3 className="text-lg font-semibold text-accent-ink">Checkout an Astrology Book</h3>
        <p className="text-sm text-accent-ink/60">
          Enter birth details to generate an astrology chart for anyone.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium text-accent-ink/70 block mb-1">Birth Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm bg-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-accent-ink/70 block mb-1">Birth Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => onTimeChange(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm bg-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-accent-ink/70 block mb-1">Birth Place</label>
            <PlacePicker
              onSelect={(p) => onPlaceChange(p)}
              onClear={() => onPlaceChange(null)}
              placeholder="Search city..."
            />
          </div>
        </div>
        <Button
          variant="gold"
          onClick={onSubmit}
          disabled={loading || !date || !time || !place}
        >
          {loading ? "Generating..." : "Generate Astrology Book"}
        </Button>
      </CardContent>
    </Card>
  );
}

function NumerologyCheckoutForm({
  name,
  date,
  loading,
  onNameChange,
  onDateChange,
  onSubmit,
}: {
  name: string;
  date: string;
  loading: boolean;
  onNameChange: (v: string) => void;
  onDateChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Card className="border-accent-gold/30 bg-accent-gold/5">
      <CardContent className="p-6 space-y-4">
        <h3 className="text-lg font-semibold text-accent-ink">Checkout a Numerology Book</h3>
        <p className="text-sm text-accent-ink/60">
          Enter a name and birth date to generate a numerology profile for anyone.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-accent-ink/70 block mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. John David Smith"
              className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm bg-white"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-accent-ink/70 block mb-1">Birth Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm bg-white"
            />
          </div>
        </div>
        <Button
          variant="gold"
          onClick={onSubmit}
          disabled={loading || !name.trim() || !date}
        >
          {loading ? "Generating..." : "Generate Numerology Book"}
        </Button>
      </CardContent>
    </Card>
  );
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
