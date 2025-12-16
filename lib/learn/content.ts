export type LearnStatus = "live" | "coming_soon";

export type LearnCategory =
  | "Astrology Basics"
  | "Astrology Intermediate"
  | "Tarot Basics"
  | "Compatibility"
  | "Sanctuary"
  | "Settings"
  | "Connections"
  | "Journal";

export interface LearnItem {
  slug: string;
  title: string;
  description: string;
  category: LearnCategory;
  level: "Beginner" | "Intermediate" | "Advanced";
  minutes: number;
  tags: string[];
  status: LearnStatus;
}

export const LEARN_ITEMS: LearnItem[] = [
  // ========================================
  // ASTROLOGY BASICS (Foundations)
  // ========================================
  {
    slug: "astrology-101",
    title: "Astrology 101",
    description:
      "What astrology is (and isn't). The chart basics without the woo-woo overwhelm.",
    category: "Astrology Basics",
    level: "Beginner",
    minutes: 6,
    tags: ["Signs", "Charts", "Foundations"],
    status: "live",
  },
  {
    slug: "big-three",
    title: "The Big Three",
    description:
      "Sun, Moon, and Rising — the three placements everyone should know first.",
    category: "Astrology Basics",
    level: "Beginner",
    minutes: 7,
    tags: ["Sun", "Moon", "Rising"],
    status: "live",
  },
  {
    slug: "elements-modalities",
    title: "Elements & Modalities",
    description:
      "Fire, Earth, Air, Water — plus Cardinal, Fixed, Mutable. Why signs behave the way they do.",
    category: "Astrology Basics",
    level: "Beginner",
    minutes: 8,
    tags: ["Elements", "Modalities", "Signs"],
    status: "live",
  },
  {
    slug: "planets-101",
    title: "Planets 101",
    description:
      "The 10 planets as roles in your psyche — not vibes, but actual functions.",
    category: "Astrology Basics",
    level: "Beginner",
    minutes: 9,
    tags: ["Planets", "Mercury", "Venus", "Mars"],
    status: "live",
  },
  {
    slug: "houses-101",
    title: "Houses 101",
    description:
      "The 12 houses as life areas. Where things happen in your chart.",
    category: "Astrology Basics",
    level: "Beginner",
    minutes: 10,
    tags: ["Houses", "Angles", "Life Areas"],
    status: "live",
  },
  {
    slug: "aspects-101",
    title: "Aspects 101",
    description:
      "Conjunctions, squares, trines, and more. How planets talk to each other.",
    category: "Astrology Basics",
    level: "Beginner",
    minutes: 8,
    tags: ["Aspects", "Conjunction", "Square", "Trine"],
    status: "coming_soon",
  },

  // ========================================
  // ASTROLOGY INTERMEDIATE
  // ========================================
  {
    slug: "reading-a-chart",
    title: "Reading a Chart",
    description:
      "How to read a birth chart in 10 practical steps — no memorization required.",
    category: "Astrology Intermediate",
    level: "Intermediate",
    minutes: 12,
    tags: ["Charts", "Interpretation", "Practical"],
    status: "coming_soon",
  },
  {
    slug: "transits-101",
    title: "Transits 101",
    description:
      "What transits are and how to use them for timing — without becoming paranoid.",
    category: "Astrology Intermediate",
    level: "Intermediate",
    minutes: 10,
    tags: ["Transits", "Timing", "Cycles"],
    status: "coming_soon",
  },
  {
    slug: "retrogrades",
    title: "Retrogrades Explained",
    description:
      "What retrogrades actually mean. Spoiler: not doom, just review periods.",
    category: "Astrology Intermediate",
    level: "Intermediate",
    minutes: 7,
    tags: ["Retrogrades", "Mercury", "Cycles"],
    status: "coming_soon",
  },
  {
    slug: "nodes-chiron-lilith",
    title: "Nodes, Chiron & Lilith",
    description:
      "The nodal axis, wounded healer, and dark moon — sensitive points that add depth.",
    category: "Astrology Intermediate",
    level: "Intermediate",
    minutes: 11,
    tags: ["Nodes", "Chiron", "Lilith"],
    status: "coming_soon",
  },
  {
    slug: "timing-toolkit",
    title: "Timing Toolkit",
    description:
      "How to use astrology for planning without becoming dependent on it.",
    category: "Astrology Intermediate",
    level: "Intermediate",
    minutes: 8,
    tags: ["Timing", "Planning", "Practical"],
    status: "coming_soon",
  },

  // ========================================
  // TAROT
  // ========================================
  {
    slug: "tarot-101",
    title: "Tarot 101",
    description:
      "How tarot works, what spreads do, and how to ask questions that get useful answers.",
    category: "Tarot Basics",
    level: "Beginner",
    minutes: 7,
    tags: ["Spreads", "Questions", "Reversals"],
    status: "live",
  },

  // ========================================
  // COMPATIBILITY
  // ========================================
  {
    slug: "compatibility-101",
    title: "Compatibility 101",
    description:
      "How sign compatibility works in Solara — and what it does (and doesn't) mean.",
    category: "Compatibility",
    level: "Beginner",
    minutes: 5,
    tags: ["Signs", "Dynamics", "Practical"],
    status: "live",
  },

  // ========================================
  // SOLARA FEATURES
  // ========================================
  {
    slug: "sanctuary-tour",
    title: "Sanctuary Tour",
    description:
      "A guided walkthrough of Sanctuary: Insights, Soul Path, Connections, and how it fits together.",
    category: "Sanctuary",
    level: "Beginner",
    minutes: 6,
    tags: ["Insights", "Soul Path", "Connections"],
    status: "coming_soon",
  },
  {
    slug: "settings-guide",
    title: "Settings Guide",
    description:
      "How to set birth data correctly, why timezone matters, and what gets locked.",
    category: "Settings",
    level: "Beginner",
    minutes: 6,
    tags: ["Birth Data", "Timezone", "Profile"],
    status: "coming_soon",
  },
  {
    slug: "connections-guide",
    title: "Connections Guide",
    description:
      "How to use Connections to explore relationship dynamics without overthinking.",
    category: "Connections",
    level: "Beginner",
    minutes: 6,
    tags: ["People", "Dynamics", "Reflection"],
    status: "coming_soon",
  },
  {
    slug: "journal-guide",
    title: "Journal Guide",
    description:
      "How to use journaling inside Solara to turn insights into behavior changes.",
    category: "Journal",
    level: "Beginner",
    minutes: 5,
    tags: ["Reflection", "Habits", "Clarity"],
    status: "coming_soon",
  },
];

// Helper functions
export function getLearnItemBySlug(slug: string): LearnItem | undefined {
  return LEARN_ITEMS.find((item) => item.slug === slug);
}

export function getLiveItems(): LearnItem[] {
  return LEARN_ITEMS.filter((item) => item.status === "live");
}

export function getComingSoonItems(): LearnItem[] {
  return LEARN_ITEMS.filter((item) => item.status === "coming_soon");
}

export function getAllCategories(): LearnCategory[] {
  return [...new Set(LEARN_ITEMS.map((item) => item.category))];
}

export function getAllTags(): string[] {
  const tags = LEARN_ITEMS.flatMap((item) => item.tags);
  return [...new Set(tags)].sort();
}

export function filterLearnItems(
  items: LearnItem[],
  query: string,
  categories: LearnCategory[],
  levels: ("Beginner" | "Intermediate" | "Advanced")[]
): LearnItem[] {
  return items.filter((item) => {
    // Search query filter
    if (query) {
      const searchLower = query.toLowerCase();
      const matchesSearch =
        item.title.toLowerCase().includes(searchLower) ||
        item.description.toLowerCase().includes(searchLower) ||
        item.tags.some((tag) => tag.toLowerCase().includes(searchLower)) ||
        item.category.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Category filter
    if (categories.length > 0 && !categories.includes(item.category)) {
      return false;
    }

    // Level filter
    if (levels.length > 0 && !levels.includes(item.level)) {
      return false;
    }

    return true;
  });
}

export function getPrevNextLearnItems(slug: string): {
  prev?: LearnItem;
  next?: LearnItem;
} {
  const currentIndex = LEARN_ITEMS.findIndex((item) => item.slug === slug);

  if (currentIndex === -1) {
    return {};
  }

  const prev = currentIndex > 0 ? LEARN_ITEMS[currentIndex - 1] : undefined;
  const next =
    currentIndex < LEARN_ITEMS.length - 1
      ? LEARN_ITEMS[currentIndex + 1]
      : undefined;

  return { prev, next };
}
