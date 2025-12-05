"use client";

import { TogglePills } from "@/components/shared/TogglePills";

const TIMEFRAME_OPTIONS = ["Today", "Week", "Month", "Year"];

interface TimeframeToggleProps {
  value: string;
  onChange: (value: string) => void;
}

export function TimeframeToggle({ value, onChange }: TimeframeToggleProps) {
  return (
    <div className="flex flex-col gap-2">
      <TogglePills
        options={TIMEFRAME_OPTIONS}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
