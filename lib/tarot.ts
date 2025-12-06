/**
 * Tarot card mappings for the Rider-Waite-Smith deck.
 * Built from actual filenames in public/tarot/rws/.
 */

export interface TarotCard {
  id: string; // stable internal id, e.g. "the_fool"
  name: string; // display name, e.g. "The Fool"
  slug: string; // used in image path, e.g. "the-fool"
  imageUrl: string; // e.g. "/tarot/rws/the-fool.png"
}

/**
 * Helper to convert slug to display name.
 * Example: "the-fool" → "The Fool"
 */
function slugToName(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * All 78 tarot cards in the Rider-Waite-Smith deck.
 */
export const TAROT_CARDS: TarotCard[] = [
  // Major Arcana (22 cards)
  "the-fool",
  "the-magician",
  "the-high-priestess",
  "the-empress",
  "the-emperor",
  "the-hierophant",
  "the-lovers",
  "the-chariot",
  "strength",
  "the-hermit",
  "the-wheel-of-fortune",
  "justice",
  "the-hanged-one",
  "death",
  "temperance",
  "the-devil",
  "the-tower",
  "the-star",
  "the-moon",
  "the-sun",
  "judgement",
  "the-world",

  // Minor Arcana - Cups (14 cards)
  "ace-of-cups",
  "2-of-cups",
  "3-of-cups",
  "4-of-cups",
  "5-of-cups",
  "6-of-cups",
  "7-of-cups",
  "8-of-cups",
  "9-of-cups",
  "10-of-cups",
  "page-of-cups",
  "knight-of-cups",
  "queen-of-cups",
  "king-of-cups",

  // Minor Arcana - Pentacles (14 cards)
  "ace-of-pentacles",
  "2-of-pentacles",
  "3-of-pentacles",
  "4-of-pentacles",
  "5-of-pentacles",
  "6-of-pentacles",
  "7-of-pentacles",
  "8-of-pentacles",
  "9-of-pentacles",
  "10-of-pentacles",
  "page-of-pentacles",
  "knight-of-pentacles",
  "queen-of-pentacles",
  "king-of-pentacles",

  // Minor Arcana - Swords (14 cards)
  "ace-of-swords",
  "2-of-swords",
  "3-of-swords",
  "4-of-swords",
  "5-of-swords",
  "6-of-swords",
  "7-of-swords",
  "8-of-swords",
  "9-of-swords",
  "10-of-swords",
  "page-of-swords",
  "knight-of-swords",
  "queen-of-swords",
  "king-of-swords",

  // Minor Arcana - Wands (14 cards)
  "ace-of-wands",
  "2-of-wands",
  "3-of-wands",
  "4-of-wands",
  "5-of-wands",
  "6-of-wands",
  "7-of-wands",
  "8-of-wands",
  "9-of-wands",
  "10-of-wands",
  "page-of-wands",
  "knight-of-wands",
  "queen-of-wands",
  "king-of-wands",
].map((slug) => ({
  id: slug.replace(/-/g, "_"),
  name: slugToName(slug),
  slug,
  imageUrl: `/tarot/rws/${slug}.png`,
}));

/**
 * Get all tarot card names for OpenAI prompt constraints.
 */
export function getTarotCardNames(): string[] {
  return TAROT_CARDS.map((card) => card.name);
}

/**
 * Find a tarot card by name (case-insensitive).
 */
export function findTarotCard(name: string): TarotCard | undefined {
  const normalizedName = name.toLowerCase().trim();
  return TAROT_CARDS.find((card) => card.name.toLowerCase() === normalizedName);
}
