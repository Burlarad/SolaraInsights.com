"use client";

import { cn } from "@/lib/utils";

// Aspect types from the ephemeris
export type AspectType = "conjunction" | "sextile" | "square" | "trine" | "opposition";

export interface AspectPlacement {
  between: [string, string];
  type: AspectType;
  orb: number;
  exactAngle: number;
}

interface AspectGridProps {
  aspects: AspectPlacement[];
  planets?: string[];
  className?: string;
}

// Aspect symbols and colors
const ASPECT_CONFIG: Record<AspectType, { symbol: string; color: string; bg: string; label: string }> = {
  conjunction: { symbol: "☌", color: "text-amber-600", bg: "bg-amber-100", label: "Conjunction" },
  sextile: { symbol: "⚹", color: "text-blue-500", bg: "bg-blue-100", label: "Sextile" },
  square: { symbol: "□", color: "text-red-500", bg: "bg-red-100", label: "Square" },
  trine: { symbol: "△", color: "text-emerald-500", bg: "bg-emerald-100", label: "Trine" },
  opposition: { symbol: "☍", color: "text-purple-600", bg: "bg-purple-100", label: "Opposition" },
};

// Planet symbols
const PLANET_SYMBOLS: Record<string, string> = {
  Sun: "☉",
  Moon: "☽",
  Mercury: "☿",
  Venus: "♀",
  Mars: "♂",
  Jupiter: "♃",
  Saturn: "♄",
  Uranus: "⛢",
  Neptune: "♆",
  Pluto: "♇",
  "North Node": "☊",
  Chiron: "⚷",
};

// Default planet order
const DEFAULT_PLANETS = [
  "Sun", "Moon", "Mercury", "Venus", "Mars",
  "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
];

export function AspectGrid({ aspects, planets = DEFAULT_PLANETS, className }: AspectGridProps) {
  // Build a lookup map for quick aspect retrieval
  const aspectMap = new Map<string, AspectPlacement>();

  aspects.forEach((aspect) => {
    const key1 = `${aspect.between[0]}-${aspect.between[1]}`;
    const key2 = `${aspect.between[1]}-${aspect.between[0]}`;
    aspectMap.set(key1, aspect);
    aspectMap.set(key2, aspect);
  });

  // Get aspect between two planets
  const getAspect = (planet1: string, planet2: string): AspectPlacement | null => {
    return aspectMap.get(`${planet1}-${planet2}`) || null;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Compact Grid View */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Grid Table */}
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="w-10 h-10" /> {/* Empty corner cell */}
                {planets.map((planet) => (
                  <th
                    key={planet}
                    className="w-10 h-10 text-center text-sm font-medium text-accent-ink/70"
                    title={planet}
                  >
                    {PLANET_SYMBOLS[planet] || planet.charAt(0)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {planets.map((rowPlanet, rowIndex) => (
                <tr key={rowPlanet}>
                  <td
                    className="w-10 h-10 text-center text-sm font-medium text-accent-ink/70"
                    title={rowPlanet}
                  >
                    {PLANET_SYMBOLS[rowPlanet] || rowPlanet.charAt(0)}
                  </td>
                  {planets.map((colPlanet, colIndex) => {
                    // Only show lower triangle (avoid duplicates)
                    if (colIndex >= rowIndex) {
                      return (
                        <td
                          key={colPlanet}
                          className="w-10 h-10 bg-gray-50/50"
                        />
                      );
                    }

                    const aspect = getAspect(rowPlanet, colPlanet);

                    if (!aspect) {
                      return (
                        <td
                          key={colPlanet}
                          className="w-10 h-10 border border-border-subtle/30"
                        />
                      );
                    }

                    const config = ASPECT_CONFIG[aspect.type];

                    return (
                      <td
                        key={colPlanet}
                        className={cn(
                          "w-10 h-10 border border-border-subtle/30 text-center cursor-help transition-colors",
                          config.bg,
                          "hover:brightness-95"
                        )}
                        title={`${rowPlanet} ${config.label} ${colPlanet} (${aspect.orb.toFixed(1)}° orb)`}
                      >
                        <span className={cn("text-lg", config.color)}>
                          {config.symbol}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(ASPECT_CONFIG).map(([type, config]) => (
          <div
            key={type}
            className="flex items-center gap-1.5"
          >
            <span className={cn("text-base", config.color)}>{config.symbol}</span>
            <span className="text-accent-ink/60 capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// List view for mobile or expanded display
export function AspectList({ aspects, className }: { aspects: AspectPlacement[]; className?: string }) {
  if (aspects.length === 0) {
    return (
      <p className="text-sm text-accent-ink/60 text-center py-4">
        No major aspects found
      </p>
    );
  }

  // Sort by orb (tighter aspects first)
  const sortedAspects = [...aspects].sort((a, b) => a.orb - b.orb);

  return (
    <div className={cn("space-y-2", className)}>
      {sortedAspects.map((aspect, index) => {
        const config = ASPECT_CONFIG[aspect.type];
        const [planet1, planet2] = aspect.between;

        return (
          <div
            key={index}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg",
              config.bg
            )}
          >
            <div className={cn("text-xl", config.color)}>
              {config.symbol}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm font-medium text-accent-ink">
                <span>{PLANET_SYMBOLS[planet1]} {planet1}</span>
                <span className={cn("text-xs", config.color)}>{config.label}</span>
                <span>{PLANET_SYMBOLS[planet2]} {planet2}</span>
              </div>
              <p className="text-xs text-accent-ink/60">
                {aspect.exactAngle.toFixed(1)}° separation ({aspect.orb.toFixed(1)}° orb)
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
