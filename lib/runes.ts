/**
 * Elder Futhark rune mappings.
 * Built from actual filenames in public/runes/.
 */

export interface Rune {
  id: string; // stable internal id, e.g. "fehu"
  name: string; // display name, e.g. "Fehu"
  slug: string; // used in image path, e.g. "fehu"
  imageUrl: string; // e.g. "/runes/fehu.png"
}

/**
 * Helper to convert slug to display name.
 * Example: "fehu" → "Fehu"
 */
function slugToName(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

/**
 * All 24 Elder Futhark runes.
 */
export const RUNES: Rune[] = [
  "fehu",
  "uruz",
  "thurisaz",
  "ansuz",
  "raidho",
  "kenaz",
  "gebo",
  "wunjo",
  "hagalaz",
  "nauthiz",
  "isa",
  "jera",
  "eihwaz",
  "perthro",
  "algiz",
  "sowilo",
  "tiwaz",
  "berkana",
  "ehwaz",
  "mannaz",
  "laguz",
  "ingwaz",
  "dagaz",
  "othala",
].map((slug) => ({
  id: slug,
  name: slugToName(slug),
  slug,
  imageUrl: `/runes/${slug}.png`,
}));

/**
 * Get all rune names for OpenAI prompt constraints.
 */
export function getRuneNames(): string[] {
  return RUNES.map((rune) => rune.name);
}

/**
 * Find a rune by name (case-insensitive).
 */
export function findRune(name: string): Rune | undefined {
  const normalizedName = name.toLowerCase().trim();
  return RUNES.find((rune) => rune.name.toLowerCase() === normalizedName);
}
