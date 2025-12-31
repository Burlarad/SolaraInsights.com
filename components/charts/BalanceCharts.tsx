"use client";

import { cn } from "@/lib/utils";

interface ElementBalance {
  fire: number;
  earth: number;
  air: number;
  water: number;
}

interface ModalityBalance {
  cardinal: number;
  fixed: number;
  mutable: number;
}

interface BalanceChartsProps {
  elementBalance: ElementBalance;
  modalityBalance: ModalityBalance;
  className?: string;
}

const ELEMENT_COLORS = {
  fire: { bg: "bg-orange-500", light: "bg-orange-100", text: "text-orange-700" },
  earth: { bg: "bg-emerald-600", light: "bg-emerald-100", text: "text-emerald-700" },
  air: { bg: "bg-sky-500", light: "bg-sky-100", text: "text-sky-700" },
  water: { bg: "bg-blue-600", light: "bg-blue-100", text: "text-blue-700" },
};

const MODALITY_COLORS = {
  cardinal: { bg: "bg-red-500", light: "bg-red-100", text: "text-red-700" },
  fixed: { bg: "bg-amber-500", light: "bg-amber-100", text: "text-amber-700" },
  mutable: { bg: "bg-purple-500", light: "bg-purple-100", text: "text-purple-700" },
};

function BalanceBar({
  label,
  value,
  maxValue,
  colors,
}: {
  label: string;
  value: number;
  maxValue: number;
  colors: { bg: string; light: string; text: string };
}) {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className={cn("font-medium capitalize", colors.text)}>{label}</span>
        <span className="text-accent-ink/60">{value}</span>
      </div>
      <div className={cn("h-3 rounded-full overflow-hidden", colors.light)}>
        <div
          className={cn("h-full rounded-full transition-all duration-500", colors.bg)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function BalanceCharts({
  elementBalance,
  modalityBalance,
  className,
}: BalanceChartsProps) {
  const elementTotal = Object.values(elementBalance).reduce((a, b) => a + b, 0);
  const modalityTotal = Object.values(modalityBalance).reduce((a, b) => a + b, 0);

  // Find max for scaling
  const elementMax = Math.max(...Object.values(elementBalance), 1);
  const modalityMax = Math.max(...Object.values(modalityBalance), 1);

  return (
    <div className={cn("grid md:grid-cols-2 gap-6", className)}>
      {/* Elements */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-accent-ink/70 uppercase tracking-wide">
          Elements
        </h4>
        <div className="space-y-3">
          {(Object.entries(elementBalance) as [keyof ElementBalance, number][]).map(
            ([element, value]) => (
              <BalanceBar
                key={element}
                label={element}
                value={value}
                maxValue={elementMax}
                colors={ELEMENT_COLORS[element]}
              />
            )
          )}
        </div>
        <p className="text-xs text-accent-ink/50">
          Total placements: {elementTotal}
        </p>
      </div>

      {/* Modalities */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-accent-ink/70 uppercase tracking-wide">
          Modalities
        </h4>
        <div className="space-y-3">
          {(Object.entries(modalityBalance) as [keyof ModalityBalance, number][]).map(
            ([modality, value]) => (
              <BalanceBar
                key={modality}
                label={modality}
                value={value}
                maxValue={modalityMax}
                colors={MODALITY_COLORS[modality]}
              />
            )
          )}
        </div>
        <p className="text-xs text-accent-ink/50">
          Total placements: {modalityTotal}
        </p>
      </div>
    </div>
  );
}
