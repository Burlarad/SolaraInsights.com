"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Insights", href: "/sanctuary" },
  { label: "Astrology", href: "/sanctuary/birth-chart" },
  { label: "Numerology", href: "/sanctuary/numerology" },
  { label: "Connections", href: "/sanctuary/connections" },
];

export function SanctuaryTabs() {
  const pathname = usePathname();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(true);

  // Check if we're on mobile
  const isMobile = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 767px)").matches;
  }, []);

  // Update fade visibility based on scroll position
  const updateFades = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    const maxScroll = scrollWidth - clientWidth;

    // Show left fade if scrolled right
    setShowLeftFade(scrollLeft > 8);
    // Show right fade if more content to the right
    setShowRightFade(scrollLeft < maxScroll - 8);
  }, []);

  // Center the active tab on mount and when pathname changes
  useEffect(() => {
    if (!isMobile()) return;

    const activeTab = tabRefs.current.get(pathname);
    if (activeTab) {
      // Small delay to ensure layout is complete
      setTimeout(() => {
        activeTab.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
      }, 50);
    }

    // Update fades after centering
    setTimeout(updateFades, 150);
  }, [pathname, isMobile, updateFades]);

  // Set up scroll listener for fade updates
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Initial fade check
    updateFades();

    container.addEventListener("scroll", updateFades, { passive: true });
    window.addEventListener("resize", updateFades, { passive: true });

    return () => {
      container.removeEventListener("scroll", updateFades);
      window.removeEventListener("resize", updateFades);
    };
  }, [updateFades]);

  // Store ref for each tab
  const setTabRef = useCallback((href: string, el: HTMLAnchorElement | null) => {
    if (el) {
      tabRefs.current.set(href, el);
    } else {
      tabRefs.current.delete(href);
    }
  }, []);

  return (
    <>
      {/* Desktop: Original inline layout */}
      <div className="hidden md:inline-flex gap-2 p-1 bg-white/50 rounded-full">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "pill font-cursive text-xl md:text-2xl font-normal transition-all",
                isActive
                  ? "bg-accent-ink text-white shadow-sm"
                  : "bg-transparent text-accent-ink hover:bg-white/80"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Mobile: Scrollable tabs with fades */}
      <div className="md:hidden relative w-full min-w-0">
        {/* Left fade */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-6 z-10 pointer-events-none transition-opacity duration-200",
            "bg-gradient-to-r from-body to-transparent",
            showLeftFade ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Right fade */}
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 w-6 z-10 pointer-events-none transition-opacity duration-200",
            "bg-gradient-to-l from-body to-transparent",
            showRightFade ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Scroll container */}
        <div
          ref={scrollContainerRef}
          className={cn(
            "w-full flex gap-2 p-1 bg-white/50 rounded-full",
            "overflow-x-auto overscroll-x-contain",
            "snap-x snap-mandatory",
            "scrollbar-none",
            "[-webkit-overflow-scrolling:touch]"
          )}
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;

            return (
              <Link
                key={tab.href}
                ref={(el) => setTabRef(tab.href, el)}
                href={tab.href}
                className={cn(
                  "flex-shrink-0 snap-center",
                  "min-h-[44px] px-5 py-2.5 rounded-full",
                  "font-cursive text-xl font-normal transition-all",
                  "flex items-center justify-center",
                  isActive
                    ? "bg-accent-ink text-white shadow-sm"
                    : "bg-transparent text-accent-ink hover:bg-white/80"
                )}
                onClick={() => {
                  // Center this tab on tap
                  const target = tabRefs.current.get(tab.href);
                  if (target) {
                    setTimeout(() => {
                      target.scrollIntoView({
                        behavior: "smooth",
                        inline: "center",
                        block: "nearest",
                      });
                    }, 10);
                  }
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
