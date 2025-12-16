"use client";

import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/shared/Chip";
import { Search, X } from "lucide-react";
import {
  LearnItem,
  LearnCategory,
  getAllCategories,
  filterLearnItems,
} from "@/lib/learn/content";

interface SearchFiltersProps {
  items: LearnItem[];
  onFilterChange: (filteredItems: LearnItem[]) => void;
}

export function SearchFilters({ items, onFilterChange }: SearchFiltersProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<LearnCategory[]>([]);

  const categories = useMemo(() => getAllCategories(), []);

  // Apply filters and notify parent
  const applyFilters = useCallback(
    (query: string, cats: LearnCategory[]) => {
      const filtered = filterLearnItems(items, query, cats, []);
      onFilterChange(filtered);
    },
    [items, onFilterChange]
  );

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    applyFilters(value, activeCategories);
  };

  const toggleCategory = (category: LearnCategory) => {
    const newCategories = activeCategories.includes(category)
      ? activeCategories.filter((c) => c !== category)
      : [...activeCategories, category];
    setActiveCategories(newCategories);
    applyFilters(searchQuery, newCategories);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setActiveCategories([]);
    applyFilters("", []);
  };

  const hasActiveFilters = searchQuery.length > 0 || activeCategories.length > 0;

  // Count results
  const filteredCount = useMemo(() => {
    return filterLearnItems(items, searchQuery, activeCategories, []).length;
  }, [items, searchQuery, activeCategories]);

  return (
    <Card className="p-4 md:p-6">
      <CardContent className="p-0 space-y-4">
        {/* Search bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-accent-ink/40"
              aria-hidden="true"
            />
            <Input
              type="text"
              placeholder="Search guides..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              aria-label="Search guides"
              className="pl-10 h-11 text-base"
            />
            {searchQuery && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-accent-ink/40 hover:text-accent-ink"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="text-sm text-accent-ink/60 whitespace-nowrap">
            {filteredCount} {filteredCount === 1 ? "guide" : "guides"} found
          </p>
        </div>

        {/* Category filter chips */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-accent-ink/50 uppercase tracking-wide">
              Filter by topic
            </span>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-accent-gold hover:underline"
              >
                Clear all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Chip
                key={category}
                active={activeCategories.includes(category)}
                onClick={() => toggleCategory(category)}
                aria-pressed={activeCategories.includes(category)}
                className="min-h-[44px] px-4"
              >
                {category}
              </Chip>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
