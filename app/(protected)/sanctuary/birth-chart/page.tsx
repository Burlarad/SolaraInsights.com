"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SanctuaryTabs } from "@/components/sanctuary/SanctuaryTabs";
import { useSettings } from "@/providers/SettingsProvider";
import { FullBirthChartInsight } from "@/types";
import { formatDateForDisplay, formatTimeForDisplay } from "@/lib/datetime";

export default function BirthChartPage() {
  const router = useRouter();
  const { profile, loading: profileLoading, error: profileError } = useSettings();

  const [insight, setInsight] = useState<FullBirthChartInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBirthChart = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/birth-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.status === 401) {
        router.push("/sign-in");
        return;
      }

      if (response.status === 400) {
        const errorData = await response.json();
        setError(errorData.message);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load birth chart");
      }

      const data: FullBirthChartInsight = await response.json();
      setInsight(data);
    } catch (err: any) {
      console.error("Error loading birth chart:", err);
      setError("We couldn't generate your birth chart. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profileLoading && profile) {
      loadBirthChart();
    }
  }, [profileLoading, profile]);

  // Check if profile has required birth data
  const hasBirthData =
    profile?.birth_date &&
    profile?.birth_city &&
    profile?.birth_region &&
    profile?.birth_country &&
    profile?.timezone;

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
      <div className="flex items-center justify-between">
        <SanctuaryTabs />
      </div>

      {/* Error state for incomplete profile */}
      {error && error.includes("birth") && (
        <Card className="max-w-2xl mx-auto text-center border-border-subtle bg-accent-muted/20">
          <CardHeader>
            <div className="text-6xl mb-4">🌙</div>
            <CardTitle className="text-2xl">Complete your birth signature</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-accent-ink/70 leading-relaxed">{error}</p>
            <ul className="text-sm text-accent-ink/60 space-y-2 max-w-md mx-auto text-left">
              <li>✓ Birth date</li>
              <li>✓ Birth time (or indicate if unknown)</li>
              <li>✓ Birth location (city, region, country)</li>
              <li>✓ Timezone</li>
            </ul>
            <div className="pt-4">
              <Link href="/settings">
                <Button variant="gold">Complete your birth signature in Settings</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Check for incomplete profile before loading */}
      {!profileLoading && profile && !hasBirthData && !error && (
        <Card className="max-w-2xl mx-auto text-center border-border-subtle bg-accent-muted/20">
          <CardHeader>
            <div className="text-6xl mb-4">🌙</div>
            <CardTitle className="text-2xl">Complete your birth signature</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-accent-ink/70 leading-relaxed">
              To see your full birth chart, we need your birth date, exact time, and location in Settings.
            </p>
            <ul className="text-sm text-accent-ink/60 space-y-2 max-w-md mx-auto text-left">
              <li>✓ Birth date</li>
              <li>✓ Birth time (or indicate if unknown)</li>
              <li>✓ Birth location (city, region, country)</li>
              <li>✓ Timezone</li>
            </ul>
            <div className="pt-4">
              <Link href="/settings">
                <Button variant="gold">Complete your birth signature in Settings</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {loading && !error && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">Your Birth Chart Mirror</h1>
            <p className="text-accent-ink/60">
              Tuning your cosmic blueprint...
            </p>
          </div>
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-12 bg-accent-muted/10">
                <div className="h-4 bg-accent-muted rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-accent-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Content - only show when we have data and no errors */}
      {insight && !loading && !error && (
        <>
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">Your Birth Chart Mirror</h1>
            <p className="text-accent-ink/60">
              A snapshot of the sky at the moment of your birth
            </p>
          </div>

          {/* Birth chart sections */}
          <div className="space-y-8 max-w-6xl mx-auto">
            {/* SECTION 1: BLUEPRINT */}
            <Card>
              <CardHeader>
                <CardTitle>Your birth blueprint</CardTitle>
                <p className="text-sm text-accent-ink/60">
                  The coordinates of your cosmic moment
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-accent-ink/50">Birth date:</span>{" "}
                    <span className="text-accent-ink font-medium">
                      {formatDateForDisplay(insight.blueprint.birthDate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-accent-ink/50">Birth time:</span>{" "}
                    <span className="text-accent-ink font-medium">
                      {formatTimeForDisplay(insight.blueprint.birthTime)}
                    </span>
                  </div>
                  <div>
                    <span className="text-accent-ink/50">Location:</span>{" "}
                    <span className="text-accent-ink font-medium">
                      {insight.blueprint.birthLocation}
                    </span>
                  </div>
                  <div>
                    <span className="text-accent-ink/50">Timezone:</span>{" "}
                    <span className="text-accent-ink font-medium">
                      {insight.blueprint.timezone}
                    </span>
                  </div>
                </div>

                {!insight.blueprint.birthTime && (
                  <div className="mt-4 p-3 rounded-lg bg-accent-muted/20 text-sm text-accent-ink/70 italic">
                    Birth time is unknown, so this chart uses a solar chart approach (houses and
                    angles are less precise).
                  </div>
                )}

                <p className="text-accent-ink/60 text-sm leading-relaxed pt-2">
                  Your natal chart is a snapshot of the sky from your exact birth location and
                  moment, showing where each planet was positioned in the zodiac.
                </p>
              </CardContent>
            </Card>

            {/* SECTION 2: THE MAP */}
            <div className="space-y-6">
              {/* Planets & Signs */}
              <Card>
                <CardHeader>
                  <CardTitle>Planets & signs</CardTitle>
                  <p className="text-sm text-accent-ink/60">
                    Where each planet sits in your chart
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {insight.planets && insight.planets.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {insight.planets.map((planet, idx) => (
                        <div key={idx} className="space-y-2">
                          <h4 className="font-semibold text-accent-ink">
                            {planet.name} in {planet.sign}
                            {planet.house && (
                              <span className="text-accent-ink/50 font-normal text-sm ml-2">
                                ({planet.house})
                              </span>
                            )}
                          </h4>
                          <p className="text-sm text-accent-ink/70 leading-relaxed">
                            {planet.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-accent-ink/50 text-sm">
                      We couldn't tune the planets today. Please try again.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Houses & Life Areas */}
              <Card>
                <CardHeader>
                  <CardTitle>Houses & life arenas</CardTitle>
                  <p className="text-sm text-accent-ink/60">
                    The 12 areas of life in your chart
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {insight.houses && insight.houses.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {insight.houses.map((house, idx) => (
                        <div key={idx} className="space-y-1">
                          <h4 className="font-semibold text-accent-ink text-sm">
                            {house.house} house in {house.signOnCusp}
                          </h4>
                          <p className="text-xs text-accent-ink/70 leading-relaxed">
                            {house.themes}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-accent-ink/50 text-sm">
                      We couldn't tune the houses today. Please try again.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Angles */}
              <Card>
                <CardHeader>
                  <CardTitle>Angles of your chart</CardTitle>
                  <p className="text-sm text-accent-ink/60">
                    The four cardinal points
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {insight.angles ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-accent-ink">
                          Rising / Ascendant in {insight.angles.ascendant.sign}
                        </h4>
                        <p className="text-sm text-accent-ink/70 leading-relaxed">
                          {insight.angles.ascendant.description}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-semibold text-accent-ink">
                          Midheaven in {insight.angles.midheaven.sign}
                        </h4>
                        <p className="text-sm text-accent-ink/70 leading-relaxed">
                          {insight.angles.midheaven.description}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-semibold text-accent-ink">
                          Descendant in {insight.angles.descendant.sign}
                        </h4>
                        <p className="text-sm text-accent-ink/70 leading-relaxed">
                          {insight.angles.descendant.description}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-semibold text-accent-ink">
                          IC (roots) in {insight.angles.ic.sign}
                        </h4>
                        <p className="text-sm text-accent-ink/70 leading-relaxed">
                          {insight.angles.ic.description}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-accent-ink/50 text-sm">
                      We couldn't tune the angles today. Please try again.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Aspects & Dynamics */}
              <Card>
                <CardHeader>
                  <CardTitle>Aspects & inner dynamics</CardTitle>
                  <p className="text-sm text-accent-ink/60">
                    How the planets talk to each other
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {insight.aspects && insight.aspects.length > 0 ? (
                    <div className="space-y-4">
                      {insight.aspects.map((aspect, idx) => (
                        <div key={idx} className="space-y-1 border-l-2 border-accent-gold/30 pl-4">
                          <h4 className="font-semibold text-accent-ink text-sm">
                            {aspect.between}{" "}
                            <span className="text-accent-ink/50 font-normal">({aspect.type})</span>
                          </h4>
                          <p className="text-sm text-accent-ink/70 leading-relaxed">
                            {aspect.impact}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-accent-ink/50 text-sm">
                      We couldn't tune the aspects today. Please try again.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* SECTION 3: PATTERNS & SYNTHESIS */}
            <div className="space-y-6">
              {/* Elements */}
              <Card>
                <CardHeader>
                  <CardTitle>Elemental balance</CardTitle>
                  <p className="text-sm text-accent-ink/60">
                    Fire, Earth, Air, Water
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {insight.patterns?.elements ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center p-3 rounded-lg bg-accent-muted/10">
                          <div className="text-2xl font-bold text-accent-ink">
                            {insight.patterns.elements.fire}
                          </div>
                          <div className="text-xs text-accent-ink/60">Fire</div>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-accent-muted/10">
                          <div className="text-2xl font-bold text-accent-ink">
                            {insight.patterns.elements.earth}
                          </div>
                          <div className="text-xs text-accent-ink/60">Earth</div>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-accent-muted/10">
                          <div className="text-2xl font-bold text-accent-ink">
                            {insight.patterns.elements.air}
                          </div>
                          <div className="text-xs text-accent-ink/60">Air</div>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-accent-muted/10">
                          <div className="text-2xl font-bold text-accent-ink">
                            {insight.patterns.elements.water}
                          </div>
                          <div className="text-xs text-accent-ink/60">Water</div>
                        </div>
                      </div>
                      <p className="text-accent-ink/70 leading-relaxed whitespace-pre-line">
                        {insight.patterns.elements.summary}
                      </p>
                    </>
                  ) : (
                    <p className="text-accent-ink/50 text-sm">
                      We couldn't tune the elements today. Please try again.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Modalities */}
              <Card>
                <CardHeader>
                  <CardTitle>Modality balance</CardTitle>
                  <p className="text-sm text-accent-ink/60">
                    Cardinal, Fixed, Mutable
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {insight.patterns?.modalities ? (
                    <>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center p-3 rounded-lg bg-accent-muted/10">
                          <div className="text-2xl font-bold text-accent-ink">
                            {insight.patterns.modalities.cardinal}
                          </div>
                          <div className="text-xs text-accent-ink/60">Cardinal</div>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-accent-muted/10">
                          <div className="text-2xl font-bold text-accent-ink">
                            {insight.patterns.modalities.fixed}
                          </div>
                          <div className="text-xs text-accent-ink/60">Fixed</div>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-accent-muted/10">
                          <div className="text-2xl font-bold text-accent-ink">
                            {insight.patterns.modalities.mutable}
                          </div>
                          <div className="text-xs text-accent-ink/60">Mutable</div>
                        </div>
                      </div>
                      <p className="text-accent-ink/70 leading-relaxed whitespace-pre-line">
                        {insight.patterns.modalities.summary}
                      </p>
                    </>
                  ) : (
                    <p className="text-accent-ink/50 text-sm">
                      We couldn't tune the modalities today. Please try again.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Chart Ruler & Major Themes */}
              <Card>
                <CardHeader>
                  <CardTitle>Chart ruler & major themes</CardTitle>
                  <p className="text-sm text-accent-ink/60">
                    The lens through which everything flows
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {insight.patterns?.chartRuler ? (
                    <>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-accent-ink">
                          {insight.patterns.chartRuler.planet} in {insight.patterns.chartRuler.sign}{" "}
                          in your {insight.patterns.chartRuler.house}
                        </h4>
                        <p className="text-accent-ink/70 leading-relaxed whitespace-pre-line">
                          {insight.patterns.chartRuler.description}
                        </p>
                      </div>

                      {insight.patterns.majorThemes && (
                        <div className="pt-4 border-t border-border-subtle space-y-2">
                          <h4 className="font-semibold text-accent-ink">Major themes</h4>
                          <p className="text-accent-ink/70 leading-relaxed whitespace-pre-line">
                            {insight.patterns.majorThemes}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-accent-ink/50 text-sm">
                      We couldn't tune the patterns today. Please try again.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
