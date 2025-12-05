"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/shared/Chip";
import { Search } from "lucide-react";

const FILTER_TAGS = [
  "Advanced",
  "Astrology",
  "Elements",
  "Foundations",
  "Houses",
  "Numerology",
  "Relationships",
  "Rituals",
  "Tarot",
  "Timing",
  "Transits",
  "Travel",
  "Wellness",
];

interface SearchFiltersProps {
  guideCount?: number;
}

export function SearchFilters({ guideCount = 11 }: SearchFiltersProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const toggleFilter = (tag: string) => {
    setActiveFilters((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setActiveFilters([]);
    setSearchQuery("");
  };

  return (
    <Card className="p-8">
      <CardContent className="p-0 space-y-6">
        {/* Search bar */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-accent-ink/40" />
            <Input
              type="text"
              placeholder="Search guides, houses, or rituals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-base"
            />
          </div>
          <p className="text-sm text-accent-ink/60 whitespace-nowrap">
            {guideCount} guides in steady orbit
          </p>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {FILTER_TAGS.map((tag) => (
              <Chip
                key={tag}
                active={activeFilters.includes(tag)}
                onClick={() => toggleFilter(tag)}
              >
                {tag}
              </Chip>
            ))}
          </div>
          <button
            onClick={clearFilters}
            className="text-sm text-accent-gold hover:underline ml-auto"
          >
            Clear filters
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
