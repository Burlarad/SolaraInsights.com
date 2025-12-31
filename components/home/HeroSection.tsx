"use client";

import { SolaraLogo } from "@/components/layout/SolaraLogo";
import { PrimaryCTA } from "@/components/shared/PrimaryCTA";
import { TogglePills } from "@/components/shared/TogglePills";
import { TIMEFRAMES, EXPERIENCES } from "@/lib/constants";

type Experience = "Horoscope" | "Tarot" | "Compatibility";
type Timeframe = "Today" | "Week" | "Month";

interface HeroSectionProps {
  experience: Experience;
  timeframe: Timeframe;
  onExperienceChange: (value: Experience) => void;
  onTimeframeChange: (value: Timeframe) => void;
}

export function HeroSection({
  experience,
  timeframe,
  onExperienceChange,
  onTimeframeChange,
}: HeroSectionProps) {
  return (
    <section className="max-w-5xl mx-auto px-6 py-16 text-center">
      {/* Logo + wordmark + tagline */}
      <SolaraLogo size="lg" className="mb-8" />

      {/* Primary CTA */}
      <div className="mb-12">
        <PrimaryCTA href="/sanctuary">ENTER SANCTUARY</PrimaryCTA>
      </div>

      {/* Toggles */}
      <div className="space-y-6 mb-12">
        {/* Choose Your Experience - FIRST */}
        <div>
          <p className="micro-label mb-3">CHOOSE YOUR EXPERIENCE</p>
          <TogglePills
            options={[...EXPERIENCES]}
            value={experience}
            onChange={(val) => onExperienceChange(val as Experience)}
          />
        </div>

        {/* Daily Alignment - ONLY shown for Horoscope */}
        {experience === "Horoscope" && (
          <div>
            <p className="micro-label mb-3">DAILY ALIGNMENT</p>
            <TogglePills
              options={[...TIMEFRAMES]}
              value={timeframe}
              onChange={(val) => onTimeframeChange(val as Timeframe)}
            />
          </div>
        )}
      </div>

      {/* Section heading - varies by experience */}
      <div className="mb-8">
        {experience === "Tarot" ? (
          <>
            <h2 className="text-3xl font-semibold mb-2">Ask the Cards</h2>
            <p className="text-base text-accent-ink/70">
              Enter your question and draw your spread.
            </p>
          </>
        ) : experience === "Compatibility" ? (
          <>
            <h2 className="text-3xl font-semibold mb-2">Explore Compatibility</h2>
            <p className="text-base text-accent-ink/70">
              Select two signs to discover their cosmic connection.
            </p>
          </>
        ) : (
          <h2 className="text-3xl font-semibold">Choose your sign</h2>
        )}
      </div>
    </section>
  );
}
