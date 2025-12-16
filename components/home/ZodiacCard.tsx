"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ZodiacCardProps {
  name: string;
  symbol: string;
  isSelected?: boolean;
  onClick?: () => void;
}

export function ZodiacCard({ name, symbol, isSelected, onClick }: ZodiacCardProps) {
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
      {/* Icon circle with zodiac glyph */}
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

      {/* Sign name */}
      <h3 className="text-base md:text-lg font-semibold text-accent-ink uppercase tracking-wide">
        {name}
      </h3>

      {/* Open reading label */}
      <p className={cn(
        "micro-label transition-colors",
        isSelected ? "text-accent-gold" : "text-accent-gold/70"
      )}>
        {isSelected ? "SELECTED" : "OPEN READING"}
      </p>
    </Card>
  );
}
