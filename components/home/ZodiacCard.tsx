"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ZodiacCardProps {
  name: string;
  symbol: string;
  onClick?: () => void;
}

export function ZodiacCard({ name, symbol, onClick }: ZodiacCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        "p-8 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all hover:scale-105 hover:shadow-lg",
        "bg-white border border-border-subtle"
      )}
    >
      {/* Icon circle with zodiac glyph */}
      <div className="mb-2 flex items-center justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-gold/10 text-4xl text-accent-gold">
          {symbol}
        </div>
      </div>

      {/* Sign name */}
      <h3 className="text-lg font-semibold text-accent-ink uppercase tracking-wide">
        {name}
      </h3>

      {/* Open reading label */}
      <p className="micro-label text-accent-gold/70">OPEN READING</p>
    </Card>
  );
}
