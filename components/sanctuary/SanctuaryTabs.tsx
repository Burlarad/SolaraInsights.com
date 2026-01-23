"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const TAB_KEYS = ["insights", "connections", "tarot", "astrology", "numerology"] as const;

const TAB_HREFS: Record<typeof TAB_KEYS[number], string> = {
  insights: "/sanctuary",
  astrology: "/sanctuary/birth-chart",
  numerology: "/sanctuary/numerology",
  connections: "/sanctuary/connections",
  tarot: "/sanctuary/tarot",
};

export function SanctuaryTabs() {
  const t = useTranslations("sanctuary.tabs");
  const pathname = usePathname();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(true);

  const isMobile = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 767px)").matches;
  }, []);

  const updateFades = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    const maxScroll = scrollWidth - clientWidth;

    setShowLeftFade(scrollLeft > 8);
    setShowRightFade(scrollLeft < maxScroll - 8);
  }, []);

  useEffect(() => {
    if (!isMobile()) return;

    const activeTab = tabRefs.current.get(pathname);
    if (activeTab) {
      setTimeout(() => {
        activeTab.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
      }, 50);
    }

    setTimeout(updateFades, 150);
  }, [pathname, isMobile, updateFades]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    updateFades();

    container.addEventListener("scroll", updateFades, { passive: true });
    window.addEventListener("resize", updateFades, { passive: true });

    return () => {
      container.removeEventListener("scroll", updateFades);
      window.removeEventListener("resize", updateFades);
    };
  }, [updateFades]);

  const setTabRef = useCallback((href: string, el: HTMLAnchorElement | null) => {
    if (el) {
      tabRefs.current.set(href, el);
    } else {
      tabRefs.current.delete(href);
    }
  }, []);

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:inline-flex gap-2 p-1 bg-white/50 rounded-full relative z-10">
        {TAB_KEYS.map((key) => {
          const href = TAB_HREFS[key];
          const isActive = pathname === href;

          return (
            <Link
              key={key}
              href={href}
              className={cn(
                "pill font-cursive text-xl md:text-2xl font-normal transition-all",
                isActive
                  ? "bg-accent-ink text-white shadow-sm"
                  : "bg-transparent text-accent-ink hover:bg-white/80"
              )}
            >
              {t(key)}
            </Link>
          );
        })}
      </div>

      {/* Mobile */}
      <div className="md:hidden relative w-full min-w-0 z-10">
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-6 z-10 pointer-events-none transition-opacity duration-200",
            "bg-gradient-to-r from-body to-transparent",
            showLeftFade ? "opacity-100" : "opacity-0"
          )}
        />

        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 w-6 z-10 pointer-events-none transition-opacity duration-200",
            "bg-gradient-to-l from-body to-transparent",
            showRightFade ? "opacity-100" : "opacity-0"
          )}
        />

        <div
          ref={scrollContainerRef}
          className={cn(
            "w-full flex gap-2 p-1 bg-white/50 rounded-full",
            "overflow-x-auto overscroll-x-contain",
            "snap-x",
            "scrollbar-none",
            "[-webkit-overflow-scrolling:touch]"
          )}
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {TAB_KEYS.map((key) => {
            const href = TAB_HREFS[key];
            const isActive = pathname === href;

            return (
              <Link
                key={key}
                ref={(el) => setTabRef(href, el)}
                href={href}
                className={cn(
                  "flex-shrink-0 snap-center",
                  "min-h-[44px] px-5 py-2.5 rounded-full",
                  "font-cursive text-xl font-normal transition-all",
                  "flex items-center justify-center",
                  isActive
                    ? "bg-accent-ink text-white shadow-sm"
                    : "bg-transparent text-accent-ink hover:bg-white/80"
                )}
              >
                {t(key)}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
