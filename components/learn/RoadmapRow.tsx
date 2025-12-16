import { LearnGuideCard } from "./LearnGuideCard";

const ROADMAP_GUIDES = [
  {
    title: "Soul Path Basics",
    summary: "Understand the foundation of your astrological blueprint.",
    readingTime: 7,
    category: "FOUNDATIONS",
    tags: ["Astrology", "Foundations"],
  },
  {
    title: "The Twelve Houses",
    summary: "Explore the domains of life through the astrological houses.",
    readingTime: 10,
    category: "ASTROLOGY",
    tags: ["Astrology", "Houses"],
  },
  {
    title: "Elements & Temperament",
    summary: "Fire, Earth, Air, Water—discover your elemental nature.",
    readingTime: 6,
    category: "FOUNDATIONS",
    tags: ["Elements", "Foundations"],
  },
  {
    title: "Reading Tarot Intuitively",
    summary: "Move beyond memorization into embodied tarot practice.",
    readingTime: 8,
    category: "TAROT",
    tags: ["Tarot", "Rituals"],
  },
];

export function RoadmapRow() {
  return (
    <section className="py-8">
      <p className="micro-label mb-4">YOUR LEARNING ROADMAP</p>
      {/* Scroll container with edge fade hint */}
      <div className="relative">
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin snap-x snap-mandatory overscroll-x-contain">
          {ROADMAP_GUIDES.map((guide) => (
            <div key={guide.title} className="snap-start flex-shrink-0">
              <LearnGuideCard {...guide} variant="roadmap" />
            </div>
          ))}
        </div>
        {/* Right edge fade hint (scroll affordance) */}
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-shell to-transparent"
          aria-hidden="true"
        />
      </div>
    </section>
  );
}
