/**
 * Numerology Number Meanings
 *
 * Static interpretations for numbers 1-9 and master numbers 11, 22, 33.
 * Used throughout the numerology pages for consistent, rich descriptions.
 */

export interface NumberMeaning {
  keyword: string;
  brief: string; // 1 sentence
  description: string; // 2-3 sentences
  energy: string; // what this energy is about
  dayGuidance: string; // for personal day context
  monthGuidance: string; // for personal month context
  yearGuidance: string; // for personal year context
}

export const NUMBER_MEANINGS: Record<number, NumberMeaning> = {
  1: {
    keyword: "The Pioneer",
    brief: "The pioneer, leader, and individualist.",
    description:
      "One energy is about new beginnings, self-reliance, and forging your own path. It carries the vibration of originality, ambition, and the courage to stand alone. This is the number of initiative and independent action.",
    energy: "Leadership, initiative, new starts, independence",
    dayGuidance:
      "Take initiative today. Start something new, make bold decisions, and trust your instincts to lead.",
    monthGuidance:
      "A month for new beginnings and taking the lead. Plant seeds for projects you want to grow. Assert yourself.",
    yearGuidance:
      "A year of fresh starts, planting seeds, and stepping into leadership. Major new chapters begin now.",
  },
  2: {
    keyword: "The Diplomat",
    brief: "The peacemaker, partner, and sensitive soul.",
    description:
      "Two energy is about cooperation, balance, and working with others. It carries the vibration of diplomacy, patience, and emotional sensitivity. This is the number of relationships and intuitive receptivity.",
    energy: "Partnership, balance, cooperation, intuition",
    dayGuidance:
      "Focus on collaboration today. Listen more than you speak. Partnerships and compromise bring success.",
    monthGuidance:
      "A month for nurturing relationships and finding balance. Patience is rewarded. Work behind the scenes.",
    yearGuidance:
      "A year of partnerships, patience, and tending to details. Let things develop slowly. Support others.",
  },
  3: {
    keyword: "The Creative",
    brief: "The artist, communicator, and joyful spirit.",
    description:
      "Three energy is about self-expression, creativity, and joy. It carries the vibration of communication, optimism, and artistic talent. This is the number of inspiration and social connection.",
    energy: "Creativity, expression, joy, communication",
    dayGuidance:
      "Express yourself freely today. Create, communicate, and connect socially. Let joy guide your actions.",
    monthGuidance:
      "A month for creative projects and social activities. Share your ideas. Embrace optimism and playfulness.",
    yearGuidance:
      "A year of creative expansion and self-expression. Your voice matters. Pursue artistic and social opportunities.",
  },
  4: {
    keyword: "The Builder",
    brief: "The architect, worker, and practical foundation.",
    description:
      "Four energy is about structure, hard work, and building solid foundations. It carries the vibration of discipline, organization, and practical achievement. This is the number of stability and determined effort.",
    energy: "Structure, discipline, hard work, stability",
    dayGuidance:
      "Focus on practical tasks today. Build systems, organize, and put in the work. Solid foundations matter.",
    monthGuidance:
      "A month for hard work and building structure. Get organized. Focus on responsibilities and long-term goals.",
    yearGuidance:
      "A year of building and hard work. Lay foundations for the future. Discipline and persistence pay off.",
  },
  5: {
    keyword: "The Adventurer",
    brief: "The explorer, freedom-seeker, and agent of change.",
    description:
      "Five energy is about freedom, change, and new experiences. It carries the vibration of adventure, versatility, and dynamic movement. This is the number of transformation and sensory exploration.",
    energy: "Freedom, change, adventure, versatility",
    dayGuidance:
      "Embrace change today. Try something new, be flexible, and welcome unexpected opportunities.",
    monthGuidance:
      "A month of change and variety. Travel, explore, and break free from routine. Adaptability is key.",
    yearGuidance:
      "A year of major changes and new freedom. Life accelerates. Embrace adventure and release what holds you back.",
  },
  6: {
    keyword: "The Nurturer",
    brief: "The caregiver, healer, and keeper of harmony.",
    description:
      "Six energy is about love, responsibility, and domestic harmony. It carries the vibration of nurturing, beauty, and service to others. This is the number of home, family, and healing.",
    energy: "Love, responsibility, harmony, service",
    dayGuidance:
      "Focus on home and loved ones today. Nurture relationships. Create beauty and harmony in your space.",
    monthGuidance:
      "A month for family, home, and responsibilities. Take care of others. Focus on domestic harmony and beauty.",
    yearGuidance:
      "A year centered on home, family, and responsibilities. Relationships deepen. Service to others brings fulfillment.",
  },
  7: {
    keyword: "The Seeker",
    brief: "The mystic, analyst, and spiritual searcher.",
    description:
      "Seven energy is about introspection, wisdom, and spiritual depth. It carries the vibration of analysis, intuition, and inner knowing. This is the number of contemplation and deeper understanding.",
    energy: "Wisdom, introspection, spirituality, analysis",
    dayGuidance:
      "Seek solitude and reflection today. Research, study, or meditate. Not ideal for big social gatherings.",
    monthGuidance:
      "A month for inner work and study. Seek knowledge. Trust your intuition. Quality over quantity in all things.",
    yearGuidance:
      "A year of spiritual growth and inner development. Study, reflect, and trust your intuition. Answers come from within.",
  },
  8: {
    keyword: "The Powerhouse",
    brief: "The achiever, authority, and master of abundance.",
    description:
      "Eight energy is about power, success, and material achievement. It carries the vibration of authority, ambition, and karmic balance. This is the number of manifestation and executive ability.",
    energy: "Power, abundance, achievement, authority",
    dayGuidance:
      "Focus on business and finances today. Make power moves. Your authority and competence are recognized.",
    monthGuidance:
      "A month for career advancement and financial matters. Step into your power. Business dealings favored.",
    yearGuidance:
      "A year of achievement and recognition. Career peaks. Financial opportunities arrive. Use power wisely.",
  },
  9: {
    keyword: "The Humanitarian",
    brief: "The compassionate healer and universal lover.",
    description:
      "Nine energy is about completion, compassion, and universal love. It carries the vibration of wisdom, humanitarianism, and letting go. This is the number of endings that make way for new beginnings.",
    energy: "Completion, compassion, wisdom, release",
    dayGuidance:
      "Release what no longer serves you today. Give generously. Focus on the greater good and closure.",
    monthGuidance:
      "A month of endings and completion. Tie up loose ends. Forgiveness and compassion bring peace.",
    yearGuidance:
      "A year of completion and release. Let go of the old. Humanitarian work fulfills you. Prepare for a new cycle.",
  },
  // Master Numbers
  11: {
    keyword: "The Master Intuitive",
    brief: "The spiritual messenger and illuminated visionary.",
    description:
      "Eleven is a master number of spiritual insight and intuition amplified. It carries the vibration of inspiration, enlightenment, and channeled wisdom. This is the number of the spiritual teacher and psychic awareness.",
    energy: "Intuition, inspiration, spiritual insight, vision",
    dayGuidance:
      "Trust your intuition completely today. Spiritual insights flow freely. You may inspire others profoundly.",
    monthGuidance:
      "A month of heightened intuition and spiritual downloads. Share your vision. Inspiration strikes unexpectedly.",
    yearGuidance:
      "A year of spiritual awakening and intuitive breakthroughs. Your vision can inspire many. Honor your sensitivity.",
  },
  22: {
    keyword: "The Master Builder",
    brief: "The architect of dreams and builder of legacies.",
    description:
      "Twenty-two is a master number of practical idealism and large-scale achievement. It carries the vibration of turning visions into reality and building lasting structures. This is the number of the master architect.",
    energy: "Mastery, large-scale building, practical vision, legacy",
    dayGuidance:
      "Think big today. Your ability to manifest grand visions is amplified. Build something that lasts.",
    monthGuidance:
      "A month for ambitious projects and practical mastery. Turn dreams into concrete reality. Lead large initiatives.",
    yearGuidance:
      "A year to build your legacy. Grand visions can become reality. You have the power to create lasting structures.",
  },
  33: {
    keyword: "The Master Teacher",
    brief: "The cosmic healer and uplifter of humanity.",
    description:
      "Thirty-three is a master number of compassionate teaching and selfless service. It carries the vibration of the master healer, spiritual guide, and uplifter of humanity. This is the number of the cosmic parent.",
    energy: "Healing, teaching, selfless service, cosmic love",
    dayGuidance:
      "Your healing presence is amplified today. Teach through love. Your compassion can transform others.",
    monthGuidance:
      "A month for healing work and spiritual teaching. Serve others selflessly. Your guidance uplifts many.",
    yearGuidance:
      "A year of profound service and teaching. You are called to heal and uplift. Cosmic love flows through you.",
  },
};

/**
 * Get meaning for a number, handling master numbers
 * If a master number is provided, returns the master meaning
 * Otherwise returns the single digit meaning
 */
export function getNumberMeaning(number: number): NumberMeaning {
  // Check for master number first
  if (NUMBER_MEANINGS[number]) {
    return NUMBER_MEANINGS[number];
  }
  // Reduce to single digit if not found
  const reduced = reduceToSingleDigit(number);
  return NUMBER_MEANINGS[reduced] || NUMBER_MEANINGS[1]; // fallback to 1
}

/**
 * Reduce a number to single digit (1-9) unless it's a master number
 */
function reduceToSingleDigit(num: number): number {
  if (num === 11 || num === 22 || num === 33) return num;
  if (num <= 9) return num;
  // Sum digits
  const sum = String(num)
    .split("")
    .reduce((acc, digit) => acc + parseInt(digit), 0);
  return reduceToSingleDigit(sum);
}

/**
 * Get display label for a number (includes master number notation)
 */
export function getNumberLabel(value: number, master?: number): string {
  const meaning = getNumberMeaning(master || value);
  return meaning.keyword;
}
