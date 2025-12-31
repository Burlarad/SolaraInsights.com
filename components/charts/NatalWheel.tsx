"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface PlanetPlacement {
  name: string;
  sign: string;
  longitude: number | null;
  retrograde?: boolean;
}

export interface HousePlacement {
  number: number;
  sign: string;
  longitude: number | null;
}

export interface Angles {
  ascendant: { sign: string; longitude: number | null };
  midheaven: { sign: string; longitude: number | null };
}

export interface AspectData {
  between: [string, string];
  type: "conjunction" | "sextile" | "square" | "trine" | "opposition";
  orb: number;
}

interface NatalWheelProps {
  planets: PlanetPlacement[];
  houses?: HousePlacement[];
  angles?: Angles;
  aspects?: AspectData[];
  size?: number;
  showAspects?: boolean;
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ZODIAC_SIGNS = [
  { name: "Aries", symbol: "♈", color: "#EF4444" },
  { name: "Taurus", symbol: "♉", color: "#10B981" },
  { name: "Gemini", symbol: "♊", color: "#F59E0B" },
  { name: "Cancer", symbol: "♋", color: "#3B82F6" },
  { name: "Leo", symbol: "♌", color: "#EF4444" },
  { name: "Virgo", symbol: "♍", color: "#10B981" },
  { name: "Libra", symbol: "♎", color: "#F59E0B" },
  { name: "Scorpio", symbol: "♏", color: "#3B82F6" },
  { name: "Sagittarius", symbol: "♐", color: "#EF4444" },
  { name: "Capricorn", symbol: "♑", color: "#10B981" },
  { name: "Aquarius", symbol: "♒", color: "#F59E0B" },
  { name: "Pisces", symbol: "♓", color: "#3B82F6" },
];

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

const PLANET_COLORS: Record<string, string> = {
  Sun: "#F59E0B",
  Moon: "#94A3B8",
  Mercury: "#6366F1",
  Venus: "#EC4899",
  Mars: "#EF4444",
  Jupiter: "#8B5CF6",
  Saturn: "#78716C",
  Uranus: "#06B6D4",
  Neptune: "#3B82F6",
  Pluto: "#1F2937",
  "North Node": "#6B7280",
  Chiron: "#059669",
};

const ASPECT_COLORS: Record<string, string> = {
  conjunction: "#F59E0B",
  sextile: "#3B82F6",
  square: "#EF4444",
  trine: "#10B981",
  opposition: "#8B5CF6",
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert longitude to chart position (0° Aries at top, going counter-clockwise)
 * Standard astrology wheel has 0° Aries at 9 o'clock (left), going counter-clockwise
 * We adjust so Ascendant is at 9 o'clock position
 */
function longitudeToAngle(longitude: number, ascendantLon: number = 0): number {
  // Rotate so Ascendant is at 9 o'clock (180°)
  // In SVG, 0° is at 3 o'clock (right), going clockwise
  // We want counter-clockwise starting at 9 o'clock
  const adjusted = 180 - (longitude - ascendantLon);
  return adjusted;
}

/**
 * Convert polar coordinates to SVG cartesian coordinates
 */
function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDegrees: number
): { x: number; y: number } {
  const angleRadians = (angleDegrees * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRadians),
    y: cy - radius * Math.sin(angleRadians),
  };
}

/**
 * Create SVG arc path
 */
function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 1, end.x, end.y,
  ].join(" ");
}

// ============================================================================
// COMPONENT
// ============================================================================

export function NatalWheel({
  planets,
  houses,
  angles,
  aspects,
  size = 400,
  showAspects = true,
  className,
}: NatalWheelProps) {
  const cx = size / 2;
  const cy = size / 2;

  // Radius calculations
  const outerRadius = size / 2 - 10;
  const signRingInner = outerRadius - 30;
  const houseRingInner = signRingInner - 15;
  const planetRing = houseRingInner - 25;
  const aspectRing = planetRing - 30;
  const innerRadius = aspectRing - 10;

  // Get Ascendant longitude for chart orientation
  const ascendantLon = angles?.ascendant?.longitude ?? 0;

  // Separate planets with collision detection
  const planetPositions = useMemo(() => {
    const positions: Array<{
      planet: PlanetPlacement;
      angle: number;
      radius: number;
      displayAngle: number;
    }> = [];

    // Sort planets by longitude for consistent ordering
    const sortedPlanets = [...planets]
      .filter((p) => p.longitude !== null)
      .sort((a, b) => (a.longitude ?? 0) - (b.longitude ?? 0));

    // Calculate base positions
    sortedPlanets.forEach((planet) => {
      const angle = longitudeToAngle(planet.longitude!, ascendantLon);
      positions.push({
        planet,
        angle,
        radius: planetRing,
        displayAngle: angle,
      });
    });

    // Simple collision detection - spread planets that are too close
    const minSeparation = 15; // degrees
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        let diff = Math.abs(positions[i].displayAngle - positions[j].displayAngle);
        if (diff > 180) diff = 360 - diff;

        if (diff < minSeparation) {
          // Spread them apart
          positions[i].displayAngle -= (minSeparation - diff) / 2;
          positions[j].displayAngle += (minSeparation - diff) / 2;
          // Alternate radii for overlapping planets
          positions[j].radius = planetRing - 18;
        }
      }
    }

    return positions;
  }, [planets, ascendantLon, planetRing]);

  // Calculate aspect lines
  const aspectLines = useMemo(() => {
    if (!aspects || !showAspects) return [];

    return aspects
      .map((aspect) => {
        const planet1 = planetPositions.find((p) => p.planet.name === aspect.between[0]);
        const planet2 = planetPositions.find((p) => p.planet.name === aspect.between[1]);

        if (!planet1 || !planet2) return null;

        const pos1 = polarToCartesian(cx, cy, aspectRing, planet1.displayAngle);
        const pos2 = polarToCartesian(cx, cy, aspectRing, planet2.displayAngle);

        return {
          x1: pos1.x,
          y1: pos1.y,
          x2: pos2.x,
          y2: pos2.y,
          type: aspect.type,
          orb: aspect.orb,
        };
      })
      .filter(Boolean) as Array<{
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      type: string;
      orb: number;
    }>;
  }, [aspects, planetPositions, showAspects, cx, cy, aspectRing]);

  return (
    <div className={cn("relative", className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="font-sans"
      >
        {/* Background */}
        <circle cx={cx} cy={cy} r={outerRadius} fill="#FAFAF9" stroke="#E7E5E4" strokeWidth="1" />

        {/* Zodiac Sign Ring */}
        {ZODIAC_SIGNS.map((sign, i) => {
          const startAngle = longitudeToAngle(i * 30, ascendantLon);
          const endAngle = longitudeToAngle((i + 1) * 30, ascendantLon);
          const midAngle = (startAngle + endAngle) / 2;
          const textPos = polarToCartesian(cx, cy, (outerRadius + signRingInner) / 2, midAngle);

          return (
            <g key={sign.name}>
              {/* Sign segment background */}
              <path
                d={`
                  ${describeArc(cx, cy, outerRadius, startAngle, endAngle)}
                  L ${polarToCartesian(cx, cy, signRingInner, endAngle).x} ${polarToCartesian(cx, cy, signRingInner, endAngle).y}
                  ${describeArc(cx, cy, signRingInner, endAngle, startAngle)}
                  Z
                `}
                fill={sign.color}
                fillOpacity={0.1}
                stroke={sign.color}
                strokeWidth={0.5}
                strokeOpacity={0.3}
              />
              {/* Sign symbol */}
              <text
                x={textPos.x}
                y={textPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="14"
                fill={sign.color}
                fontWeight="500"
              >
                {sign.symbol}
              </text>
            </g>
          );
        })}

        {/* Inner ring border */}
        <circle
          cx={cx}
          cy={cy}
          r={signRingInner}
          fill="none"
          stroke="#D6D3D1"
          strokeWidth="1"
        />

        {/* House cusps (if provided) */}
        {houses?.map((house) => {
          if (house.longitude === null) return null;
          const angle = longitudeToAngle(house.longitude, ascendantLon);
          const inner = polarToCartesian(cx, cy, innerRadius, angle);
          const outer = polarToCartesian(cx, cy, signRingInner, angle);
          const labelPos = polarToCartesian(cx, cy, houseRingInner + 5, angle + 15);

          return (
            <g key={`house-${house.number}`}>
              <line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="#A8A29E"
                strokeWidth={house.number === 1 || house.number === 4 || house.number === 7 || house.number === 10 ? "1.5" : "0.5"}
                strokeDasharray={house.number === 1 || house.number === 4 || house.number === 7 || house.number === 10 ? "none" : "3,3"}
              />
              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="10"
                fill="#78716C"
              >
                {house.number}
              </text>
            </g>
          );
        })}

        {/* Aspect lines */}
        {aspectLines.map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={ASPECT_COLORS[line.type] || "#9CA3AF"}
            strokeWidth={Math.max(0.5, 2 - line.orb / 4)}
            strokeOpacity={0.6}
          />
        ))}

        {/* Center circle */}
        <circle
          cx={cx}
          cy={cy}
          r={innerRadius}
          fill="#FAFAF9"
          stroke="#E7E5E4"
          strokeWidth="1"
        />

        {/* Planets */}
        {planetPositions.map(({ planet, radius, displayAngle }) => {
          const pos = polarToCartesian(cx, cy, radius, displayAngle);
          const symbol = PLANET_SYMBOLS[planet.name] || planet.name.charAt(0);
          const color = PLANET_COLORS[planet.name] || "#374151";

          return (
            <g key={planet.name}>
              {/* Planet circle background */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={12}
                fill="white"
                stroke={color}
                strokeWidth="1.5"
              />
              {/* Planet symbol */}
              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="14"
                fill={color}
                fontWeight="500"
              >
                {symbol}
              </text>
              {/* Retrograde indicator */}
              {planet.retrograde && (
                <text
                  x={pos.x + 10}
                  y={pos.y - 10}
                  fontSize="8"
                  fill="#EF4444"
                  fontWeight="bold"
                >
                  R
                </text>
              )}
            </g>
          );
        })}

        {/* ASC and MC labels */}
        {angles?.ascendant?.longitude !== null && (
          <g>
            {(() => {
              const ascPos = polarToCartesian(cx, cy, outerRadius + 5, 180);
              return (
                <text
                  x={ascPos.x - 15}
                  y={ascPos.y}
                  fontSize="10"
                  fill="#78716C"
                  fontWeight="600"
                >
                  ASC
                </text>
              );
            })()}
          </g>
        )}
        {angles?.midheaven?.longitude != null && (
          <g>
            {(() => {
              const mcAngle = longitudeToAngle(angles!.midheaven.longitude!, ascendantLon);
              const mcPos = polarToCartesian(cx, cy, outerRadius + 5, mcAngle);
              return (
                <text
                  x={mcPos.x - 8}
                  y={mcPos.y - 5}
                  fontSize="10"
                  fill="#78716C"
                  fontWeight="600"
                >
                  MC
                </text>
              );
            })()}
          </g>
        )}
      </svg>
    </div>
  );
}

// ============================================================================
// SIMPLE ZODIAC RING (for compact displays)
// ============================================================================

interface ZodiacRingProps {
  planets: PlanetPlacement[];
  size?: number;
  className?: string;
}

export function ZodiacRing({ planets, size = 200, className }: ZodiacRingProps) {
  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size / 2 - 5;
  const innerRadius = outerRadius - 20;
  const planetRadius = innerRadius - 15;

  return (
    <div className={cn("relative", className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Zodiac ring */}
        {ZODIAC_SIGNS.map((sign, i) => {
          const startAngle = -90 + i * 30;
          const endAngle = startAngle + 30;
          const midAngle = startAngle + 15;
          const textPos = polarToCartesian(cx, cy, (outerRadius + innerRadius) / 2, midAngle);

          return (
            <g key={sign.name}>
              <path
                d={`
                  ${describeArc(cx, cy, outerRadius, startAngle, endAngle)}
                  L ${polarToCartesian(cx, cy, innerRadius, endAngle).x} ${polarToCartesian(cx, cy, innerRadius, endAngle).y}
                  ${describeArc(cx, cy, innerRadius, endAngle, startAngle)}
                  Z
                `}
                fill={sign.color}
                fillOpacity={0.15}
                stroke={sign.color}
                strokeWidth={0.5}
              />
              <text
                x={textPos.x}
                y={textPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="12"
                fill={sign.color}
              >
                {sign.symbol}
              </text>
            </g>
          );
        })}

        {/* Planet dots */}
        {planets
          .filter((p) => p.longitude !== null)
          .map((planet) => {
            const angle = -90 + planet.longitude!;
            const pos = polarToCartesian(cx, cy, planetRadius, angle);
            const color = PLANET_COLORS[planet.name] || "#374151";

            return (
              <circle
                key={planet.name}
                cx={pos.x}
                cy={pos.y}
                r={4}
                fill={color}
                stroke="white"
                strokeWidth={1}
              >
                <title>{planet.name} in {planet.sign}</title>
              </circle>
            );
          })}

        {/* Center */}
        <circle cx={cx} cy={cy} r={planetRadius - 10} fill="#FAFAF9" stroke="#E7E5E4" />
      </svg>
    </div>
  );
}
