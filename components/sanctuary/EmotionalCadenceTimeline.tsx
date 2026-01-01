"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import SunCalc from "suncalc";
import { fetchWeather, getWeatherCondition, WeatherCondition } from "@/lib/weather";

interface EmotionalCadenceTimelineProps {
  dawn: string;
  midday: string;
  dusk: string;
  evening: string;
  midnight: string;
  morning: string;
  coords?: { lat: number; lon: number } | null;
}

interface SunTimes {
  sunrise: Date;
  solarNoon: Date;
  sunset: Date;
}

// Arc configuration for the timeline curve
const ARC = {
  viewBox: { width: 400, height: 80 },
  bezier: {
    P0: { x: 10, y: 65 },
    P1: { x: 200, y: 5 },
    P2: { x: 390, y: 65 },
  },
  path: "M 10 65 Q 200 5 390 65",
} as const;

// Position markers on the arc (aligned with grid-cols-3)
const MARKERS = {
  LEFT: 0.167,   // 16.67% - dawn/evening
  PEAK: 0.5,     // 50% - midday/midnight
  RIGHT: 0.833,  // 83.33% - dusk/morning
} as const;

// Time intervals in milliseconds
const INTERVALS = {
  ONE_HOUR: 60 * 60 * 1000,
  ONE_MINUTE: 60 * 1000,
  THIRTY_MINUTES: 30 * 60 * 1000,
} as const;

// Sun ray angles for rendering
const SUN_RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;
const SUN_RAY_ANGLES_SPARSE = [0, 60, 120, 180, 240, 300] as const;

function getSunTimes(coords: { lat: number; lon: number } | null): SunTimes {
  const now = new Date();

  if (!coords) {
    // Default to standard times if no coords
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return {
      sunrise: new Date(base.getTime() + 7 * 60 * 60 * 1000),
      solarNoon: new Date(base.getTime() + 12 * 60 * 60 * 1000),
      sunset: new Date(base.getTime() + 17 * 60 * 60 * 1000),
    };
  }

  const times = SunCalc.getTimes(now, coords.lat, coords.lon);
  return {
    sunrise: times.sunrise,
    solarNoon: times.solarNoon,
    sunset: times.sunset,
  };
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getPointOnArc(t: number): { x: number; y: number } {
  const { P0, P1, P2 } = ARC.bezier;
  const mt = 1 - t;

  return {
    x: mt * mt * P0.x + 2 * mt * t * P1.x + t * t * P2.x,
    y: mt * mt * P0.y + 2 * mt * t * P1.y + t * t * P2.y,
  };
}

interface CelestialIconProps {
  type: "sun" | "moon";
  weather: WeatherCondition;
}

// Reusable sun ray rendering
function SunRays({
  angles,
  innerRadius,
  outerRadius,
  strokeWidth = 2,
  animate = false
}: {
  angles: readonly number[];
  innerRadius: number;
  outerRadius: number;
  strokeWidth?: number;
  animate?: boolean;
}) {
  return (
    <>
      {angles.map((angle) => (
        <line
          key={angle}
          x1={innerRadius} y1="0" x2={outerRadius} y2="0"
          stroke="#FBBF24"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          transform={`rotate(${angle})`}
          className={animate ? "animate-pulse" : undefined}
        />
      ))}
    </>
  );
}

function CelestialIcon({ type, weather }: CelestialIconProps) {
  // Clear sun with rays
  if (type === "sun" && weather === "clear") {
    return (
      <g>
        <circle r="10" fill="url(#sunGradient)" />
        <SunRays angles={SUN_RAY_ANGLES} innerRadius={14} outerRadius={20} animate />
      </g>
    );
  }

  // Partly cloudy sun
  if (type === "sun" && weather === "partly_cloudy") {
    return (
      <g>
        <g transform="translate(-5, -5)">
          <circle r="8" fill="url(#sunGradient)" />
          <SunRays angles={SUN_RAY_ANGLES_SPARSE} innerRadius={10} outerRadius={14} strokeWidth={1.5} />
        </g>
        <g transform="translate(4, 4)">
          <ellipse rx="10" ry="6" fill="#F3F4F6" />
          <ellipse cx="-5" cy="-2" rx="5" ry="3" fill="white" />
          <ellipse cx="4" cy="-1" rx="4" ry="2.5" fill="white" />
        </g>
      </g>
    );
  }

  // Cloudy sun
  if (type === "sun" && weather === "cloudy") {
    return (
      <g>
        <circle r="6" fill="#FCD34D" opacity="0.4" transform="translate(-4, -4)" />
        <ellipse rx="12" ry="7" fill="#9CA3AF" />
        <ellipse cx="-6" cy="-2" rx="5" ry="3" fill="#D1D5DB" />
        <ellipse cx="5" cy="-1" rx="4" ry="2.5" fill="#D1D5DB" />
      </g>
    );
  }

  // Foggy sun
  if (type === "sun" && weather === "foggy") {
    return (
      <g>
        <circle r="14" fill="#FEF3C7" opacity="0.3" />
        <circle r="8" fill="#FCD34D" opacity="0.6" />
      </g>
    );
  }

  // Rainy cloud
  if (weather === "rainy") {
    return (
      <g>
        <ellipse cy="-2" rx="12" ry="7" fill="#9CA3AF" />
        <ellipse cx="-6" cy="-4" rx="5" ry="3" fill="#D1D5DB" />
        <ellipse cx="5" cy="-3" rx="4" ry="2.5" fill="#D1D5DB" />
        <line x1="-5" y1="6" x2="-7" y2="14" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" />
        <line x1="0" y1="7" x2="-2" y2="15" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" />
        <line x1="5" y1="6" x2="3" y2="14" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" />
      </g>
    );
  }

  // Snowy cloud
  if (weather === "snowy") {
    return (
      <g>
        <ellipse cy="-2" rx="12" ry="7" fill="#E5E7EB" />
        <ellipse cx="-6" cy="-4" rx="5" ry="3" fill="#F3F4F6" />
        <ellipse cx="5" cy="-3" rx="4" ry="2.5" fill="#F3F4F6" />
        <circle cx="-5" cy="10" r="2" fill="white" />
        <circle cx="0" cy="12" r="2" fill="white" />
        <circle cx="5" cy="10" r="2" fill="white" />
      </g>
    );
  }

  // Stormy cloud
  if (weather === "stormy") {
    return (
      <g>
        <ellipse cy="-2" rx="12" ry="7" fill="#4B5563" />
        <ellipse cx="-6" cy="-4" rx="5" ry="3" fill="#6B7280" />
        <ellipse cx="5" cy="-3" rx="4" ry="2.5" fill="#6B7280" />
        <path
          d="M -2 6 L 0 10 L -3 10 L 0 16"
          stroke="#FBBF24"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    );
  }

  // Clear moon with stars
  if (type === "moon" && weather === "clear") {
    return (
      <g filter="url(#moonGlow)">
        {/* Moon body with crescent mask */}
        <circle cx="0" cy="0" r="10" fill="url(#moonGradient)" mask="url(#crescentMask)" />
        {/* Subtle outline for visibility */}
        <circle cx="0" cy="0" r="10" fill="none" stroke="#A78BFA" strokeWidth="0.5" opacity="0.5" />
        {/* Stars */}
        <circle cx="16" cy="-10" r="1.2" fill="#FEF3C7" className="animate-pulse" />
        <circle cx="-14" cy="8" r="1" fill="#FEF3C7" className="animate-pulse" style={{ animationDelay: "0.5s" }} />
        <circle cx="12" cy="12" r="1.4" fill="#FEF3C7" className="animate-pulse" style={{ animationDelay: "1s" }} />
      </g>
    );
  }

  // Partly cloudy moon
  if (type === "moon" && weather === "partly_cloudy") {
    return (
      <g filter="url(#moonGlow)">
        <g transform="translate(-4, -4)">
          <circle cx="0" cy="0" r="8" fill="url(#moonGradient)" mask="url(#crescentMaskSmall)" />
          <circle cx="0" cy="0" r="8" fill="none" stroke="#A78BFA" strokeWidth="0.5" opacity="0.4" />
        </g>
        <g transform="translate(3, 3)">
          <ellipse rx="8" ry="5" fill="#E5E7EB" />
          <ellipse cx="-4" cy="-1" rx="4" ry="2.5" fill="#F3F4F6" />
          <ellipse cx="3" cy="-0.5" rx="3" ry="2" fill="#F3F4F6" />
        </g>
      </g>
    );
  }

  // Cloudy moon
  if (type === "moon" && weather === "cloudy") {
    return (
      <g>
        <circle cx="-4" cy="-4" r="6" fill="#A78BFA" opacity="0.4" />
        <ellipse cx="0" cy="0" rx="12" ry="7" fill="#6B7280" />
        <ellipse cx="-6" cy="-2" rx="5" ry="3" fill="#9CA3AF" />
        <ellipse cx="5" cy="-1" rx="4" ry="2.5" fill="#9CA3AF" />
      </g>
    );
  }

  // Foggy moon
  if (type === "moon" && weather === "foggy") {
    return (
      <g>
        <circle cx="0" cy="0" r="14" fill="#DDD6FE" opacity="0.3" />
        <circle cx="0" cy="0" r="8" fill="#A78BFA" opacity="0.6" />
      </g>
    );
  }

  // Default sun
  if (type === "sun") {
    return (
      <g>
        <circle r="10" fill="url(#sunGradient)" />
        <SunRays angles={SUN_RAY_ANGLES} innerRadius={14} outerRadius={20} />
      </g>
    );
  }

  // Default moon
  return (
    <g filter="url(#moonGlow)">
      <circle cx="0" cy="0" r="10" fill="url(#moonGradient)" mask="url(#crescentMask)" />
      <circle cx="0" cy="0" r="10" fill="none" stroke="#A78BFA" strokeWidth="0.5" opacity="0.5" />
    </g>
  );
}

export function EmotionalCadenceTimeline({
  dawn,
  midday,
  dusk,
  evening,
  midnight: midnightMood,
  morning,
  coords = null,
}: EmotionalCadenceTimelineProps) {
  const [position, setPosition] = useState(0.5);
  const [weather, setWeather] = useState<WeatherCondition>("clear");

  // Get sun times (memoized on coords)
  const sunTimes = useMemo(
    () => getSunTimes(coords),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [coords?.lat, coords?.lon]
  );

  // Determine if it's currently daytime
  const isDay = useMemo(() => {
    const now = new Date();
    return now >= sunTimes.sunrise && now < sunTimes.sunset;
  }, [sunTimes]);

  // Calculate position on arc based on current time
  const updatePosition = useCallback(() => {
    const now = new Date();
    const { LEFT, PEAK, RIGHT } = MARKERS;

    if (isDay) {
      // DAYTIME: sunrise at LEFT, noon at PEAK, sunset at RIGHT
      const arcStart = sunTimes.sunrise.getTime() - INTERVALS.ONE_HOUR;
      const arcEnd = sunTimes.sunset.getTime() + INTERVALS.ONE_HOUR;

      const sunriseTime = sunTimes.sunrise.getTime();
      const noonTime = sunTimes.solarNoon.getTime();
      const sunsetTime = sunTimes.sunset.getTime();
      const nowTime = now.getTime();

      let t: number;
      if (nowTime < sunriseTime) {
        // Before sunrise: 0 → LEFT
        const progress = (nowTime - arcStart) / (sunriseTime - arcStart);
        t = progress * LEFT;
      } else if (nowTime < noonTime) {
        // Sunrise → noon: LEFT → PEAK
        const progress = (nowTime - sunriseTime) / (noonTime - sunriseTime);
        t = LEFT + progress * (PEAK - LEFT);
      } else if (nowTime < sunsetTime) {
        // Noon → sunset: PEAK → RIGHT
        const progress = (nowTime - noonTime) / (sunsetTime - noonTime);
        t = PEAK + progress * (RIGHT - PEAK);
      } else {
        // After sunset: RIGHT → 1
        const progress = (nowTime - sunsetTime) / (arcEnd - sunsetTime);
        t = RIGHT + progress * (1 - RIGHT);
      }

      setPosition(Math.max(0, Math.min(1, t)));
    } else {
      // NIGHTTIME: sunset → midnight → sunrise
      let nightStart: Date;
      let nightEnd: Date;

      if (now < sunTimes.sunrise) {
        // After midnight, before sunrise
        nightStart = new Date(sunTimes.sunset);
        nightStart.setDate(nightStart.getDate() - 1);
        nightEnd = sunTimes.sunrise;
      } else {
        // After sunset, before midnight
        nightStart = sunTimes.sunset;
        nightEnd = new Date(sunTimes.sunrise);
        nightEnd.setDate(nightEnd.getDate() + 1);
      }

      // Find midnight
      const midnightTime = new Date(nightEnd);
      midnightTime.setHours(0, 0, 0, 0);

      const nightStartTime = nightStart.getTime();
      const nightEndTime = nightEnd.getTime();
      const midnightTimeMs = midnightTime.getTime();
      const nowTime = now.getTime();

      let t: number;
      if (nowTime < midnightTimeMs) {
        // Evening: sunset → midnight = LEFT → PEAK
        const progress = (nowTime - nightStartTime) / (midnightTimeMs - nightStartTime);
        t = LEFT + progress * (PEAK - LEFT);
      } else {
        // Pre-dawn: midnight → sunrise = PEAK → RIGHT
        const progress = (nowTime - midnightTimeMs) / (nightEndTime - midnightTimeMs);
        t = PEAK + progress * (RIGHT - PEAK);
      }

      setPosition(Math.max(0, Math.min(1, t)));
    }
  }, [isDay, sunTimes]);

  // Update position on mount and every minute
  useEffect(() => {
    updatePosition();
    const interval = setInterval(updatePosition, INTERVALS.ONE_MINUTE);
    return () => clearInterval(interval);
  }, [updatePosition]);

  // Fetch weather data periodically
  useEffect(() => {
    if (!coords) return;

    const fetchWeatherData = async () => {
      try {
        const data = await fetchWeather(coords.lat, coords.lon);
        setWeather(getWeatherCondition(data.current.weather_code));
      } catch {
        setWeather("clear");
      }
    };

    fetchWeatherData();
    const interval = setInterval(fetchWeatherData, INTERVALS.THIRTY_MINUTES);
    return () => clearInterval(interval);
  }, [coords]);

  // Calculate celestial body position on arc
  const celestialPos = useMemo(() => getPointOnArc(position), [position]);

  // Labels and times based on day/night mode
  const labels = isDay
    ? { left: "DAWN", center: "MIDDAY", right: "DUSK" }
    : { left: "EVENING", center: "MIDNIGHT", right: "MORNING" };

  const times = isDay
    ? {
        left: coords ? formatTime(sunTimes.sunrise) : null,
        center: coords ? formatTime(sunTimes.solarNoon) : null,
        right: coords ? formatTime(sunTimes.sunset) : null,
      }
    : {
        left: coords ? formatTime(sunTimes.sunset) : null,
        center: "12:00 AM",
        right: coords ? formatTime(sunTimes.sunrise) : null,
      };

  // Moods based on day/night mode
  const moods = isDay
    ? { left: dawn, center: midday, right: dusk }
    : { left: evening, center: midnightMood, right: morning };

  return (
    <div className="w-full py-2">
      {/* SVG Arc */}
      <div className="w-full" style={{ height: "100px" }}>
        <svg
          viewBox={`0 0 ${ARC.viewBox.width} ${ARC.viewBox.height}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            {/* Arc gradients */}
            <linearGradient id="dayArcGradient" x1="0%" x2="100%">
              <stop offset="0%" stopColor="#6B7280" stopOpacity="0.3" />
              <stop offset="17%" stopColor="#FDE68A" />
              <stop offset="50%" stopColor="#FBBF24" />
              <stop offset="83%" stopColor="#F97316" />
              <stop offset="100%" stopColor="#6B7280" stopOpacity="0.3" />
            </linearGradient>

            <linearGradient id="nightArcGradient" x1="0%" x2="100%">
              <stop offset="0%" stopColor="#6B7280" stopOpacity="0.3" />
              <stop offset="17%" stopColor="#8B5CF6" />
              <stop offset="50%" stopColor="#4C1D95" />
              <stop offset="83%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#6B7280" stopOpacity="0.3" />
            </linearGradient>

            {/* Sun gradient */}
            <radialGradient id="sunGradient" cx="30%" cy="30%">
              <stop offset="0%" stopColor="#FEF3C7" />
              <stop offset="50%" stopColor="#FCD34D" />
              <stop offset="100%" stopColor="#F59E0B" />
            </radialGradient>

            {/* Moon gradient */}
            <radialGradient id="moonGradient" cx="30%" cy="30%">
              <stop offset="0%" stopColor="#F5F3FF" />
              <stop offset="50%" stopColor="#DDD6FE" />
              <stop offset="100%" stopColor="#A78BFA" />
            </radialGradient>

            {/* Crescent masks - show more moon for better visibility */}
            <mask id="crescentMask">
              <circle cx="0" cy="0" r="10" fill="white" />
              <circle cx="7" cy="-2" r="7" fill="black" />
            </mask>
            <mask id="crescentMaskSmall">
              <circle cx="0" cy="0" r="8" fill="white" />
              <circle cx="6" cy="-2" r="5.5" fill="black" />
            </mask>

            {/* Moon glow filter for better visibility */}
            <filter id="moonGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Arc path */}
          <path
            d={ARC.path}
            stroke={isDay ? "url(#dayArcGradient)" : "url(#nightArcGradient)"}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />

          {/* Celestial body */}
          <g
            transform={`translate(${celestialPos.x}, ${celestialPos.y})`}
            style={{ transition: "transform 1s ease-out" }}
          >
            <CelestialIcon type={isDay ? "sun" : "moon"} weather={weather} />
          </g>
        </svg>
      </div>

      {/* Labels - grid-cols-3 aligns with arc marker positions */}
      <div className="grid grid-cols-3 text-center">
        {/* Left: DAWN / EVENING (aligns with x=67, 16.67% of arc) */}
        <div className="space-y-0.5">
          <p className={`text-xs uppercase tracking-wide font-medium ${isDay ? "text-amber-500" : "text-purple-400"}`}>
            {labels.left}
          </p>
          {times.left && <p className="text-xs text-accent-ink/50">{times.left}</p>}
          {moods.left && <p className="text-sm font-medium text-accent-ink leading-snug">{moods.left}</p>}
        </div>

        {/* Center: MIDDAY / MIDNIGHT (aligns with x=200, 50% of arc) */}
        <div className="space-y-0.5">
          <p className={`text-xs uppercase tracking-wide font-medium ${isDay ? "text-amber-600" : "text-purple-600"}`}>
            {labels.center}
          </p>
          {times.center && <p className="text-xs text-accent-ink/50">{times.center}</p>}
          {moods.center && <p className="text-sm font-medium text-accent-ink leading-snug">{moods.center}</p>}
        </div>

        {/* Right: DUSK / MORNING (aligns with x=333, 83.33% of arc) */}
        <div className="space-y-0.5">
          <p className={`text-xs uppercase tracking-wide font-medium ${isDay ? "text-orange-500" : "text-purple-400"}`}>
            {labels.right}
          </p>
          {times.right && <p className="text-xs text-accent-ink/50">{times.right}</p>}
          {moods.right && <p className="text-sm font-medium text-accent-ink leading-snug">{moods.right}</p>}
        </div>
      </div>
    </div>
  );
}
