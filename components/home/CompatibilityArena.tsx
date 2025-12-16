"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ZODIAC_SIGNS } from "@/lib/constants";
import { PublicCompatibilityResponse } from "@/types";

// Generate UUID using native crypto API
function generateUUID(): string {
  return crypto.randomUUID();
}

// Scroll element to exact center of viewport
function scrollToCenter(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const absoluteTop = rect.top + window.scrollY;
  const targetY = absoluteTop - window.innerHeight / 2 + rect.height / 2;
  window.scrollTo({ top: targetY, behavior: "smooth" });
}

export function CompatibilityArena() {
  const [signA, setSignA] = useState<string>("");
  const [signB, setSignB] = useState<string>("");
  const [reading, setReading] = useState<PublicCompatibilityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [showGlow, setShowGlow] = useState(false);

  const outputRef = useRef<HTMLDivElement>(null);
  const cooldownInterval = useRef<NodeJS.Timeout | null>(null);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastPairRef = useRef<string>("");
  const requestIdRef = useRef<string>("");

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (cooldownInterval.current) clearInterval(cooldownInterval.current);
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
    };
  }, []);

  // Cooldown countdown
  useEffect(() => {
    if (cooldownRemaining > 0) {
      cooldownInterval.current = setInterval(() => {
        setCooldownRemaining((prev) => {
          if (prev <= 1) {
            if (cooldownInterval.current) clearInterval(cooldownInterval.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (cooldownInterval.current) clearInterval(cooldownInterval.current);
    };
  }, [cooldownRemaining]);

  // Fetch compatibility reading
  const fetchCompatibility = useCallback(async (a: string, b: string) => {
    // Generate a new requestId for idempotency
    const requestId = generateUUID();
    requestIdRef.current = requestId;

    setLoading(true);
    setError(null);
    setShowGlow(false);

    try {
      const response = await fetch("/api/public-compatibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signA: a,
          signB: b,
          requestId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle rate limit / cooldown
        if (response.status === 429) {
          const retryAfter = data.retryAfterSeconds || 10;
          setCooldownRemaining(retryAfter);
          setError(data.message || `Please wait ${retryAfter} seconds.`);
          return;
        }

        throw new Error(data.message || "Failed to load compatibility");
      }

      setReading(data as PublicCompatibilityResponse);

      // Scroll to output with glow
      requestAnimationFrame(() => {
        if (outputRef.current) {
          scrollToCenter(outputRef.current);
          setTimeout(() => {
            setShowGlow(true);
            setTimeout(() => setShowGlow(false), 1000);
          }, 300);
        }
      });
    } catch (err: any) {
      console.error("Error loading compatibility:", err);
      setError(err.message || "We couldn't load the reading. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-generate when both signs are selected (debounced)
  useEffect(() => {
    // Clear any pending debounce
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    // Both signs must be selected
    if (!signA || !signB) {
      return;
    }

    // Create pair key to check if it changed
    const pairKey = [signA, signB].sort().join("__");

    // Don't refetch if same pair
    if (pairKey === lastPairRef.current) {
      return;
    }

    // Don't fetch during cooldown
    if (cooldownRemaining > 0) {
      return;
    }

    // Debounce by 300ms
    debounceTimeout.current = setTimeout(() => {
      lastPairRef.current = pairKey;
      fetchCompatibility(signA, signB);
    }, 300);

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, [signA, signB, cooldownRemaining, fetchCompatibility]);

  const handleSignAChange = (value: string) => {
    setSignA(value);
    setReading(null);
    setError(null);
  };

  const handleSignBChange = (value: string) => {
    setSignB(value);
    setReading(null);
    setError(null);
  };

  const handleTryAgain = () => {
    if (signA && signB) {
      lastPairRef.current = ""; // Reset to allow refetch
      fetchCompatibility(signA, signB);
    }
  };

  return (
    <div className="space-y-8">
      {/* Input Section */}
      <Card className="bg-shell border-accent-gold/20">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl md:text-2xl">Explore Compatibility</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sign Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Your Sign */}
            <div>
              <label htmlFor="sign-a" className="micro-label mb-2 block">
                YOUR SIGN
              </label>
              <select
                id="sign-a"
                value={signA}
                onChange={(e) => handleSignAChange(e.target.value)}
                disabled={loading}
                className="w-full p-4 rounded-lg border border-border-subtle bg-white text-base text-accent-ink focus:outline-none focus:ring-2 focus:ring-accent-gold/30 focus:border-accent-gold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select your sign</option>
                {ZODIAC_SIGNS.map((sign) => (
                  <option key={sign.key} value={sign.key}>
                    {sign.symbol} {sign.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Their Sign */}
            <div>
              <label htmlFor="sign-b" className="micro-label mb-2 block">
                THEIR SIGN
              </label>
              <select
                id="sign-b"
                value={signB}
                onChange={(e) => handleSignBChange(e.target.value)}
                disabled={loading}
                className="w-full p-4 rounded-lg border border-border-subtle bg-white text-base text-accent-ink focus:outline-none focus:ring-2 focus:ring-accent-gold/30 focus:border-accent-gold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select their sign</option>
                {ZODIAC_SIGNS.map((sign) => (
                  <option key={sign.key} value={sign.key}>
                    {sign.symbol} {sign.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Messages */}
          {cooldownRemaining > 0 && (
            <p className="text-center text-accent-ink/60 text-sm">
              Please wait {cooldownRemaining}s before requesting again...
            </p>
          )}

          {error && !loading && (
            <div className="text-center space-y-3">
              <p className="text-red-600 text-sm">{error}</p>
              <Button
                variant="outline"
                onClick={handleTryAgain}
                disabled={cooldownRemaining > 0}
                className="min-h-[44px]"
              >
                Try again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Output Section */}
      <div ref={outputRef}>
        {/* Loading State */}
        {loading && (
          <Card className="bg-shell border-accent-gold/20 animate-in fade-in-50 duration-300">
            <CardContent className="py-12">
              <div className="space-y-4 animate-pulse">
                <div className="h-6 bg-accent-muted rounded w-2/3 mx-auto" />
                <div className="h-4 bg-accent-muted rounded w-full" />
                <div className="h-4 bg-accent-muted rounded w-5/6" />
                <div className="h-4 bg-accent-muted rounded w-4/5" />
                <div className="h-4 bg-accent-muted rounded w-full" />
              </div>
              <p className="text-center text-accent-ink/60 mt-6">
                Consulting the stars...
              </p>
            </CardContent>
          </Card>
        )}

        {/* Reading Output */}
        {reading && !loading && (
          <Card
            className={`bg-shell border-accent-gold/20 animate-in fade-in-50 duration-300 transition-shadow ${
              showGlow
                ? "ring-2 ring-accent-gold/50 shadow-[0_0_20px_rgba(212,175,55,0.3)]"
                : ""
            }`}
          >
            <CardHeader className="pb-4">
              <CardTitle className="text-xl md:text-2xl">{reading.title}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-8">
              {/* Summary */}
              <div className="text-accent-ink/80 leading-relaxed space-y-4">
                {reading.summary.split("\n\n").map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>

              {/* Strengths */}
              {reading.strengths.length > 0 && (
                <div>
                  <p className="micro-label mb-3">STRENGTHS</p>
                  <ul className="space-y-2">
                    {reading.strengths.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-accent-ink/80">
                        <span className="text-green-600 font-bold">+</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Friction Points */}
              {reading.frictionPoints.length > 0 && (
                <div>
                  <p className="micro-label mb-3">POTENTIAL FRICTION</p>
                  <ul className="space-y-2">
                    {reading.frictionPoints.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-accent-ink/80">
                        <span className="text-amber-600 font-bold">~</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* How to Make It Work */}
              {reading.howToMakeItWork.length > 0 && (
                <div>
                  <p className="micro-label mb-3">HOW TO MAKE IT WORK</p>
                  <ul className="space-y-2">
                    {reading.howToMakeItWork.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-accent-ink/80">
                        <span className="text-accent-gold font-bold">*</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Communication Style */}
              <div>
                <p className="micro-label mb-3">COMMUNICATION STYLE</p>
                <div className="text-accent-ink/80 leading-relaxed space-y-4">
                  {reading.communicationStyle.split("\n\n").map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>

              {/* Love & Intimacy */}
              <div>
                <p className="micro-label mb-3">LOVE & INTIMACY</p>
                <div className="text-accent-ink/80 leading-relaxed space-y-4">
                  {reading.loveAndIntimacy.split("\n\n").map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>

              {/* Trust & Security */}
              <div>
                <p className="micro-label mb-3">TRUST & SECURITY</p>
                <div className="text-accent-ink/80 leading-relaxed space-y-4">
                  {reading.trustAndSecurity.split("\n\n").map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>

              {/* Long-Term Potential */}
              <div>
                <p className="micro-label mb-3">LONG-TERM POTENTIAL</p>
                <div className="text-accent-ink/80 leading-relaxed space-y-4">
                  {reading.longTermPotential.split("\n\n").map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>

              {/* Best Move This Week */}
              <div className="bg-accent-gold/5 border border-accent-gold/20 rounded-lg p-4">
                <p className="micro-label mb-2">BEST MOVE THIS WEEK</p>
                <p className="text-accent-ink italic">{reading.bestMoveThisWeek}</p>
              </div>

              {/* CTA for sign up */}
              <div className="pt-6 border-t border-border-subtle text-center space-y-3">
                <p className="text-sm text-accent-ink/60">
                  Want personalized compatibility based on your full birth charts?
                </p>
                <Button variant="gold" asChild className="min-h-[48px]">
                  <a href="/join">Join Solara</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
