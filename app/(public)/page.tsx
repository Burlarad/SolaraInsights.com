"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { HeroSection } from "@/components/home/HeroSection";
import { ZodiacGrid } from "@/components/home/ZodiacGrid";
import { TarotArena } from "@/components/home/TarotArena";
import { CompatibilityArena } from "@/components/home/CompatibilityArena";
import { SolaraPath } from "@/components/home/SolaraPath";
import { type ExperienceKey, type TimeframeKey } from "@/lib/constants";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [experience, setExperience] = useState<ExperienceKey>("horoscope");
  const [timeframe, setTimeframe] = useState<TimeframeKey>("today");

  const [showDeletedBanner, setShowDeletedBanner] = useState(false);

  useEffect(() => {
    if (searchParams.get("deleted") === "true") {
      setShowDeletedBanner(true);
      const timeout = setTimeout(() => {
        router.replace("/");
      }, 100);
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

      {experience === "compatibility" ? (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
          <CompatibilityArena />
        </section>
      ) : experience === "learn" ? (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
          {/* Learn preview - will be implemented in Phase 9 */}
          <div className="text-center py-12">
            <p className="text-accent-ink/60">Learn content coming soon...</p>
          </div>
        </section>
      ) : (
        <>
          <ZodiacGrid timeframe={timeframe} experience={experience} />
          <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 mt-12">
            <TarotArena />
          </section>
        </>
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
