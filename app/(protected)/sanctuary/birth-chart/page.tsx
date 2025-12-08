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
    <div className="space-y-6">
      <SanctuaryTabs />

      {loading && (
        <div className="p-6">
          <p className="text-sm text-accent-ink/70">Calculating your birth chart…</p>
        </div>
      )}

      {!loading && incompleteProfile && (
        <div className="p-6 rounded-xl border border-accent-soft bg-accent-soft/30 space-y-3">
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
        <div className="p-6 rounded-xl border border-accent-soft bg-accent-soft/30 space-y-3">
          <h2 className="text-lg font-semibold">We couldn't generate your birth chart</h2>
          <p className="text-sm text-accent-ink/80">{error}</p>
        </div>
      )}

      {!loading && !error && !incompleteProfile && hasFullInsight && (
        <div className="space-y-8 p-6">
          <section className="space-y-2">
            <h1 className="text-xl font-semibold">
              {insight!.coreSummary.headline}
            </h1>
            <p className="text-sm text-accent-ink/80">
              {insight!.coreSummary.overallVibe}
            </p>
            <p className="text-sm text-accent-ink/80">
              <strong>Big 3:</strong> {insight!.coreSummary.bigThree.sun} ·{" "}
              {insight!.coreSummary.bigThree.moon} ·{" "}
              {insight!.coreSummary.bigThree.rising}
            </p>
          </section>

          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold">Identity</h2>
              <p className="text-sm text-accent-ink/80 whitespace-pre-line">
                {insight!.sections.identity}
              </p>
            </div>
            <div>
              <h2 className="text-base font-semibold">Emotions</h2>
              <p className="text-sm text-accent-ink/80 whitespace-pre-line">
                {insight!.sections.emotions}
              </p>
            </div>
            <div>
              <h2 className="text-base font-semibold">Love & Relationships</h2>
              <p className="text-sm text-accent-ink/80 whitespace-pre-line">
                {insight!.sections.loveAndRelationships}
              </p>
            </div>
            <div>
              <h2 className="text-base font-semibold">Work & Money</h2>
              <p className="text-sm text-accent-ink/80 whitespace-pre-line">
                {insight!.sections.workAndMoney}
              </p>
            </div>
            <div>
              <h2 className="text-base font-semibold">Purpose & Growth</h2>
              <p className="text-sm text-accent-ink/80 whitespace-pre-line">
                {insight!.sections.purposeAndGrowth}
              </p>
            </div>
            <div>
              <h2 className="text-base font-semibold">Inner World</h2>
              <p className="text-sm text-accent-ink/80 whitespace-pre-line">
                {insight!.sections.innerWorld}
              </p>
            </div>
          </section>

          {/* Optional: Technical placements view can be added here later */}
        </div>
      )}

      {!loading && !error && !incompleteProfile && !hasFullInsight && (
        <div className="p-6 rounded-xl border border-accent-soft bg-accent-soft/30 space-y-3">
          <h2 className="text-lg font-semibold">Interpretation not available</h2>
          <p className="text-sm text-accent-ink/80">
            We calculated your birth chart, but couldn't generate a full interpretation right now.
            Your chart placements are saved — please try again in a moment.
          </p>
        </div>
      )}
    </div>
  );
}
