"use client";

import { useState } from "react";
import { ZodiacCard } from "./ZodiacCard";
import { ZODIAC_SIGNS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PublicHoroscopeResponse } from "@/types";

type Timeframe = "today" | "week" | "month";

export function ZodiacGrid() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSign, setSelectedSign] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("today");
  const [horoscope, setHoroscope] = useState<PublicHoroscopeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHoroscope = async (sign: string, timeframeValue: Timeframe) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/public-horoscope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sign, timeframe: timeframeValue }),
      });

      if (!response.ok) {
        throw new Error("Failed to load horoscope");
      }

      const data: PublicHoroscopeResponse = await response.json();
      setHoroscope(data);
    } catch (err: any) {
      console.error("Error loading horoscope:", err);
      setError("We couldn't open this reading. Please try another sign.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignClick = (signName: string) => {
    setSelectedSign(signName);
    setIsModalOpen(true);
    setTimeframe("today");
    setHoroscope(null);
    setError(null);
    loadHoroscope(signName, "today");
  };

  const handleTimeframeChange = (newTimeframe: Timeframe) => {
    setTimeframe(newTimeframe);
    if (selectedSign) {
      loadHoroscope(selectedSign, newTimeframe);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedSign(null);
    setHoroscope(null);
    setError(null);
  };

  const timeframeLabel =
    timeframe === "today" ? "Today" : timeframe === "week" ? "Week" : "Month";

  return (
    <>
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {ZODIAC_SIGNS.map((sign) => (
            <ZodiacCard
              key={sign.key}
              name={sign.name}
              symbol={sign.symbol}
              onClick={() => handleSignClick(sign.name)}
            />
          ))}
        </div>
      </section>

      {/* Horoscope Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="bg-shell">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {loading && (
                      <CardTitle className="text-2xl">
                        Tuning your open reading...
                      </CardTitle>
                    )}
                    {horoscope && !loading && (
                      <CardTitle className="text-2xl">{horoscope.title}</CardTitle>
                    )}
                    {error && !loading && (
                      <CardTitle className="text-2xl">
                        {selectedSign} {timeframeLabel}
                      </CardTitle>
                    )}
                  </div>
                  <button
                    onClick={closeModal}
                    className="text-accent-ink/60 hover:text-accent-ink text-2xl leading-none"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                {/* Timeframe toggle */}
                <div className="flex gap-2 mt-4">
                  {(["today", "week", "month"] as Timeframe[]).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => handleTimeframeChange(tf)}
                      className={`pill px-4 py-2 text-sm transition-colors ${
                        timeframe === tf
                          ? "bg-accent-gold text-white"
                          : "bg-white border border-border-subtle text-accent-ink/70 hover:border-accent-gold/50"
                      }`}
                    >
                      {tf === "today" ? "Today" : tf === "week" ? "Week" : "Month"}
                    </button>
                  ))}
                </div>
              </CardHeader>

              <CardContent>
                {/* Loading state */}
                {loading && (
                  <div className="space-y-4 animate-pulse">
                    <div className="h-4 bg-accent-muted rounded w-3/4"></div>
                    <div className="h-4 bg-accent-muted rounded w-full"></div>
                    <div className="h-4 bg-accent-muted rounded w-5/6"></div>
                  </div>
                )}

                {/* Error state */}
                {error && !loading && (
                  <div className="text-center py-8">
                    <p className="text-accent-ink/70">{error}</p>
                  </div>
                )}

                {/* Content state */}
                {horoscope && !loading && !error && (
                  <div className="space-y-6">
                    <div className="text-accent-ink/80 leading-relaxed space-y-4">
                      {horoscope.summary.split("\n\n").map((paragraph, i) => (
                        <p key={i}>{paragraph}</p>
                      ))}
                    </div>

                    {horoscope.keyThemes && horoscope.keyThemes.length > 0 && (
                      <div>
                        <p className="micro-label mb-3">KEY THEMES</p>
                        <div className="flex flex-wrap gap-2">
                          {horoscope.keyThemes.map((theme, i) => (
                            <span
                              key={i}
                              className="pill bg-white text-accent-ink text-sm border border-border-subtle"
                            >
                              {theme}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-4 border-t border-border-subtle">
                      <Button
                        variant="outline"
                        onClick={closeModal}
                        className="w-full"
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
