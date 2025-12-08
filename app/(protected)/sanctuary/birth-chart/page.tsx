"use client";

import { useEffect, useState } from "react";
import { SanctuaryTabs } from "@/components/sanctuary/SanctuaryTabs";
import type { FullBirthChartInsight } from "@/types/natalAI";

type BirthChartResponse = {
  placements: any; // SwissPlacements type - can refine later
  insight: FullBirthChartInsight | null;
  error?: string;
  message?: string;
};

export default function BirthChartPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [incompleteProfile, setIncompleteProfile] = useState(false);
  const [insight, setInsight] = useState<FullBirthChartInsight | null>(null);
  const [placements, setPlacements] = useState<any | null>(null);

  // Derived state: check if insight has the full expected structure
  const hasFullInsight =
    insight !== null &&
    insight.coreSummary !== undefined &&
    insight.sections !== undefined;

  useEffect(() => {
    const fetchBirthChart = async () => {
      setLoading(true);
      setError(null);
      setIncompleteProfile(false);

      try {
        const res = await fetch("/api/birth-chart", { method: "POST" });

        if (res.status === 401) {
          setError("Please sign in to view your birth chart.");
          setLoading(false);
          return;
        }

        if (res.status === 400) {
          const data = await res.json();
          if (data?.error === "Incomplete profile") {
            setIncompleteProfile(true);
            setLoading(false);
            return;
          }
        }

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(
            data?.message || "We couldn't generate your birth chart. Please try again."
          );
          setLoading(false);
          return;
        }

        const data: BirthChartResponse = await res.json();
        setPlacements(data.placements || null);
        setInsight(data.insight ?? null);
        setLoading(false);
      } catch (err) {
        console.error("[BirthChart] Client fetch error:", err);
        setError("We couldn't generate your birth chart. Please try again in a moment.");
        setLoading(false);
      }
    };

    fetchBirthChart();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      <SanctuaryTabs />

      {loading && (
        <div>
          <p className="text-sm text-accent-ink/70">Calculating your birth chart…</p>
        </div>
      )}

      {!loading && incompleteProfile && (
        <div className="rounded-xl border border-accent-soft bg-accent-soft/30 p-8 space-y-3">
          <h2 className="text-lg font-semibold">Complete your birth signature</h2>
          <p className="text-sm text-accent-ink/80">
            We need your full birth date, time, and location in Settings before Solara can
            generate your birth chart.
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
        <div className="rounded-xl border border-accent-soft bg-accent-soft/30 p-8 space-y-3">
          <h2 className="text-lg font-semibold">We couldn't generate your birth chart</h2>
          <p className="text-sm text-accent-ink/80">{error}</p>
        </div>
      )}

      {!loading && !error && !incompleteProfile && (
        <div className="grid gap-6 lg:grid-cols-[1.618fr,1fr]">
          {/* LEFT: narrative */}
          <div className="space-y-6">
            {hasFullInsight && (
              <>
                {/* Headline */}
                <h1 className="text-xl font-semibold">
                  {insight!.coreSummary.headline}
                </h1>

                {/* Big 3 hero card */}
                <div className="rounded-2xl border border-accent-soft bg-accent-soft/10 p-4 space-y-2">
                  <h2 className="text-sm font-semibold tracking-wide uppercase text-accent-ink/70">
                    Big 3
                  </h2>
                  {placements && (
                    <ul className="text-sm text-accent-ink/80 space-y-1">
                      {placements.planets?.find((p: any) => p.name === "Sun") && (
                        <li>
                          <span className="font-medium">Sun</span>{" "}
                          in {placements.planets.find((p: any) => p.name === "Sun").sign}
                          {placements.planets.find((p: any) => p.name === "Sun").house
                            ? ` — ${placements.planets.find((p: any) => p.name === "Sun").house} house`
                            : ""}
                        </li>
                      )}
                      {placements.planets?.find((p: any) => p.name === "Moon") && (
                        <li>
                          <span className="font-medium">Moon</span>{" "}
                          in {placements.planets.find((p: any) => p.name === "Moon").sign}
                          {placements.planets.find((p: any) => p.name === "Moon").house
                            ? ` — ${placements.planets.find((p: any) => p.name === "Moon").house} house`
                            : ""}
                        </li>
                      )}
                      {placements.angles?.ascendant?.sign && (
                        <li>
                          <span className="font-medium">Rising</span>{" "}
                          in {placements.angles.ascendant.sign}
                        </li>
                      )}
                    </ul>
                  )}
                </div>

                {/* Overall vibe paragraph */}
                <p className="text-sm text-accent-ink/80 leading-relaxed whitespace-pre-line">
                  {insight!.coreSummary.overallVibe}
                </p>

                {/* Section cards */}
                <section className="rounded-2xl border border-accent-soft/60 bg-accent-soft/5 p-4 space-y-2">
                  <h2 className="text-base font-semibold">Identity</h2>
                  <p className="text-sm text-accent-ink/80 leading-relaxed whitespace-pre-line">
                    {insight!.sections.identity}
                  </p>
                </section>

                <section className="rounded-2xl border border-accent-soft/60 bg-accent-soft/5 p-4 space-y-2">
                  <h2 className="text-base font-semibold">Emotions</h2>
                  <p className="text-sm text-accent-ink/80 leading-relaxed whitespace-pre-line">
                    {insight!.sections.emotions}
                  </p>
                </section>

                <section className="rounded-2xl border border-accent-soft/60 bg-accent-soft/5 p-4 space-y-2">
                  <h2 className="text-base font-semibold">Love & Relationships</h2>
                  <p className="text-sm text-accent-ink/80 leading-relaxed whitespace-pre-line">
                    {insight!.sections.loveAndRelationships}
                  </p>
                </section>

                <section className="rounded-2xl border border-accent-soft/60 bg-accent-soft/5 p-4 space-y-2">
                  <h2 className="text-base font-semibold">Work & Money</h2>
                  <p className="text-sm text-accent-ink/80 leading-relaxed whitespace-pre-line">
                    {insight!.sections.workAndMoney}
                  </p>
                </section>

                <section className="rounded-2xl border border-accent-soft/60 bg-accent-soft/5 p-4 space-y-2">
                  <h2 className="text-base font-semibold">Purpose & Growth</h2>
                  <p className="text-sm text-accent-ink/80 leading-relaxed whitespace-pre-line">
                    {insight!.sections.purposeAndGrowth}
                  </p>
                </section>

                <section className="rounded-2xl border border-accent-soft/60 bg-accent-soft/5 p-4 space-y-2">
                  <h2 className="text-base font-semibold">Inner World</h2>
                  <p className="text-sm text-accent-ink/80 leading-relaxed whitespace-pre-line">
                    {insight!.sections.innerWorld}
                  </p>
                </section>
              </>
            )}

            {!hasFullInsight && (
              <div className="rounded-2xl border border-accent-soft bg-accent-soft/30 p-6 space-y-3">
                <h2 className="text-lg font-semibold">Interpretation not available</h2>
                <p className="text-sm text-accent-ink/80 leading-relaxed">
                  We calculated your birth chart, but couldn't generate a full interpretation right now.
                  Your chart placements are saved — please try again in a moment.
                </p>
              </div>
            )}
          </div>

          {/* RIGHT: technical chart summary */}
          {placements && (
            <aside className="space-y-4 lg:sticky lg:top-28">
              {/* Chart Snapshot */}
              <div className="rounded-2xl border border-accent-soft bg-accent-soft/10 p-4 space-y-3">
                <h2 className="text-sm font-semibold tracking-wide uppercase text-accent-ink/70">
                  Chart Snapshot
                </h2>
                <ul className="text-sm text-accent-ink/80 space-y-1">
                  {placements.planets?.find((p: any) => p.name === "Sun") && (
                    <li>
                      <span className="font-medium">Sun</span>{" "}
                      in {placements.planets.find((p: any) => p.name === "Sun").sign}
                      {placements.planets.find((p: any) => p.name === "Sun").house
                        ? ` — ${placements.planets.find((p: any) => p.name === "Sun").house} house`
                        : ""}
                    </li>
                  )}
                  {placements.planets?.find((p: any) => p.name === "Moon") && (
                    <li>
                      <span className="font-medium">Moon</span>{" "}
                      in {placements.planets.find((p: any) => p.name === "Moon").sign}
                      {placements.planets.find((p: any) => p.name === "Moon").house
                        ? ` — ${placements.planets.find((p: any) => p.name === "Moon").house} house`
                        : ""}
                    </li>
                  )}
                  {placements.angles?.ascendant?.sign && (
                    <li>
                      <span className="font-medium">Rising</span>{" "}
                      in {placements.angles.ascendant.sign}
                    </li>
                  )}
                </ul>
              </div>

              {/* Planets */}
              <div className="rounded-2xl border border-accent-soft bg-accent-soft/5 p-4 space-y-3">
                <h2 className="text-sm font-semibold tracking-wide uppercase text-accent-ink/70">
                  Planets
                </h2>
                <ul className="text-sm text-accent-ink/80 space-y-1">
                  {placements.planets?.map((p: any) => (
                    <li key={p.name}>
                      <span className="font-medium">{p.name}</span>{" "}
                      in {p.sign}
                      {p.house ? ` — ${p.house} house` : ""}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Houses */}
              <div className="rounded-2xl border border-accent-soft bg-accent-soft/5 p-4 space-y-3">
                <h2 className="text-sm font-semibold tracking-wide uppercase text-accent-ink/70">
                  Houses
                </h2>
                <ul className="text-sm text-accent-ink/80 space-y-1">
                  {placements.houses
                    ?.filter((h: any) => !!h.signOnCusp)
                    .map((h: any) => (
                      <li key={h.house}>
                        <span className="font-medium">{h.house} house cusp</span>{" "}
                        — {h.signOnCusp}
                      </li>
                    ))}
                </ul>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
