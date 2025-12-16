"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PublicTarotResponse, TarotSpread } from "@/types";

// Generate UUID using native crypto API
function generateUUID(): string {
  return crypto.randomUUID();
}

// Get user's preferred language (browser default or could be from profile)
function getUserLanguage(): string {
  if (typeof navigator !== "undefined") {
    // Get primary language code (e.g., "en" from "en-US")
    const lang = navigator.language?.split("-")[0];
    if (lang && lang.length >= 2) {
      return lang;
    }
  }
  return "en";
}

const MIN_QUESTION_LENGTH = 10;

const SPREAD_OPTIONS: { value: TarotSpread; label: string; description: string }[] = [
  { value: 1, label: "Single Card", description: "Quick insight" },
  { value: 3, label: "Three Card", description: "Past, Present, Future" },
  { value: 5, label: "Five Card", description: "Deep exploration" },
];

// Scroll element to exact center of viewport
function scrollToCenter(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const absoluteTop = rect.top + window.scrollY;
  const targetY = absoluteTop - window.innerHeight / 2 + rect.height / 2;
  window.scrollTo({ top: targetY, behavior: "smooth" });
}

export function TarotArena() {
  const [question, setQuestion] = useState("");
  const [spread, setSpread] = useState<TarotSpread>(3);
  const [reading, setReading] = useState<PublicTarotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [showGlow, setShowGlow] = useState(false);

  const outputRef = useRef<HTMLDivElement>(null);
  const cooldownInterval = useRef<NodeJS.Timeout | null>(null);

  // Cleanup cooldown interval
  useEffect(() => {
    return () => {
      if (cooldownInterval.current) {
        clearInterval(cooldownInterval.current);
      }
    };
  }, []);

  // Cooldown countdown
  useEffect(() => {
    if (cooldownRemaining > 0) {
      cooldownInterval.current = setInterval(() => {
        setCooldownRemaining((prev) => {
          if (prev <= 1) {
            if (cooldownInterval.current) {
              clearInterval(cooldownInterval.current);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (cooldownInterval.current) {
        clearInterval(cooldownInterval.current);
      }
    };
  }, [cooldownRemaining]);

  const drawCards = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || trimmedQuestion.length < MIN_QUESTION_LENGTH) {
      setError(`Please enter a question (at least ${MIN_QUESTION_LENGTH} characters)`);
      return;
    }

    setLoading(true);
    setError(null);
    setReading(null);
    setShowGlow(false);

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const language = getUserLanguage();
      const requestId = generateUUID();

      const response = await fetch("/api/public-tarot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmedQuestion,
          spread,
          requestId,
          timezone,
          language,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle rate limit / cooldown
        if (response.status === 429) {
          const retryAfter = data.retryAfterSeconds || data.retryAfter || 10;
          setCooldownRemaining(retryAfter);
          setError(data.message || `Please wait ${retryAfter} seconds before drawing again.`);
          return;
        }

        throw new Error(data.message || "Failed to draw cards");
      }

      setReading(data as PublicTarotResponse);

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
      console.error("Error drawing cards:", err);
      setError(err.message || "We couldn't complete your reading. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isDisabled =
    loading ||
    cooldownRemaining > 0 ||
    question.trim().length < MIN_QUESTION_LENGTH;

  return (
    <div className="space-y-8">
      {/* Input Section */}
      <Card className="bg-shell border-accent-gold/20">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl md:text-2xl">Ask the Cards</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Question Input */}
          <div>
            <label htmlFor="tarot-question" className="micro-label mb-2 block">
              YOUR QUESTION
            </label>
            <textarea
              id="tarot-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What would you like guidance on today?"
              className="w-full min-h-[100px] p-4 rounded-lg border border-border-subtle bg-white text-base text-accent-ink placeholder:text-accent-ink/50 focus:outline-none focus:ring-2 focus:ring-accent-gold/30 focus:border-accent-gold resize-none"
              maxLength={500}
              disabled={loading}
            />
            <div className="flex justify-between mt-1">
              <p className="text-xs text-accent-ink/50">
                {question.trim().length < MIN_QUESTION_LENGTH
                  ? `${MIN_QUESTION_LENGTH - question.trim().length} more characters needed`
                  : ""}
              </p>
              <p className="text-xs text-accent-ink/50">{question.length}/500</p>
            </div>
          </div>

          {/* Spread Selector */}
          <div>
            <p className="micro-label mb-3">CHOOSE YOUR SPREAD</p>
            <div className="flex flex-wrap gap-3">
              {SPREAD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSpread(option.value)}
                  disabled={loading}
                  className={`pill px-4 py-3 min-h-[52px] text-sm transition-all flex flex-col items-center ${
                    spread === option.value
                      ? "bg-accent-gold text-white"
                      : "bg-white border border-border-subtle text-accent-ink/70 hover:border-accent-gold/50"
                  } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span className="font-medium">{option.label}</span>
                  <span className="text-xs opacity-70">{option.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Draw Button */}
          <div className="pt-2">
            <Button
              variant="gold"
              onClick={drawCards}
              disabled={isDisabled}
              className="w-full min-h-[52px] text-base"
            >
              {loading
                ? "Drawing Cards..."
                : cooldownRemaining > 0
                ? `Wait ${cooldownRemaining}s...`
                : "Draw Cards"}
            </Button>
          </div>

          {/* Error Message */}
          {error && !loading && (
            <p className="text-center text-red-600 text-sm">{error}</p>
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
                <div className="flex justify-center gap-4 mb-8">
                  {Array.from({ length: spread }).map((_, i) => (
                    <div
                      key={i}
                      className="w-16 h-24 md:w-20 md:h-32 bg-accent-muted rounded-lg"
                    />
                  ))}
                </div>
                <div className="h-4 bg-accent-muted rounded w-3/4 mx-auto" />
                <div className="h-4 bg-accent-muted rounded w-full" />
                <div className="h-4 bg-accent-muted rounded w-5/6 mx-auto" />
              </div>
              <p className="text-center text-accent-ink/60 mt-6">
                Shuffling the deck...
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
              <CardTitle className="text-xl md:text-2xl">Your Reading</CardTitle>
              <p className="text-sm text-accent-ink/60 italic">"{reading.question}"</p>
            </CardHeader>

            <CardContent className="space-y-8">
              {/* Drawn Cards Visual */}
              <div className="flex flex-wrap justify-center gap-4">
                {reading.drawnCards.map((card, i) => {
                  const interpretation = reading.interpretation.cards[i];
                  return (
                    <div
                      key={i}
                      className="flex flex-col items-center text-center"
                    >
                      <div
                        className={`w-20 h-32 md:w-24 md:h-40 bg-gradient-to-b from-accent-gold/20 to-accent-gold/5 border-2 border-accent-gold/30 rounded-lg flex items-center justify-center mb-2 ${
                          card.reversed ? "rotate-180" : ""
                        }`}
                      >
                        <span className="text-3xl md:text-4xl">
                          {card.cardId.startsWith("major") ? "+" : "*"}
                        </span>
                      </div>
                      <p className="font-medium text-accent-ink text-sm md:text-base max-w-[100px]">
                        {interpretation?.cardName || card.cardId}
                      </p>
                      <p className="text-xs text-accent-ink/60">{card.position}</p>
                      {card.reversed && (
                        <p className="text-xs text-accent-gold italic">Reversed</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Card Interpretations */}
              <div className="space-y-6">
                {reading.interpretation.cards.map((card, i) => (
                  <div key={i} className="border-l-2 border-accent-gold/30 pl-4">
                    <h4 className="font-semibold text-accent-ink">
                      {card.cardName}
                      {card.reversed && (
                        <span className="text-accent-gold ml-2 text-sm">(Reversed)</span>
                      )}
                    </h4>
                    <p className="micro-label mt-1">{card.position}</p>
                    <p className="text-accent-ink/80 mt-2 leading-relaxed">
                      {card.meaning}
                    </p>
                  </div>
                ))}
              </div>

              {/* Synthesis */}
              <div>
                <p className="micro-label mb-3">THE BIGGER PICTURE</p>
                <div className="text-accent-ink/80 leading-relaxed space-y-4">
                  {reading.interpretation.synthesis.split("\n\n").map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </div>

              {/* Action Steps */}
              {reading.interpretation.actionSteps.length > 0 && (
                <div>
                  <p className="micro-label mb-3">SUGGESTED ACTIONS</p>
                  <ul className="space-y-2">
                    {reading.interpretation.actionSteps.map((step, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 text-accent-ink/80"
                      >
                        <span className="text-accent-gold font-bold">*</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Reflection Question */}
              {reading.interpretation.reflectionQuestion && (
                <div className="bg-accent-gold/5 border border-accent-gold/20 rounded-lg p-4">
                  <p className="micro-label mb-2">REFLECTION</p>
                  <p className="text-accent-ink italic">
                    "{reading.interpretation.reflectionQuestion}"
                  </p>
                </div>
              )}

              {/* CTA for sign up - quiet, no birth chart mention */}
              <div className="pt-6 border-t border-border-subtle text-center space-y-3">
                <p className="text-sm text-accent-ink/60">
                  Want deeper, more personalized readings?
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
