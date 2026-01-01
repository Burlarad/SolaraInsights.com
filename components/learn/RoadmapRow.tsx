"use client";

import { useTranslations } from "next-intl";
import { LearnGuideCard } from "./LearnGuideCard";
import { LEARN_ITEMS, LearnItem } from "@/lib/learn/content";

const ROADMAP_SLUGS = [
  "astrology-101",
  "big-three",
  "elements-modalities",
  "planets-101",
  "houses-101",
];

interface RoadmapRowProps {
  items?: LearnItem[];
}

export function RoadmapRow({ items }: RoadmapRowProps) {
  const t = useTranslations("learn");

  const roadmapItems =
    items ||
    ROADMAP_SLUGS.map((slug) => LEARN_ITEMS.find((item) => item.slug === slug)).filter(
      (item): item is LearnItem => item !== undefined
    );

  if (roadmapItems.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <h2 className="micro-label">{t("startHere")}</h2>
        <span className="text-xs bg-accent-gold/10 text-accent-gold px-2 py-0.5 rounded-full">
          {t("recommendedPath")}
        </span>
      </div>

      {/* Scroll container with edge fade hints */}
      <div className="relative">
        {/* Left fade (shows when scrolled) */}
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-shell to-transparent z-10 opacity-0"
          aria-hidden="true"
        />

        {/* Scrollable content */}
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory overscroll-x-contain -mx-4 px-4 sm:-mx-6 sm:px-6">
          {roadmapItems.map((item, index) => (
            <div key={item.slug} className="snap-start flex-shrink-0">
              <LearnGuideCard
                item={item}
                variant="roadmap"
                stepNumber={index + 1}
              />
            </div>
          ))}
        </div>

        {/* Right edge fade hint (scroll affordance) */}
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-shell to-transparent"
          aria-hidden="true"
        />
      </div>
    </section>
  );
}
