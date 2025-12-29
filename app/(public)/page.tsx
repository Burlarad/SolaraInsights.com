"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { HeroSection } from "@/components/home/HeroSection";
import { ZodiacGrid } from "@/components/home/ZodiacGrid";
import { TarotArena } from "@/components/home/TarotArena";
import { CompatibilityArena } from "@/components/home/CompatibilityArena";
import { SolaraPath } from "@/components/home/SolaraPath";

type Experience = "Horoscope" | "Tarot" | "Compatibility";
type Timeframe = "Today" | "Week" | "Month";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Single source of truth for experience and timeframe
  const [experience, setExperience] = useState<Experience>("Horoscope");
  const [timeframe, setTimeframe] = useState<Timeframe>("Today");

  // Account deletion confirmation
  const [showDeletedBanner, setShowDeletedBanner] = useState(false);

  useEffect(() => {
    if (searchParams.get("deleted") === "true") {
      setShowDeletedBanner(true);
      // Clean the URL after a short delay
      const timeout = setTimeout(() => {
        router.replace("/");
      }, 100);
      // Hide banner after 5 seconds
      const hideBanner = setTimeout(() => {
        setShowDeletedBanner(false);
      }, 5000);
      return () => {
        clearTimeout(timeout);
        clearTimeout(hideBanner);
      };
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen">
      {/* Account deletion confirmation banner */}
      {showDeletedBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg text-sm font-medium">
          Account deleted. You&apos;ve been signed out.
        </div>
      )}
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

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <HomeContent />
    </Suspense>
  );
}
