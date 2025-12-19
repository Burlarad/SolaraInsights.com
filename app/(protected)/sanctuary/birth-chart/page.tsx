"use client";

import { useEffect, useState, useCallback } from "react";
import { SanctuaryTabs } from "@/components/sanctuary/SanctuaryTabs";
import type { FullBirthChartInsight, TabDeepDive } from "@/types/natalAI";
import { SolaraCard } from "@/components/ui/solara-card";
import { Button } from "@/components/ui/button";
import { pickRotatingMessage, getErrorCategory, type ApiErrorResponse } from "@/lib/ui/pickRotatingMessage";

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

type SoulPathSection =
  | "narrative"
  | "planets"
  | "houses"
  | "aspects"
  | "patterns"
  | "energy"
  | "intensity"
  | "direction"
  | "joy";

const SECTIONS: { id: SoulPathSection; label: string }[] = [
  { id: "narrative", label: "Personal Narrative" },
  { id: "planets", label: "Planetary Placements" },
  { id: "houses", label: "Houses" },
  { id: "aspects", label: "Aspects" },
  { id: "patterns", label: "Patterns" },
  { id: "energy", label: "Energy Shape" },
  { id: "intensity", label: "Intensity Zones" },
  { id: "direction", label: "Direction" },
  { id: "joy", label: "Joy" },
];

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

type BirthChartResponse = {
  placements: any; // SwissPlacements type - can refine later
  insight: FullBirthChartInsight | null;
  error?: string;
  message?: string;
};

export default function BirthChartPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [incompleteProfile, setIncompleteProfile] = useState(false);
  const [insight, setInsight] = useState<FullBirthChartInsight | null>(null);
  const [placements, setPlacements] = useState<any | null>(null);
  const [activeSection, setActiveSection] = useState<SoulPathSection>("narrative");
  const [showAllAspects, setShowAllAspects] = useState(false);

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

  const fetchBirthChart = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorInfo(null);
    setIncompleteProfile(false);
    setAttemptCount((prev) => prev + 1);

    try {
      const res = await fetch("/api/birth-chart", { method: "POST" });

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
          attempt: attemptCount + 1,
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
        if (data?.error === "Incomplete profile") {
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
          attempt: attemptCount + 1,
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
      setAttemptCount(0); // Reset on success
      setLoading(false);
    } catch (err) {
      console.error("[BirthChart] Client fetch error:", err);
      const rotatingMessage = pickRotatingMessage({
        category: "provider_500",
        attempt: attemptCount + 1,
      });
      setError(rotatingMessage);
      setErrorInfo({
        message: rotatingMessage,
        status: 500,
      });
      setLoading(false);
    }
  }, [attemptCount]);

  useEffect(() => {
    fetchBirthChart();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Soul Path</h1>
        <p className="text-sm text-accent-ink/70">The Light Behind Your Life</p>
      </div>

      <SanctuaryTabs />

      {loading && (
        <div>
          <p className="text-sm text-accent-ink/70">Calculating your Soul Path…</p>
        </div>
      )}

      {!loading && incompleteProfile && (
        <div className="rounded-xl border border-accent-soft bg-accent-soft/30 p-8 space-y-3">
          <h2 className="text-lg font-semibold">Complete your birth signature</h2>
          <p className="text-sm text-accent-ink/80">
            We need your full birth date, time, and location in Settings before Solara can
            generate your Soul Path.
          </p>
          <a
            href="/settings"
            className="inline-flex items-center text-sm font-medium text-accent underline"
          >
            Go to Settings
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

          <Button variant="outline" onClick={() => fetchBirthChart()}>
            Try again
          </Button>
        </div>
      )}

      {/* Section Toggle - Horizontal pills on md+, dropdown on mobile */}
      {!loading && !error && !incompleteProfile && (
        <>
          {/* Mobile: Dropdown */}
          <div className="md:hidden">
            <select
              value={activeSection}
              onChange={(e) => setActiveSection(e.target.value as SoulPathSection)}
              className="w-full px-4 py-3 rounded-lg border border-accent-soft bg-white text-accent-ink text-base font-medium focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {SECTIONS.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>
          </div>

          {/* Desktop: Horizontal pills (single row with horizontal scroll) */}
          <div className="hidden md:block max-w-5xl mx-auto overflow-x-auto">
            <div className="flex gap-2 whitespace-nowrap pb-2">
              {SECTIONS.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    activeSection === section.id
                      ? "bg-white/70 border border-border-subtle shadow-sm text-accent-ink"
                      : "bg-transparent border border-transparent hover:bg-white/40 text-accent-ink/70"
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
            <div className="space-y-10">
              <h1 className="text-2xl md:text-3xl font-semibold leading-snug">
                {insight!.coreSummary.headline}
              </h1>

              <div className="text-base text-accent-ink/80 leading-relaxed space-y-4">
                {insight!.coreSummary.overallVibe.split("\n\n").map((para, idx) => (
                  <p key={idx}>{para}</p>
                ))}
              </div>

              <div className="space-y-8">
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Identity</h3>
                  <div className="text-base text-accent-ink/80 leading-relaxed space-y-4">
                    {insight!.sections.identity.split("\n\n").map((para, idx) => (
                      <p key={idx}>{para}</p>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Emotions</h3>
                  <div className="text-base text-accent-ink/80 leading-relaxed space-y-4">
                    {insight!.sections.emotions.split("\n\n").map((para, idx) => (
                      <p key={idx}>{para}</p>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Love & Relationships</h3>
                  <div className="text-base text-accent-ink/80 leading-relaxed space-y-4">
                    {insight!.sections.loveAndRelationships.split("\n\n").map((para, idx) => (
                      <p key={idx}>{para}</p>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Work & Money</h3>
                  <div className="text-base text-accent-ink/80 leading-relaxed space-y-4">
                    {insight!.sections.workAndMoney.split("\n\n").map((para, idx) => (
                      <p key={idx}>{para}</p>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Purpose & Growth</h3>
                  <div className="text-base text-accent-ink/80 leading-relaxed space-y-4">
                    {insight!.sections.purposeAndGrowth.split("\n\n").map((para, idx) => (
                      <p key={idx}>{para}</p>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-lg font-semibold">Inner World</h3>
                  <div className="text-base text-accent-ink/80 leading-relaxed space-y-4">
                    {insight!.sections.innerWorld.split("\n\n").map((para, idx) => (
                      <p key={idx}>{para}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === "narrative" && !hasFullInsight && (
            <SolaraCard className="space-y-3">
              <h2 className="text-lg font-semibold">Interpretation not available</h2>
              <p className="text-sm text-accent-ink/80 leading-relaxed">
                We calculated your Soul Path, but couldn't generate a full interpretation right now.
                Your placements are saved — please try again in a moment.
              </p>
            </SolaraCard>
          )}

          {/* Planetary Placements */}
          {activeSection === "planets" && placements && (
            <div className="space-y-6">
              {/* Deep Dive Card (if available) */}
              {insight?.tabDeepDives?.planetaryPlacements && (
                <DeepDiveCard
                  title="What Your Planets Mean For You"
                  subtitle="Your unique planetary signature"
                  deepDive={insight.tabDeepDives.planetaryPlacements}
                />
              )}

              <SolaraCard className="space-y-4">
                <h2 className="text-xl font-semibold">Planetary Placements</h2>
                <p className="text-sm text-accent-ink/60 leading-relaxed">
                  These show how different parts of you express themselves—your drive, your communication style, how you love and relate.
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
            </div>
          )}

          {/* Houses */}
          {activeSection === "houses" && placements && (
            <div className="space-y-6">
              {/* Deep Dive Card (if available) */}
              {insight?.tabDeepDives?.houses && (
                <DeepDiveCard
                  title="What Your Houses Mean For You"
                  subtitle="The 12 life areas of your chart"
                  deepDive={insight.tabDeepDives.houses}
                />
              )}

              <SolaraCard className="space-y-4">
                <h2 className="text-xl font-semibold">Houses</h2>
                <p className="text-sm text-accent-ink/60 leading-relaxed">
                  Houses show where life themes unfold—which arenas of life ask the most of you, and where certain energies come alive.
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

          {/* Aspects */}
          {activeSection === "aspects" && placements?.aspects && (
            <div className="space-y-6">
              {/* Deep Dive Card (if available) */}
              {insight?.tabDeepDives?.aspects && (
                <DeepDiveCard
                  title="What Your Aspects Mean For You"
                  subtitle="The conversations between your planets"
                  deepDive={insight.tabDeepDives.aspects}
                />
              )}

              <SolaraCard className="space-y-4">
                <h2 className="text-xl font-semibold">Aspects</h2>
                <p className="text-sm text-accent-ink/60 leading-relaxed">
                  Aspects show how different inner parts of you interact—where they support, challenge, or intensify each other.
                </p>
                <div className="space-y-2">
                  {placements.aspects
                    .slice(0, showAllAspects ? undefined : 20)
                    .map((aspect: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-baseline justify-between gap-4 py-2 border-b border-accent-soft/30 last:border-0 text-sm"
                      >
                        <span className="font-medium text-accent-ink">
                          {aspect.between[0]} {aspect.type} {aspect.between[1]}
                        </span>
                        <span className="text-accent-ink/50 text-xs">
                          {aspect.orb?.toFixed(2)}°
                        </span>
                      </div>
                    ))}
                </div>
                {!showAllAspects && placements.aspects.length > 20 && (
                  <button
                    onClick={() => setShowAllAspects(true)}
                    className="text-sm text-accent underline hover:no-underline"
                  >
                    Show all {placements.aspects.length} aspects
                  </button>
                )}
                {showAllAspects && placements.aspects.length > 20 && (
                  <button
                    onClick={() => setShowAllAspects(false)}
                    className="text-sm text-accent underline hover:no-underline"
                  >
                    Show fewer aspects
                  </button>
                )}
              </SolaraCard>
            </div>
          )}

          {/* Patterns */}
          {activeSection === "patterns" && placements?.calculated?.patterns && (
            <div className="space-y-6">
              {/* Deep Dive Card (if available) */}
              {insight?.tabDeepDives?.patterns && (
                <DeepDiveCard
                  title="What Your Patterns Mean For You"
                  subtitle="Major configurations in your chart"
                  deepDive={insight.tabDeepDives.patterns}
                />
              )}

              <SolaraCard className="space-y-4">
                <h2 className="text-xl font-semibold">Major Patterns</h2>
                <p className="text-sm text-accent-ink/60 leading-relaxed">
                  Patterns are large-scale energetic shapes in your chart—where several planets connect to form a recognizable theme or recurring dynamic.
                </p>
                {placements.calculated.patterns.length > 0 ? (
                  <div className="space-y-5">
                    {placements.calculated.patterns.map((pattern: any, idx: number) => (
                      <div key={idx} className="pb-4 border-b border-accent-soft/30 last:border-0">
                        <h3 className="font-medium text-accent-ink mb-2">
                          {pattern.type === "t_square" && "T-Square"}
                          {pattern.type === "grand_trine" && "Grand Trine"}
                        </h3>
                        {pattern.planets && (
                          <p className="text-sm text-accent-ink/70 mb-2">
                            {pattern.planets.join(" • ")}
                          </p>
                        )}
                        <p className="text-sm text-accent-ink/60 leading-relaxed">
                          {pattern.type === "t_square" &&
                            "A T-Square creates tension between three areas of life, asking you to find creative solutions. It often feels like productive friction—pressure that pushes you toward growth, innovation, and resilience. This pattern tends to keep you moving forward, even when stillness might feel easier."}
                          {pattern.type === "grand_trine" &&
                            "A Grand Trine forms a triangle of ease and flow, where energy moves smoothly between three areas. This can feel like natural talent or effortless grace. The invitation is to activate this gift consciously rather than letting it remain passive—talent unused doesn't always become mastery."}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-accent-ink/60">No major patterns detected in your chart.</p>
                )}
              </SolaraCard>
            </div>
          )}

          {/* Energy Shape */}
          {activeSection === "energy" && placements && (
            <div className="space-y-6">
              {/* Deep Dive Card (if available) */}
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

                {placements.derived?.elementBalance && (
                  <div>
                    <h3 className="text-sm font-medium text-accent-ink/70 mb-2">Element Balance</h3>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {Object.entries(placements.derived.elementBalance).map(([element, count]) => (
                        <div key={element} className="text-sm text-accent-ink/80">
                          <span className="font-medium">{element}:</span> {count as number}
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-accent-ink/60 leading-relaxed">
                      This shows where your energy naturally gathers—whether in inspiration, grounding, thought, or emotion.
                    </p>
                  </div>
                )}

                {placements.derived?.modalityBalance && (
                  <div>
                    <h3 className="text-sm font-medium text-accent-ink/70 mb-2">Modality Balance</h3>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {Object.entries(placements.derived.modalityBalance).map(([modality, count]) => (
                        <div key={modality} className="text-sm text-accent-ink/80">
                          <span className="font-medium">{modality}:</span> {count as number}
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-accent-ink/60 leading-relaxed">
                      This reflects how you initiate, sustain, or adapt—whether you tend to start things, stabilize them, or shift with change.
                    </p>
                  </div>
                )}
              </SolaraCard>
            </div>
          )}

          {/* Intensity Zones */}
          {activeSection === "intensity" && placements?.calculated?.emphasis && (
            <div className="space-y-6">
              {/* Deep Dive Card (if available) */}
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
            </div>
          )}

          {/* Direction */}
          {activeSection === "direction" && placements && (
            <div className="space-y-6">
              {/* Deep Dive Card (if available) */}
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

                {placements.planets?.find((p: any) => p.name === "North Node") && (
                  <div>
                    <h3 className="font-medium text-accent-ink mb-2">North Node</h3>
                    <p className="text-sm text-accent-ink/70 mb-2">
                      {placements.planets.find((p: any) => p.name === "North Node").sign}
                      {placements.planets.find((p: any) => p.name === "North Node").house &&
                        ` — ${placements.planets.find((p: any) => p.name === "North Node").house}th house`}
                    </p>
                    <p className="text-sm text-accent-ink/60 leading-relaxed">
                      Your North Node is an invitation toward growth and unfamiliar territory. It points to qualities you're developing, even when they don't feel natural yet. This is where life asks you to stretch—not because you lack something, but because expansion lives here. Moving toward the North Node often feels uncomfortable at first, but it's where you build new capacity and meet life in fresh ways.
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
                      Your South Node represents familiar patterns and natural comfort. These are qualities you carry easily, perhaps from early life or past experience. They feel like home—but relying on them too heavily can keep you circling the same ground. The South Node isn't something to abandon, but rather a foundation to honor while you reach toward the North Node's invitation. It's what you already know how to do.
                    </p>
                  </div>
                )}

                {placements.planets?.find((p: any) => p.name === "Chiron") && (
                  <div>
                    <h3 className="font-medium text-accent-ink mb-2">Chiron</h3>
                    <p className="text-sm text-accent-ink/70 mb-2">
                      {placements.planets.find((p: any) => p.name === "Chiron").sign}
                      {placements.planets.find((p: any) => p.name === "Chiron").house &&
                        ` — ${placements.planets.find((p: any) => p.name === "Chiron").house}th house`}
                    </p>
                    <p className="text-sm text-accent-ink/60 leading-relaxed">
                      Chiron shows where healing and teaching emerge from your deepest wounds. This is often a tender area—a place where you've experienced pain or felt different, but also where you develop profound wisdom. What once hurt can become a source of compassion and guidance for others. Chiron doesn't promise that the wound disappears, but that it becomes medicine—something you understand deeply enough to help others navigate.
                    </p>
                  </div>
                )}
              </SolaraCard>
            </div>
          )}

          {/* Joy */}
          {activeSection === "joy" && placements?.calculated?.partOfFortune && (
            <div className="space-y-6">
              {/* Deep Dive Card (if available) */}
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

              {/* Static Definition Card (always shown) */}
              <SolaraCard className="space-y-4">
                <h2 className="text-xl font-semibold">About Part of Fortune</h2>
                <p className="text-sm text-accent-ink/60 leading-relaxed mb-4">
                  This reflects ease, joy, and natural alignment—where life feels generous and where you access flow without force.
                </p>
                <p className="text-base text-accent-ink mb-3">
                  {placements.calculated.partOfFortune.sign}
                  {placements.calculated.partOfFortune.house &&
                    ` — ${placements.calculated.partOfFortune.house}th house`}
                </p>
                <div className="text-sm text-accent-ink/60 leading-relaxed space-y-3">
                  <p>
                    The Part of Fortune shows where natural joy and ease flow most readily in your life. This isn't about achievement or effort—it's where things align organically, where you feel instinctively at home. When you engage this area, life often responds with surprising support or unexpected openings.
                  </p>
                  <p>
                    This placement suggests where you might find your stride without needing to push. It's not that success is guaranteed here, but rather that the process itself feels nourishing. You might notice that when you orient toward this theme or life arena, ease appears—not as laziness, but as rightness.
                  </p>
                  <p>
                    Cultivating this area doesn't require force. Instead, notice when you feel genuinely resourced, when energy returns rather than depletes. That's the Part of Fortune at work—quiet, generous, and often overlooked until you learn to recognize its signature.
                  </p>
                </div>
              </SolaraCard>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
