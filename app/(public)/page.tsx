"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { HeroSection } from "@/components/home/HeroSection";
import { ZodiacGrid } from "@/components/home/ZodiacGrid";
import { CompatibilityArena } from "@/components/home/CompatibilityArena";
import { SolaraPath } from "@/components/home/SolaraPath";
import { LearnPreview } from "@/components/home/LearnPreview";
import { EXPERIENCE_KEYS, type ExperienceKey, type TimeframeKey } from "@/lib/constants";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read initial experience from URL if present
  const urlExperience = searchParams.get("experience") as ExperienceKey | null;
  const initialExperience = urlExperience && EXPERIENCE_KEYS.includes(urlExperience)
    ? urlExperience
    : "horoscope";

  const [experience, setExperience] = useState<ExperienceKey>(initialExperience);
  const [timeframe, setTimeframe] = useState<TimeframeKey>("today");

  const [showDeletedBanner, setShowDeletedBanner] = useState(false);

  // Sync experience state with URL for bookmarkable/shareable links
  const handleExperienceChange = (newExperience: ExperienceKey) => {
    setExperience(newExperience);
    // Update URL without full navigation (shallow update)
    const url = newExperience === "horoscope" ? "/" : `/?experience=${newExperience}`;
    router.replace(url, { scroll: false });
  };

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
        onExperienceChange={handleExperienceChange}
        onTimeframeChange={setTimeframe}
      />

      {experience === "compatibility" ? (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
          <CompatibilityArena />
        </section>
      ) : experience === "learn" ? (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
          <LearnPreview />
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
