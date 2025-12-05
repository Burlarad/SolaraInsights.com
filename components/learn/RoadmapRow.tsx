import { LearnGuideCard } from "./LearnGuideCard";

const ROADMAP_GUIDES = [
  {
    title: "Birth Chart Basics",
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
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {ROADMAP_GUIDES.map((guide) => (
          <LearnGuideCard
            key={guide.title}
            {...guide}
            variant="roadmap"
          />
        ))}
      </div>
    </section>
  );
}
