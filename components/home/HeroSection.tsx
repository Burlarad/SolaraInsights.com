"use client";

import { useState } from "react";
import { SolaraLogo } from "@/components/layout/SolaraLogo";
import { PrimaryCTA } from "@/components/shared/PrimaryCTA";
import { TogglePills } from "@/components/shared/TogglePills";
import { TIMEFRAMES, EXPERIENCES } from "@/lib/constants";

export function HeroSection() {
  const [timeframe, setTimeframe] = useState<string>("Today");
  const [experience, setExperience] = useState<string>("Horoscope");

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
        {/* Daily Alignment */}
        <div>
          <p className="micro-label mb-3">DAILY ALIGNMENT</p>
          <TogglePills
            options={[...TIMEFRAMES]}
            value={timeframe}
            onChange={setTimeframe}
          />
        </div>

        {/* Choose Your Experience */}
        <div>
          <p className="micro-label mb-3">CHOOSE YOUR EXPERIENCE</p>
          <TogglePills
            options={[...EXPERIENCES]}
            value={experience}
            onChange={setExperience}
          />
        </div>
      </div>

      {/* Choose your sign heading */}
      <div className="mb-8">
        <h2 className="text-3xl font-semibold mb-2">Choose your sign</h2>
        <p className="text-base text-accent-ink/70">
          Select a sign to receive {timeframe.toLowerCase()}&apos;s reading.
        </p>
      </div>
    </section>
  );
}
