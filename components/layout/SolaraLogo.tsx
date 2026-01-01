"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface SolaraLogoProps {
  size?: "sm" | "lg";
  className?: string;
}

export function SolaraLogo({ size = "lg", className }: SolaraLogoProps) {
  const discSize = size === "lg" ? "h-24 w-24" : "h-12 w-12";
  const wordmarkSize = size === "lg" ? "text-4xl md:text-6xl" : "text-3xl";

  return (
    <div className={cn("flex flex-col items-center gap-4 opacity-60", className)}>
      {/* Golden disc + reflection */}
      <div className="relative flex items-center justify-center">
        <div
          className={cn(
            discSize,
            "rounded-full bg-gradient-to-br from-accent-gold-light to-accent-gold-dark shadow-md"
          )}
        />
        <div className="absolute -bottom-3 h-4 w-16 rounded-full bg-white/60 blur-sm" />
      </div>

      {/* Wordmark */}
      <div
        className={cn(
          wordmarkSize,
          "font-cursive font-normal tracking-wide text-accent-ink"
        )}
      >
        Solara
      </div>

      {/* Tagline */}
      {size === "lg" && (
        <p className="micro-label mt-1 text-accent-gold/80">
          CALM GUIDANCE FROM THE LIGHT
        </p>
      )}
    </div>
  );
}
