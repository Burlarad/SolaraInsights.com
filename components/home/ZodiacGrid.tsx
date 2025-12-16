"use client";

import { useState, useRef, useCallback } from "react";
import { ZodiacCard } from "./ZodiacCard";
import { ZODIAC_SIGNS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PublicHoroscopeResponse } from "@/types";

type Experience = "Horoscope" | "Tarot" | "Compatibility";
type Timeframe = "Today" | "Week" | "Month";
type ApiTimeframe = "today" | "week" | "month";

interface ZodiacGridProps {
  timeframe: Timeframe;
  experience: Experience;
}

// Convert display timeframe to API timeframe
function toApiTimeframe(tf: Timeframe): ApiTimeframe {
  return tf.toLowerCase() as ApiTimeframe;
}

// Scroll element to exact center of viewport
function scrollToCenter(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const absoluteTop = rect.top + window.scrollY;
  const targetY = absoluteTop - window.innerHeight / 2 + rect.height / 2;
  window.scrollTo({ top: targetY, behavior: "smooth" });
}

export function ZodiacGrid({ timeframe, experience }: ZodiacGridProps) {
  const [selectedSign, setSelectedSign] = useState<typeof ZODIAC_SIGNS[number] | null>(null);
  const [horoscope, setHoroscope] = useState<PublicHoroscopeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGlow, setShowGlow] = useState(false);

  // Ref for scroll-to behavior
  const horoscopeRef = useRef<HTMLDivElement>(null);

  const loadHoroscope = useCallback(async (signKey: string, tf: Timeframe) => {
    setLoading(true);
    setError(null);

    try {
      // Get user's timezone for cache key
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const response = await fetch("/api/public-horoscope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sign: signKey,
          timeframe: toApiTimeframe(tf),
          timezone,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to load horoscope");
      }

      const data: PublicHoroscopeResponse = await response.json();
      setHoroscope(data);
    } catch (err: any) {
      console.error("Error loading horoscope:", err);
      setError("We couldn't open this reading. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSignClick = (sign: typeof ZODIAC_SIGNS[number]) => {
    setSelectedSign(sign);
    setHoroscope(null);
    setError(null);
    setShowGlow(false);

    if (experience === "Horoscope") {
      loadHoroscope(sign.key, timeframe);
    }

    // Scroll to horoscope section with exact center calculation + glow
    requestAnimationFrame(() => {
      if (horoscopeRef.current) {
        scrollToCenter(horoscopeRef.current);
        // Trigger glow animation after scroll starts
        setTimeout(() => {
          setShowGlow(true);
          // Remove glow after animation completes
          setTimeout(() => setShowGlow(false), 1000);
        }, 300);
      }
    });
  };

  // Reload when timeframe changes (only if sign is selected and experience is Horoscope)
  const handleTimeframeReload = useCallback(() => {
    if (selectedSign && experience === "Horoscope") {
      loadHoroscope(selectedSign.key, timeframe);
    }
  }, [selectedSign, experience, timeframe, loadHoroscope]);

  // Effect: reload when timeframe changes
  const prevTimeframeRef = useRef(timeframe);
  if (prevTimeframeRef.current !== timeframe) {
    prevTimeframeRef.current = timeframe;
    if (selectedSign && experience === "Horoscope") {
      loadHoroscope(selectedSign.key, timeframe);
    }
  }

  const handleTryAgain = () => {
    if (selectedSign) {
      loadHoroscope(selectedSign.key, timeframe);
    }
  };

  const timeframeLabel =
    timeframe === "Today" ? "Today" : timeframe === "Week" ? "Week" : "Month";

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-12">
      {/* Zodiac grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {ZODIAC_SIGNS.map((sign) => (
          <ZodiacCard
            key={sign.key}
            name={sign.name}
            symbol={sign.symbol}
            isSelected={selectedSign?.key === sign.key}
            onClick={() => handleSignClick(sign)}
          />
        ))}
      </div>

      {/* Horoscope reading section (inline, not modal) */}
      <div ref={horoscopeRef}>
        {/* Only show when a sign is selected AND experience is Horoscope */}
        {selectedSign && experience === "Horoscope" && (
          <Card
            className={`bg-shell border-accent-gold/20 animate-in fade-in-50 duration-300 transition-shadow ${
              showGlow ? "ring-2 ring-accent-gold/50 shadow-[0_0_20px_rgba(212,175,55,0.3)]" : ""
            }`}
          >
            <CardHeader className="pb-4">
              <div className="space-y-4">
                {/* Title */}
                <CardTitle className="text-xl md:text-2xl">
                  {loading
                    ? "Tuning your reading..."
                    : horoscope
                    ? horoscope.title
                    : `${selectedSign.name} ${timeframeLabel}`}
                </CardTitle>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {/* Loading state */}
              {loading && (
                <div className="space-y-4 animate-pulse py-4">
                  <div className="h-4 bg-accent-muted rounded w-3/4"></div>
                  <div className="h-4 bg-accent-muted rounded w-full"></div>
                  <div className="h-4 bg-accent-muted rounded w-5/6"></div>
                  <div className="h-4 bg-accent-muted rounded w-2/3"></div>
                </div>
              )}

              {/* Error state */}
              {error && !loading && (
                <div className="text-center py-8 space-y-4">
                  <p className="text-accent-ink/70">{error}</p>
                  <Button variant="outline" onClick={handleTryAgain} className="min-h-[44px]">
                    Try again
                  </Button>
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
                            className="pill bg-white text-accent-ink text-sm border border-border-subtle min-h-[44px] px-4 flex items-center"
                          >
                            {theme}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* CTA for sign up */}
                  <div className="pt-6 border-t border-border-subtle text-center space-y-3">
                    <p className="text-sm text-accent-ink/60">
                      Want a personalized reading based on your birth chart?
                    </p>
                    <Button variant="gold" asChild className="min-h-[48px]">
                      <a href="/join">Join Solara</a>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Tarot placeholder */}
        {selectedSign && experience === "Tarot" && (
          <Card className="bg-shell border-accent-gold/20 animate-in fade-in-50 duration-300">
            <CardContent className="py-12 text-center">
              <p className="text-lg text-accent-ink/70">
                Tarot readings coming soon for {selectedSign.name}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Compatibility placeholder */}
        {selectedSign && experience === "Compatibility" && (
          <Card className="bg-shell border-accent-gold/20 animate-in fade-in-50 duration-300">
            <CardContent className="py-12 text-center">
              <p className="text-lg text-accent-ink/70">
                Compatibility insights coming soon for {selectedSign.name}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Empty state when no sign selected */}
        {!selectedSign && (
          <div className="text-center py-12 text-accent-ink/50">
            <p className="text-lg">Select a zodiac sign above to see your reading</p>
          </div>
        )}
      </div>
    </section>
  );
}
