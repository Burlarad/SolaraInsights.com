"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ZodiacCard } from "./ZodiacCard";
import { ZODIAC_SIGNS, type ExperienceKey, type TimeframeKey } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PublicHoroscopeResponse } from "@/types";

interface ZodiacGridProps {
  timeframe: TimeframeKey;
  experience: ExperienceKey;
}

function scrollToCenter(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const absoluteTop = rect.top + window.scrollY;
  const targetY = absoluteTop - window.innerHeight / 2 + rect.height / 2;
  window.scrollTo({ top: targetY, behavior: "smooth" });
}

export function ZodiacGrid({ timeframe, experience }: ZodiacGridProps) {
  const t = useTranslations("common");
  const tSigns = useTranslations("zodiacSigns");
  const tTime = useTranslations("sanctuary.timeframes");
  const locale = useLocale();

  const [selectedSign, setSelectedSign] = useState<(typeof ZODIAC_SIGNS)[number] | null>(null);
  const [horoscope, setHoroscope] = useState<PublicHoroscopeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGlow, setShowGlow] = useState(false);

  const horoscopeRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const loadHoroscope = useCallback(async (signKey: string, tf: TimeframeKey) => {
    // Abort any in-flight request to prevent stampede
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const response = await fetch("/api/public-horoscope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sign: signKey,
          timeframe: tf,
          timezone,
          language: locale,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to load horoscope");
      }

      const data: PublicHoroscopeResponse = await response.json();
      setHoroscope(data);
    } catch (err: unknown) {
      // Ignore AbortError (expected when request is cancelled)
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(t("errors.horoscopeLoadFailed") || "We couldn't open this reading. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [locale, t]);

  const handleSignClick = (sign: (typeof ZODIAC_SIGNS)[number]) => {
    setSelectedSign(sign);
    setHoroscope(null);
    setError(null);
    setShowGlow(false);

    if (experience === "horoscope") {
      loadHoroscope(sign.key, timeframe);
    }

    requestAnimationFrame(() => {
      if (horoscopeRef.current) {
        scrollToCenter(horoscopeRef.current);
        setTimeout(() => {
          setShowGlow(true);
          setTimeout(() => setShowGlow(false), 1000);
        }, 300);
      }
    });
  };

  const prevTimeframeRef = useRef(timeframe);
  if (prevTimeframeRef.current !== timeframe) {
    prevTimeframeRef.current = timeframe;
    if (selectedSign && experience === "horoscope") {
      loadHoroscope(selectedSign.key, timeframe);
    }
  }

  // Refetch horoscope when locale changes (user switched language)
  const prevLocaleRef = useRef(locale);
  useEffect(() => {
    if (prevLocaleRef.current !== locale) {
      prevLocaleRef.current = locale;
      if (selectedSign && experience === "horoscope" && horoscope) {
        loadHoroscope(selectedSign.key, timeframe);
      }
    }
  }, [locale, selectedSign, experience, horoscope, timeframe, loadHoroscope]);

  const handleTryAgain = () => {
    if (selectedSign) {
      loadHoroscope(selectedSign.key, timeframe);
    }
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 space-y-12">
      <div ref={horoscopeRef}>
        {selectedSign && experience === "horoscope" && (
          <Card
            className={`bg-shell border-accent-gold/20 animate-in fade-in-50 duration-300 transition-shadow ${
              showGlow ? "ring-2 ring-accent-gold/50 shadow-[0_0_20px_rgba(212,175,55,0.3)]" : ""
            }`}
          >
            <CardHeader className="pb-4">
              <CardTitle className="text-xl md:text-2xl">
                {loading
                  ? "Tuning your reading..."
                  : horoscope
                    ? horoscope.title
                    : `${tSigns(selectedSign.key)} ${tTime(timeframe)}`}
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-0">
              {loading && (
                <div className="space-y-4 animate-pulse py-4">
                  <div className="h-4 bg-accent-muted rounded w-3/4"></div>
                  <div className="h-4 bg-accent-muted rounded w-full"></div>
                  <div className="h-4 bg-accent-muted rounded w-5/6"></div>
                  <div className="h-4 bg-accent-muted rounded w-2/3"></div>
                </div>
              )}

              {error && !loading && (
                <div className="text-center py-8 space-y-4">
                  <p className="text-accent-ink/70">{error}</p>
                  <Button variant="outline" onClick={handleTryAgain} className="min-h-[44px]">
                    {t("tryAgain")}
                  </Button>
                </div>
              )}

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

        {selectedSign && experience === "tarot" && (
          <Card className="bg-shell border-accent-gold/20 animate-in fade-in-50 duration-300">
            <CardContent className="py-12 text-center">
              <p className="text-lg text-accent-ink/70">
                Tarot readings coming soon for {tSigns(selectedSign.key)}
              </p>
            </CardContent>
          </Card>
        )}

        {selectedSign && experience === "compatibility" && (
          <Card className="bg-shell border-accent-gold/20 animate-in fade-in-50 duration-300">
            <CardContent className="py-12 text-center">
              <p className="text-lg text-accent-ink/70">
                Compatibility insights coming soon for {tSigns(selectedSign.key)}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {ZODIAC_SIGNS.map((sign) => (
          <ZodiacCard
            key={sign.key}
            signKey={sign.key}
            symbol={sign.symbol}
            isSelected={selectedSign?.key === sign.key}
            onClick={() => handleSignClick(sign)}
          />
        ))}
      </div>
    </section>
  );
}
