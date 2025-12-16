"use client";

import { Sunrise, Sun, Sunset } from "lucide-react";

interface EmotionalCadenceTimelineProps {
  dawn: string;
  midday: string;
  dusk: string;
}

export function EmotionalCadenceTimeline({
  dawn,
  midday,
  dusk,
}: EmotionalCadenceTimelineProps) {
  return (
    <div className="py-4">
      {/* Arc Timeline with Icons */}
      <div className="relative h-20 mb-2">
        {/* SVG Arc Line */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 300 80"
          preserveAspectRatio="none"
          fill="none"
        >
          {/* Subtle arc path */}
          <path
            d="M 30 60 Q 150 10 270 60"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-border-subtle"
            fill="none"
          />
          {/* Gradient glow under arc (optional warmth) */}
          <path
            d="M 30 60 Q 150 10 270 60"
            stroke="url(#arcGradient)"
            strokeWidth="3"
            strokeLinecap="round"
            className="opacity-30"
            fill="none"
          />
          <defs>
            <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F7C56A" />
              <stop offset="50%" stopColor="#F2994A" />
              <stop offset="100%" stopColor="#E8B4B8" />
            </linearGradient>
          </defs>
        </svg>

        {/* Icon Circles - positioned along the arc */}
        <div className="absolute inset-0 flex items-end justify-between px-2 sm:px-4">
          {/* Dawn Icon */}
          <div className="flex flex-col items-center -mb-1">
            <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-white/60 border border-border-subtle shadow-sm ring-1 ring-accent-gold/20 flex items-center justify-center">
              <Sunrise className="h-5 w-5 md:h-6 md:w-6 text-accent-gold" />
            </div>
          </div>

          {/* Midday Icon - elevated to match arc peak */}
          <div className="flex flex-col items-center -mb-8 md:-mb-10">
            <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-white/60 border border-border-subtle shadow-sm ring-1 ring-accent-gold/20 flex items-center justify-center">
              <Sun className="h-5 w-5 md:h-6 md:w-6 text-accent-gold-dark" />
            </div>
          </div>

          {/* Dusk Icon */}
          <div className="flex flex-col items-center -mb-1">
            <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-white/60 border border-border-subtle shadow-sm ring-1 ring-accent-gold/20 flex items-center justify-center">
              <Sunset className="h-5 w-5 md:h-6 md:w-6 text-accent-gold-dark" />
            </div>
          </div>
        </div>
      </div>

      {/* Labels and Mood Text Grid */}
      <div className="grid grid-cols-3 gap-2 text-center mt-4">
        {/* Dawn */}
        <div className="space-y-1">
          <p className="micro-label">DAWN</p>
          <p className="text-sm md:text-base font-medium text-accent-ink leading-snug break-words">
            {dawn}
          </p>
        </div>

        {/* Midday */}
        <div className="space-y-1">
          <p className="micro-label">MIDDAY</p>
          <p className="text-sm md:text-base font-medium text-accent-ink leading-snug break-words">
            {midday}
          </p>
        </div>

        {/* Dusk */}
        <div className="space-y-1">
          <p className="micro-label">DUSK</p>
          <p className="text-sm md:text-base font-medium text-accent-ink leading-snug break-words">
            {dusk}
          </p>
        </div>
      </div>
    </div>
  );
}
