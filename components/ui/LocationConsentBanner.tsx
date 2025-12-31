"use client";

/**
 * LocationConsentBanner - Subtle bottom banner for geolocation consent
 *
 * Design goals:
 * - Non-blocking (not a modal)
 * - Matches Solara's warm aesthetic
 * - Dismissible
 * - Never reappears after user responds
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface LocationConsentBannerProps {
  show: boolean;
  onAllow: () => Promise<void>;
  onDismiss: () => void;
  isLoading?: boolean;
}

export function LocationConsentBanner({
  show,
  onAllow,
  onDismiss,
  isLoading = false,
}: LocationConsentBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  // Animate in/out
  useEffect(() => {
    if (show) {
      // Small delay before showing to avoid flash on fast loads
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [show]);

  const handleAllow = async () => {
    setIsRequesting(true);
    try {
      await onAllow();
    } finally {
      setIsRequesting(false);
    }
  };

  if (!show && !isVisible) return null;

  return (
    <div
      className={`
        fixed bottom-0 left-0 right-0 z-50
        transform transition-all duration-500 ease-out
        ${isVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"}
      `}
      role="dialog"
      aria-label="Location access request"
    >
      <div className="mx-4 mb-4 md:mx-auto md:max-w-2xl">
        <div
          className="
            bg-[#FDF6F0] border border-[#E8DED4]
            rounded-2xl shadow-lg
            p-4 md:p-5
          "
        >
          {/* Content */}
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            {/* Icon and text */}
            <div className="flex-1 flex items-start gap-3">
              <span className="text-2xl flex-shrink-0" aria-hidden="true">
                🌍
              </span>
              <div className="space-y-1">
                <p className="font-medium text-[#2D2A26] text-sm md:text-base">
                  Allow location for accurate daily insights
                </p>
                <p className="text-xs md:text-sm text-[#6B6560]">
                  This ensures your horoscopes and guidance update at the right
                  time for your timezone.
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-shrink-0">
              <Button
                onClick={handleAllow}
                disabled={isRequesting || isLoading}
                className="
                  bg-[#C9A227] hover:bg-[#B8931F] text-white
                  font-medium px-5 py-2.5
                  rounded-full
                  transition-all duration-200
                  disabled:opacity-50
                "
              >
                {isRequesting ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Locating...
                  </span>
                ) : (
                  "Allow Location"
                )}
              </Button>

              <Button
                onClick={onDismiss}
                disabled={isRequesting}
                variant="ghost"
                className="
                  text-[#6B6560] hover:text-[#2D2A26]
                  hover:bg-[#F5EDE6]
                  font-medium px-4 py-2.5
                  rounded-full
                  transition-all duration-200
                "
              >
                Continue Without
              </Button>
            </div>
          </div>

          {/* Close button for mobile */}
          <button
            onClick={onDismiss}
            disabled={isRequesting}
            className="
              absolute top-3 right-3
              text-[#9C9590] hover:text-[#6B6560]
              p-1 rounded-full
              transition-colors duration-200
              md:hidden
            "
            aria-label="Dismiss"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
