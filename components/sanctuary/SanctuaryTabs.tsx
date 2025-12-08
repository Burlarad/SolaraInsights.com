"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Insights", href: "/sanctuary" },
  { label: "Birth Chart", href: "/sanctuary/birth-chart" },
  { label: "Connections", href: "/sanctuary/connections" },
  { label: "Library", href: "/sanctuary/library", disabled: true },
];

export function SanctuaryTabs() {
  const pathname = usePathname();

  return (
    <div className="inline-flex gap-2 p-1 bg-white/50 rounded-full">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;

        return (
          <Link
            key={tab.href}
            href={tab.disabled ? "#" : tab.href}
            className={cn(
              "pill text-sm font-medium transition-all",
              isActive
                ? "bg-accent-ink text-white shadow-sm"
                : "bg-transparent text-accent-ink hover:bg-white/80",
              tab.disabled && "opacity-50 cursor-not-allowed"
            )}
            onClick={(e) => tab.disabled && e.preventDefault()}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
