"use client";

/**
 * PlacePicker - Location search with autocomplete dropdown.
 *
 * Features:
 * - Debounced search (300ms)
 * - Dropdown with selectable candidates
 * - Returns pre-resolved location data (city, region, country, lat, lon, timezone)
 * - Click-outside to close dropdown
 * - Keyboard navigation (Escape to close)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PlaceSelection = {
  birth_city: string;
  birth_region: string;
  birth_country: string;
  birth_lat: number;
  birth_lon: number;
  timezone: string;
};

type LocationCandidate = {
  displayName: string;
  birth_city: string;
  birth_region: string;
  birth_country: string;
  lat: number;
  lon: number;
  timezone: string;
};

interface PlacePickerProps {
  /** Initial display value for the input */
  initialValue?: string;
  /** Callback when a place is selected */
  onSelect: (place: PlaceSelection) => void;
  /** Callback when the input is cleared */
  onClear?: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional class names */
  className?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
}

export function PlacePicker({
  initialValue = "",
  onSelect,
  onClear,
  placeholder = "Search for a city...",
  className,
  disabled = false,
}: PlacePickerProps) {
  const [query, setQuery] = useState(initialValue);
  const [candidates, setCandidates] = useState<LocationCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Track the last selected label to avoid overwriting user's selection
  const selectedLabelRef = useRef<string | null>(null);
  // Track if user has manually typed (edited the input)
  const hasUserTypedRef = useRef(false);

  // Sync query with initialValue when it changes asynchronously (e.g., profile loads)
  useEffect(() => {
    // Only update if:
    // 1. initialValue is non-empty
    // 2. User hasn't manually typed in the field
    // 3. The current query is empty OR matches the previous selected label (hydration case)
    if (
      initialValue &&
      !hasUserTypedRef.current &&
      (query === "" || query === selectedLabelRef.current)
    ) {
      setQuery(initialValue);
      selectedLabelRef.current = initialValue;
    }
  }, [initialValue]); // Only depend on initialValue, not query

  // Debounced search function
  const searchLocations = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setCandidates([]);
      setIsOpen(false);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/location/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery }),
      });

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data = await response.json();
      setCandidates(data.candidates || []);
      setHasSearched(true);
      // Always open dropdown after search so user sees results OR "no results" message
      setIsOpen(true);
    } catch (err) {
      console.error("[PlacePicker] Search error:", err);
      setError("Search failed. Please try again.");
      setCandidates([]);
      setHasSearched(true);
      setIsOpen(true); // Show error state in dropdown area
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Mark that user has typed - this prevents initialValue from overwriting
    hasUserTypedRef.current = true;

    // Clear previous debounce timer
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Clear selection if input is cleared or user edits away from selected label
    if (!value.trim()) {
      setHasSearched(false);
      selectedLabelRef.current = null;
      hasUserTypedRef.current = false; // Reset so future initialValue updates can work
      if (onClear) {
        onClear();
      }
    } else if (value !== selectedLabelRef.current) {
      // User is typing something different from the selected value
      // Clear the upstream selection
      if (onClear) {
        onClear();
      }
    }

    // Debounce the search
    debounceRef.current = setTimeout(() => {
      searchLocations(value);
    }, 300);
  };

  // Handle candidate selection
  const handleSelect = (candidate: LocationCandidate) => {
    setQuery(candidate.displayName);
    setCandidates([]);
    setIsOpen(false);
    setHasSearched(false);

    // Track the selected label so we can preserve it
    selectedLabelRef.current = candidate.displayName;
    hasUserTypedRef.current = false; // Reset - user made a valid selection

    onSelect({
      birth_city: candidate.birth_city,
      birth_region: candidate.birth_region,
      birth_country: candidate.birth_country,
      birth_lat: candidate.lat,
      birth_lon: candidate.lon,
      timezone: candidate.timezone,
    });
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (candidates.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="pr-8"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent-ink/30 border-t-accent-ink" />
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1 text-xs text-danger-soft">{error}</p>
      )}

      {/* Dropdown */}
      {isOpen && candidates.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border-subtle bg-white shadow-lg">
          <ul className="max-h-60 overflow-auto py-1">
            {candidates.map((candidate, index) => (
              <li key={`${candidate.displayName}-${index}`}>
                <button
                  type="button"
                  onClick={() => handleSelect(candidate)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-shell transition-colors"
                >
                  <span className="font-medium text-accent-ink">
                    {candidate.birth_city}
                  </span>
                  {(candidate.birth_region || candidate.birth_country) && (
                    <span className="text-accent-ink/60">
                      {candidate.birth_region && `, ${candidate.birth_region}`}
                      {candidate.birth_country && `, ${candidate.birth_country}`}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* No results message */}
      {isOpen && hasSearched && candidates.length === 0 && !isLoading && !error && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border-subtle bg-white p-3 shadow-lg">
          <p className="text-sm text-accent-ink/60">
            No locations found. Try a different search term.
          </p>
        </div>
      )}
    </div>
  );
}
