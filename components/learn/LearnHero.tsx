"use client";

import { useTranslations } from "next-intl";

export function LearnHero() {
  const t = useTranslations("learn");

  return (
    <section className="max-w-3xl mx-auto text-center">
      <h1 className="text-3xl md:text-5xl font-bold mb-4">
        {t("curateOrbit")}
      </h1>
      <p className="text-base md:text-lg text-accent-ink/70 leading-relaxed mb-2">
        {t("chooseFromGuides")}
      </p>
      <p className="text-sm md:text-base text-accent-ink/60 italic">
        {t("onePageADay")}
      </p>
    </section>
  );
}
