"use client";

import { SanctuaryTabs } from "@/components/sanctuary/SanctuaryTabs";
import { SolaraLogo } from "@/components/layout/SolaraLogo";
import { TarotArena } from "@/components/home/TarotArena";
import { useTranslations } from "next-intl";

export default function TarotPage() {
  const t = useTranslations("tarot");

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-8">
      {/* Solara Logo */}
      <div className="flex justify-center items-center pt-4 pb-8">
        <SolaraLogo />
      </div>

      {/* Tabs - centered */}
      <div className="flex justify-center">
        <SanctuaryTabs />
      </div>

      {/* Tarot Arena */}
      <div className="max-w-3xl mx-auto">
        <TarotArena />
      </div>
    </div>
  );
}
