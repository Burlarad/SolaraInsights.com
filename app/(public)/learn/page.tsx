"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { LearnHero } from "@/components/learn/LearnHero";
import { SearchFilters } from "@/components/learn/SearchFilters";
import { RoadmapRow } from "@/components/learn/RoadmapRow";
import { LearnGuideCard } from "@/components/learn/LearnGuideCard";
import { SolaraLogo } from "@/components/layout/SolaraLogo";
import { LEARN_ITEMS, LearnItem } from "@/lib/learn/content";

export default function LearnPage() {
  const t = useTranslations("learn");
  const [filteredItems, setFilteredItems] = useState<LearnItem[]>(LEARN_ITEMS);
  const [hasActiveFilters, setHasActiveFilters] = useState(false);

  const handleFilterChange = useCallback((items: LearnItem[]) => {
    setFilteredItems(items);
    setHasActiveFilters(items.length !== LEARN_ITEMS.length);
  }, []);

  const hasNoResults = filteredItems.length === 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12 space-y-8 md:space-y-10">
      <div className="flex justify-center items-center pt-4 pb-6">
        <SolaraLogo size="lg" />
      </div>

      <LearnHero />

      {!hasActiveFilters && <RoadmapRow />}

      <SearchFilters items={LEARN_ITEMS} onFilterChange={handleFilterChange} />

      {hasNoResults ? (
        <div className="text-center py-12">
          <p className="text-5xl mb-4" aria-hidden="true">
            🔍
          </p>
          <h2 className="text-xl font-semibold mb-2">{t("noGuidesFound")}</h2>
          <p className="text-accent-ink/60">{t("tryAdjusting")}</p>
        </div>
      ) : (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <h2 className="micro-label">{t("allGuides")}</h2>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              {t("guidesFound", { count: filteredItems.length })}
            </span>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => (
              <LearnGuideCard key={item.slug} item={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
