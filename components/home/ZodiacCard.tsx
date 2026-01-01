"use client";

import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ZodiacCardProps {
  signKey: string;
  symbol: string;
  isSelected?: boolean;
  onClick?: () => void;
}

export function ZodiacCard({ signKey, symbol, isSelected, onClick }: ZodiacCardProps) {
  const t = useTranslations("home");
  const tSigns = useTranslations("zodiacSigns");

  return (
    <Card
      onClick={onClick}
      className={cn(
        "p-6 md:p-8 flex flex-col items-center justify-center gap-3 md:gap-4 cursor-pointer transition-all hover:scale-105 hover:shadow-lg min-h-[160px]",
        "bg-white border",
        isSelected
          ? "border-accent-gold ring-2 ring-accent-gold/30 shadow-lg"
          : "border-border-subtle hover:border-accent-gold/50"
      )}
    >
      <div className="flex items-center justify-center">
        <div
          className={cn(
            "flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-full text-3xl md:text-4xl transition-colors",
            isSelected
              ? "bg-accent-gold text-white"
              : "bg-accent-gold/10 text-accent-gold"
          )}
        >
          {symbol}
        </div>
      </div>

      <h3 className="font-cursive text-xl md:text-2xl font-normal text-accent-ink tracking-wide">
        {tSigns(signKey)}
      </h3>

      <p className={cn(
        "micro-label transition-colors",
        isSelected ? "text-accent-gold" : "text-accent-gold/70"
      )}>
        {isSelected ? t("selected") : t("openReading")}
      </p>
    </Card>
  );
}
