import { LearnHero } from "@/components/learn/LearnHero";
import { SearchFilters } from "@/components/learn/SearchFilters";
import { RoadmapRow } from "@/components/learn/RoadmapRow";
import { LearnGuideCard } from "@/components/learn/LearnGuideCard";

const FEATURED_GUIDES = [
  {
    title: "Understanding Your North Node",
    summary:
      "Your North Node reveals your soul's evolutionary path in this lifetime. Learn to read its placement and embrace your karmic calling.",
    readingTime: 12,
    category: "ASTROLOGY",
    tags: ["Astrology", "Advanced", "Timing"],
    heroImage: "/images/guides/north-node.jpg",
  },
  {
    title: "The Art of Daily Draws",
    summary:
      "A single card can shift your entire day. Explore the practice of daily tarot draws and build a ritual that speaks to you.",
    readingTime: 8,
    category: "TAROT",
    tags: ["Tarot", "Rituals", "Foundations"],
    heroImage: "/images/guides/daily-draws.jpg",
  },
  {
    title: "Life Path Numbers Decoded",
    summary:
      "Your Life Path Number is the core vibration of your existence. Discover what yours means and how to work with it.",
    readingTime: 10,
    category: "NUMEROLOGY",
    tags: ["Numerology", "Foundations"],
    heroImage: "/images/guides/life-path.jpg",
  },
  {
    title: "Transits & Timing",
    summary:
      "Learn to read the cosmic weather and time your decisions with planetary transits. Navigate life with celestial awareness.",
    readingTime: 15,
    category: "ASTROLOGY",
    tags: ["Astrology", "Transits", "Timing", "Advanced"],
    heroImage: "/images/guides/transits.jpg",
  },
  {
    title: "Shadow Work & The Moon",
    summary:
      "Use lunar cycles to explore your shadow self with compassion. A guide to gentle, effective inner work.",
    readingTime: 11,
    category: "RITUALS",
    tags: ["Rituals", "Wellness", "Astrology"],
    heroImage: "/images/guides/shadow-moon.jpg",
  },
  {
    title: "Synastry Simplified",
    summary:
      "Understand relationship compatibility through the lens of astrology. Decode connections with clarity and care.",
    readingTime: 14,
    category: "RELATIONSHIPS",
    tags: ["Astrology", "Relationships", "Advanced"],
    heroImage: "/images/guides/synastry.jpg",
  },
];

export default function LearnPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
      <LearnHero />

      <SearchFilters guideCount={11} />

      <RoadmapRow />

      {/* Featured guides grid */}
      <section className="space-y-6">
        <p className="micro-label">FEATURED GUIDES</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURED_GUIDES.map((guide) => (
            <LearnGuideCard key={guide.title} {...guide} />
          ))}
        </div>
      </section>

      {/* Evergreen guide */}
      <section className="pt-8">
        <p className="micro-label mb-4">EVERGREEN GUIDANCE</p>
        <LearnGuideCard
          title="Birth Chart Basics"
          summary="Your birth chart is a map of the sky at the moment you were born. It's the foundation of all astrological work—a cosmic fingerprint that reflects your strengths, challenges, and soul's journey. In this guide, you'll learn how to read your chart with clarity and compassion."
          readingTime={20}
          category="FOUNDATIONS"
          tags={["Astrology", "Foundations", "Wellness"]}
          heroImage="/images/guides/birth-chart-basics.jpg"
        />
      </section>
    </div>
  );
}
