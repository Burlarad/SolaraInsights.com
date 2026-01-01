"use client";

import { cn } from "@/lib/utils";

interface TogglePillOption {
  key: string;
  label: string;
}

interface TogglePillsProps {
  options: TogglePillOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function TogglePills({ options, value, onChange, className }: TogglePillsProps) {
  return (
    <div
      className={cn(
        "inline-flex gap-2 p-1 bg-white/50 rounded-full",
        "max-w-full overflow-x-auto overscroll-x-contain",
        "snap-x snap-mandatory scrollbar-none",
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.key}
          onClick={() => onChange(option.key)}
          className={cn(
            "pill font-cursive text-xl md:text-2xl font-normal transition-all whitespace-nowrap snap-center flex-shrink-0",
            value === option.key
              ? "bg-accent-ink text-white shadow-sm"
              : "bg-transparent text-accent-ink hover:bg-white/80"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
