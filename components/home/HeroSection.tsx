"use client";

import { useTranslations } from "next-intl";
import { SolaraLogo } from "@/components/layout/SolaraLogo";
import { PrimaryCTA } from "@/components/shared/PrimaryCTA";
import { TogglePills } from "@/components/shared/TogglePills";
import { TIMEFRAME_KEYS, EXPERIENCE_KEYS, type TimeframeKey, type ExperienceKey } from "@/lib/constants";

interface HeroSectionProps {
  experience: ExperienceKey;
  timeframe: TimeframeKey;
  onExperienceChange: (value: ExperienceKey) => void;
  onTimeframeChange: (value: TimeframeKey) => void;
}

export function HeroSection({
  experience,
  timeframe,
  onExperienceChange,
  onTimeframeChange,
}: HeroSectionProps) {
  const t = useTranslations("home");
  const tExp = useTranslations("experiences");
  const tTime = useTranslations("sanctuary.timeframes");

  const experienceOptions = EXPERIENCE_KEYS.map((key) => ({
    key,
    label: tExp(key),
  }));

  const timeframeOptions = TIMEFRAME_KEYS.map((key) => ({
    key,
    label: tTime(key),
  }));

  return (
    <section className="max-w-5xl mx-auto px-6 py-16 text-center">
      <SolaraLogo size="lg" className="mb-8" />

      <div className="mb-12">
        <PrimaryCTA href="/sanctuary">{t("enterSanctuary")}</PrimaryCTA>
      </div>

      <div className="space-y-6 mb-12">
        <div>
          <p className="micro-label mb-3">{t("chooseExperience")}</p>
          <TogglePills
            options={experienceOptions}
            value={experience}
            onChange={(val) => onExperienceChange(val as ExperienceKey)}
          />
        </div>

        {experience === "horoscope" && (
          <div>
            <p className="micro-label mb-3">{t("dailyAlignment")}</p>
            <TogglePills
              options={timeframeOptions}
              value={timeframe}
              onChange={(val) => onTimeframeChange(val as TimeframeKey)}
            />
          </div>
        )}
      </div>

      <div className="mb-8">
        {experience === "tarot" ? (
          <>
            <h2 className="text-3xl font-semibold mb-2">{t("askTheCards")}</h2>
            <p className="text-base text-accent-ink/70">{t("enterQuestion")}</p>
          </>
        ) : experience === "compatibility" ? (
          <>
            <h2 className="text-3xl font-semibold mb-2">{t("exploreCompatibility")}</h2>
            <p className="text-base text-accent-ink/70">{t("selectTwoSigns")}</p>
          </>
        ) : (
          <h2 className="text-3xl font-semibold">{t("chooseYourSign")}</h2>
        )}
      </div>
    </section>
  );
}
