"use client";

import { useState } from "react";
import { HeroSection } from "@/components/home/HeroSection";
import { ZodiacGrid } from "@/components/home/ZodiacGrid";
import { TarotArena } from "@/components/home/TarotArena";
import { CompatibilityArena } from "@/components/home/CompatibilityArena";
import { SolaraPath } from "@/components/home/SolaraPath";

type Experience = "Horoscope" | "Tarot" | "Compatibility";
type Timeframe = "Today" | "Week" | "Month";

export default function HomePage() {
  // Single source of truth for experience and timeframe
  const [experience, setExperience] = useState<Experience>("Horoscope");
  const [timeframe, setTimeframe] = useState<Timeframe>("Today");

  return (
    <div className="min-h-screen">
      <HeroSection
        experience={experience}
        timeframe={timeframe}
        onExperienceChange={setExperience}
        onTimeframeChange={setTimeframe}
      />

      {/* Conditionally render content based on experience */}
      {experience === "Tarot" ? (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
          <TarotArena />
        </section>
      ) : experience === "Compatibility" ? (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
          <CompatibilityArena />
        </section>
      ) : (
        <ZodiacGrid timeframe={timeframe} experience={experience} />
      )}

      <SolaraPath />
    </div>
  );
}
