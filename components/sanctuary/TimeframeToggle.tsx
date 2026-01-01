"use client";

import { useTranslations } from "next-intl";
import { TogglePills } from "@/components/shared/TogglePills";

const TIMEFRAME_KEYS = ["today", "year"] as const;

interface TimeframeToggleProps {
  value: string;
  onChange: (value: string) => void;
}

export function TimeframeToggle({ value, onChange }: TimeframeToggleProps) {
  const t = useTranslations("sanctuary.timeframes");

  const options = TIMEFRAME_KEYS.map((key) => ({
    key,
    label: t(key),
  }));

  return (
    <TogglePills
      options={options}
      value={value}
      onChange={onChange}
    />
  );
}
