export type LearnCategory =
  | "Astrology Basics"
  | "Astrology Intermediate"
  | "Tarot Basics"
  | "Compatibility";

export interface LearnItem {
  slug: string;
  title: string;
  description: string;
  category: LearnCategory;
  level: "Beginner" | "Intermediate" | "Advanced";
  minutes: number;
  tags: string[];
  image: string;
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
    image: "/images/learn/astrology-101.svg",
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
    image: "/images/learn/big-three.svg",
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
    image: "/images/learn/elements-modalities.svg",
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
    image: "/images/learn/planets-101.svg",
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
    image: "/images/learn/houses-101.svg",
  },

  // ========================================
  // ASTROLOGY INTERMEDIATE
  // ========================================
  {
    slug: "transits-101",
    title: "Transits 101",
    description:
      "What transits are and how to use them for timing — without becoming paranoid.",
    category: "Astrology Intermediate",
    level: "Intermediate",
    minutes: 10,
    tags: ["Transits", "Timing", "Cycles"],
    image: "/images/learn/transits-101.svg",
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
    image: "/images/learn/retrogrades.svg",
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
    image: "/images/learn/nodes-chiron-lilith.svg",
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
    image: "/images/learn/tarot-101.svg",
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
    image: "/images/learn/compatibility-101.svg",
  },
];

// Helper functions
export function getLearnItemBySlug(slug: string): LearnItem | undefined {
  return LEARN_ITEMS.find((item) => item.slug === slug);
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
