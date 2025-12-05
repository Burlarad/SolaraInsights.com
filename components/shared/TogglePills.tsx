"use client";

import { cn } from "@/lib/utils";

interface TogglePillsProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function TogglePills({ options, value, onChange, className }: TogglePillsProps) {
  return (
    <div className={cn("inline-flex gap-2 p-1 bg-white/50 rounded-full", className)}>
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={cn(
            "pill text-sm font-medium transition-all",
            value === option
              ? "bg-accent-ink text-white shadow-sm"
              : "bg-transparent text-accent-ink hover:bg-white/80"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
