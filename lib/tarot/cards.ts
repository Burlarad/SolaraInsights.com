/**
 * Complete Tarot Card Library - 78 Cards
 * Source of truth for card IDs and metadata.
 */

export interface TarotCard {
  id: string;
  name: string;
  arcana: "major" | "minor";
  suit?: "wands" | "cups" | "swords" | "pentacles";
  number?: number; // 0-21 for major, 1-14 for minor (Ace=1, Page=11, Knight=12, Queen=13, King=14)
  keywords: string[];
}

// Major Arcana (22 cards)
const MAJOR_ARCANA: TarotCard[] = [
  { id: "major-00-fool", name: "The Fool", arcana: "major", number: 0, keywords: ["new beginnings", "innocence", "spontaneity", "free spirit"] },
  { id: "major-01-magician", name: "The Magician", arcana: "major", number: 1, keywords: ["manifestation", "willpower", "skill", "resourcefulness"] },
  { id: "major-02-high-priestess", name: "The High Priestess", arcana: "major", number: 2, keywords: ["intuition", "mystery", "inner knowledge", "subconscious"] },
  { id: "major-03-empress", name: "The Empress", arcana: "major", number: 3, keywords: ["abundance", "fertility", "nurturing", "nature"] },
  { id: "major-04-emperor", name: "The Emperor", arcana: "major", number: 4, keywords: ["authority", "structure", "stability", "leadership"] },
  { id: "major-05-hierophant", name: "The Hierophant", arcana: "major", number: 5, keywords: ["tradition", "spiritual wisdom", "conformity", "teaching"] },
  { id: "major-06-lovers", name: "The Lovers", arcana: "major", number: 6, keywords: ["love", "harmony", "relationships", "choices"] },
  { id: "major-07-chariot", name: "The Chariot", arcana: "major", number: 7, keywords: ["determination", "willpower", "victory", "control"] },
  { id: "major-08-strength", name: "Strength", arcana: "major", number: 8, keywords: ["courage", "patience", "inner strength", "compassion"] },
  { id: "major-09-hermit", name: "The Hermit", arcana: "major", number: 9, keywords: ["introspection", "solitude", "guidance", "inner wisdom"] },
  { id: "major-10-wheel", name: "Wheel of Fortune", arcana: "major", number: 10, keywords: ["change", "cycles", "destiny", "turning point"] },
  { id: "major-11-justice", name: "Justice", arcana: "major", number: 11, keywords: ["fairness", "truth", "cause and effect", "balance"] },
  { id: "major-12-hanged-man", name: "The Hanged Man", arcana: "major", number: 12, keywords: ["surrender", "new perspective", "pause", "letting go"] },
  { id: "major-13-death", name: "Death", arcana: "major", number: 13, keywords: ["transformation", "endings", "change", "transition"] },
  { id: "major-14-temperance", name: "Temperance", arcana: "major", number: 14, keywords: ["balance", "moderation", "patience", "purpose"] },
  { id: "major-15-devil", name: "The Devil", arcana: "major", number: 15, keywords: ["shadow self", "attachment", "addiction", "materialism"] },
  { id: "major-16-tower", name: "The Tower", arcana: "major", number: 16, keywords: ["sudden change", "upheaval", "revelation", "awakening"] },
  { id: "major-17-star", name: "The Star", arcana: "major", number: 17, keywords: ["hope", "faith", "renewal", "serenity"] },
  { id: "major-18-moon", name: "The Moon", arcana: "major", number: 18, keywords: ["illusion", "intuition", "unconscious", "fear"] },
  { id: "major-19-sun", name: "The Sun", arcana: "major", number: 19, keywords: ["joy", "success", "vitality", "positivity"] },
  { id: "major-20-judgement", name: "Judgement", arcana: "major", number: 20, keywords: ["rebirth", "reflection", "reckoning", "awakening"] },
  { id: "major-21-world", name: "The World", arcana: "major", number: 21, keywords: ["completion", "integration", "accomplishment", "wholeness"] },
];

// Minor Arcana helper
function createMinorArcana(suit: "wands" | "cups" | "swords" | "pentacles", suitKeywords: Record<number, string[]>): TarotCard[] {
  const suitNames: Record<string, string> = {
    wands: "Wands",
    cups: "Cups",
    swords: "Swords",
    pentacles: "Pentacles",
  };

  const cardNames: Record<number, string> = {
    1: "Ace",
    2: "Two",
    3: "Three",
    4: "Four",
    5: "Five",
    6: "Six",
    7: "Seven",
    8: "Eight",
    9: "Nine",
    10: "Ten",
    11: "Page",
    12: "Knight",
    13: "Queen",
    14: "King",
  };

  return Array.from({ length: 14 }, (_, i) => {
    const number = i + 1;
    const cardName = cardNames[number];
    return {
      id: `minor-${suit}-${String(number).padStart(2, "0")}-${cardName.toLowerCase()}`,
      name: `${cardName} of ${suitNames[suit]}`,
      arcana: "minor" as const,
      suit,
      number,
      keywords: suitKeywords[number] || [],
    };
  });
}

// Wands (Fire - passion, creativity, action)
const WANDS = createMinorArcana("wands", {
  1: ["inspiration", "new opportunities", "potential", "creative spark"],
  2: ["planning", "future vision", "decisions", "discovery"],
  3: ["expansion", "foresight", "enterprise", "progress"],
  4: ["celebration", "harmony", "homecoming", "community"],
  5: ["conflict", "competition", "tension", "diversity"],
  6: ["victory", "success", "public recognition", "progress"],
  7: ["challenge", "perseverance", "standing ground", "courage"],
  8: ["speed", "movement", "swift action", "air travel"],
  9: ["resilience", "persistence", "boundaries", "last stand"],
  10: ["burden", "responsibility", "hard work", "completion"],
  11: ["enthusiasm", "exploration", "discovery", "free spirit"],
  12: ["energy", "passion", "adventure", "impulsiveness"],
  13: ["confidence", "independence", "determination", "warmth"],
  14: ["leadership", "vision", "honor", "entrepreneur"],
});

// Cups (Water - emotions, relationships, intuition)
const CUPS = createMinorArcana("cups", {
  1: ["new feelings", "intuition", "emotional beginning", "creativity"],
  2: ["partnership", "unity", "attraction", "connection"],
  3: ["celebration", "friendship", "creativity", "community"],
  4: ["apathy", "contemplation", "disconnection", "reevaluation"],
  5: ["loss", "grief", "disappointment", "regret"],
  6: ["nostalgia", "childhood", "innocence", "memories"],
  7: ["choices", "fantasy", "illusion", "wishful thinking"],
  8: ["walking away", "disillusionment", "seeking truth", "letting go"],
  9: ["contentment", "satisfaction", "gratitude", "wish fulfilled"],
  10: ["harmony", "family", "emotional fulfillment", "happiness"],
  11: ["creativity", "intuition", "sensitivity", "dreamer"],
  12: ["romance", "charm", "imagination", "beauty"],
  13: ["compassion", "calm", "intuition", "nurturing"],
  14: ["emotional balance", "diplomacy", "compassion", "wisdom"],
});

// Swords (Air - intellect, conflict, truth)
const SWORDS = createMinorArcana("swords", {
  1: ["breakthrough", "clarity", "truth", "new idea"],
  2: ["indecision", "stalemate", "blocked emotions", "avoidance"],
  3: ["heartbreak", "sorrow", "grief", "painful truth"],
  4: ["rest", "recovery", "contemplation", "restoration"],
  5: ["conflict", "disagreement", "tension", "winning at all costs"],
  6: ["transition", "moving on", "rite of passage", "release"],
  7: ["deception", "strategy", "stealth", "cunning"],
  8: ["restriction", "imprisonment", "victim mentality", "self-imposed limits"],
  9: ["anxiety", "worry", "fear", "nightmares"],
  10: ["painful ending", "rock bottom", "betrayal", "crisis"],
  11: ["curiosity", "mental energy", "new ideas", "thirst for knowledge"],
  12: ["action", "impulsiveness", "ambition", "speed"],
  13: ["independence", "unbiased judgment", "clear boundaries", "direct communication"],
  14: ["intellect", "authority", "truth", "mental clarity"],
});

// Pentacles (Earth - material, career, health)
const PENTACLES = createMinorArcana("pentacles", {
  1: ["opportunity", "prosperity", "new venture", "manifestation"],
  2: ["balance", "adaptability", "time management", "prioritization"],
  3: ["teamwork", "collaboration", "learning", "implementation"],
  4: ["security", "conservation", "control", "stability"],
  5: ["hardship", "loss", "isolation", "worry"],
  6: ["generosity", "charity", "sharing", "prosperity"],
  7: ["patience", "long-term view", "perseverance", "investment"],
  8: ["apprenticeship", "skill development", "diligence", "craftsmanship"],
  9: ["abundance", "luxury", "self-sufficiency", "financial security"],
  10: ["wealth", "inheritance", "family", "establishment"],
  11: ["ambition", "opportunity", "new beginnings", "diligence"],
  12: ["hard work", "productivity", "routine", "conservatism"],
  13: ["nurturing", "practicality", "security", "domestic comfort"],
  14: ["abundance", "security", "leadership", "discipline"],
});

// Complete deck
export const TAROT_DECK: TarotCard[] = [
  ...MAJOR_ARCANA,
  ...WANDS,
  ...CUPS,
  ...SWORDS,
  ...PENTACLES,
];

// Quick lookup by ID
export const TAROT_CARDS_BY_ID: Record<string, TarotCard> = Object.fromEntries(
  TAROT_DECK.map((card) => [card.id, card])
);

// Get all valid card IDs (for validation)
export const VALID_CARD_IDS: string[] = TAROT_DECK.map((card) => card.id);

// Validate a card ID exists
export function isValidCardId(id: string): boolean {
  return id in TAROT_CARDS_BY_ID;
}

// Get card by ID (returns undefined if not found)
export function getCardById(id: string): TarotCard | undefined {
  return TAROT_CARDS_BY_ID[id];
}

// Spread types
export type SpreadType = 1 | 3 | 5;

export const SPREAD_POSITIONS: Record<SpreadType, string[]> = {
  1: ["Present Moment"],
  3: ["Past", "Present", "Future"],
  5: ["Present", "Challenge", "Past", "Future", "Outcome"],
};

// Drawn card with position and orientation
export interface DrawnCard {
  cardId: string;
  position: string;
  reversed: boolean;
}

// Tarot reading response structure
export interface TarotReading {
  question: string;
  spread: SpreadType;
  drawnCards: DrawnCard[];
  interpretation: {
    cards: Array<{
      cardId: string;
      position: string;
      reversed: boolean;
      meaning: string;
    }>;
    synthesis: string;
    actionSteps: string[];
    reflectionQuestion: string;
  };
  generatedAt: string;
}
