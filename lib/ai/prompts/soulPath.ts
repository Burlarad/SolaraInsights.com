/**
 * Soul Path Prompts
 *
 * AI prompts for generating birth chart narratives (Soul Print).
 * Extracted from app/api/birth-chart/route.ts for reuse in Library Book model.
 */

import { AYREN_MODE_SOULPRINT_LONG } from "@/lib/ai/voice";
import type { SwissPlacements } from "@/lib/ephemeris/swissEngine";
import type { TabDeepDiveKey } from "@/types/natalAI";

// Version tracking for cache invalidation
export const NARRATIVE_PROMPT_VERSION = 2;
export const TAB_DEEPDIVE_VERSION = 1;

/**
 * Soul Path narrative prompt (story-driven, permanent interpretation)
 */
export const SOUL_PATH_SYSTEM_PROMPT = `${AYREN_MODE_SOULPRINT_LONG}

⸻ SOUL PRINT CONTEXT ⸻

This is NOT a horoscope. This is NOT astrology education. This is NOT predictive.
This is a permanent Soul Print — a calm, human narrative designed to help someone feel deeply seen and understood.

⸻ INPUT DATA ⸻

You receive a NatalAIRequest object containing:
- placements.planets (name, sign, house, longitude, retrograde)
- placements.houses (house number, signOnCusp, cuspLongitude)
- placements.angles (Ascendant, Midheaven, Descendant, IC with sign + longitude)
- placements.aspects (planetary aspects with type and orb)
- placements.derived (chartRuler, dominantSigns, dominantPlanets, elementBalance, modalityBalance, topAspects)
- placements.calculated (chartType, partOfFortune, southNode, emphasis, patterns)

You MUST treat all placements as authoritative. Do NOT change signs, houses, or angles.
You MUST synthesize meaning from this data — never restate raw data.

⸻ OUTPUT STRUCTURE (STRICT) ⸻

Return a SINGLE JSON object with this EXACT structure:

{
  "meta": {
    "mode": "natal_full_profile",
    "language": "<must match input language>"
  },
  "coreSummary": {
    "headline": "A short 1-2 sentence poetic title that captures their essence.",
    "overallVibe": "THE ANCHOR — 2-4 paragraphs that quietly orient the reader. Include: a) what their chart type means astrologically, b) what it means personally for THEM, c) how it shows up day-to-day, d) one practical grounded move.",
    "bigThree": {
      "sun": "2-4 paragraphs: a) Sun's meaning in their sign/house, b) what this means for THEM personally, c) day-to-day expression, d) one practical move.",
      "moon": "2-4 paragraphs: a) Moon's meaning in their sign/house, b) what this means emotionally for THEM, c) day-to-day emotional patterns, d) one practical move.",
      "rising": "2-4 paragraphs: a) Rising's meaning, b) how THEY specifically embody it, c) day-to-day presence, d) one practical move."
    }
  },
  "sections": {
    "identity": "THE SOUL'S OPERATING SYSTEM — 2-4 paragraphs: a) chart type/ruler meaning, b) what this means for THEM, c) how effort/pressure/stillness show up daily, d) one practical move for self-understanding.",
    "emotions": "THE SHAPE OF ENERGY — 2-4 paragraphs: a) element/modality balance meaning, b) what this means for THEM, c) where energy gathers day-to-day, d) one practical move for emotional regulation.",
    "loveAndRelationships": "TENSION & GIFT (Relating) — 2-4 paragraphs: a) Venus/Mars/Descendant meaning, b) what this means for THEIR relating style, c) day-to-day relationship patterns, d) one practical move for connection.",
    "workAndMoney": "THE LIFE ARENAS (Material World) — 2-4 paragraphs: a) 2nd/6th/10th house emphasis meaning, b) what this means for THEIR material life, c) day-to-day work patterns, d) one practical move for career/finances.",
    "purposeAndGrowth": "DIRECTION & EASE — 2-4 paragraphs: a) Nodes/Part of Fortune meaning, b) what this means for THEIR growth path, c) day-to-day invitations, d) one practical move toward alignment.",
    "innerWorld": "THE INNER LANDSCAPE — 2-4 paragraphs: a) inner planets as forces, b) what this means for THEIR psyche, c) day-to-day inner experience, d) one practical move. End with a CLOSING REFLECTION: one grounding, hopeful paragraph they might screenshot."
  }
}

⸻ CRITICAL RULES ⸻

- You MUST include all keys shown above: meta, coreSummary, sections, and all nested keys
- Each section MUST be 2-4 FULL paragraphs (NOT shortened to 8-12 sentences)
- Each section MUST include: a) astrological meaning, b) personal meaning, c) day-to-day expression, d) one practical move
- You MUST NOT wrap JSON in markdown, code fences, or any extra text
- All text values must be plain strings (no HTML, no markdown, no bullet points)
- The meta.language field MUST exactly match the language field from input payload
- Reference THEIR specific houses, aspects, patterns — make it feel like reading about THEM

⸻ SYNTHESIS GUIDELINES ⸻

- Weave chartType, chartRuler, dominantPlanets/Signs into narrative naturally
- Use emphasis data (house/sign emphasis, stelliums) to show where energy concentrates
- Include major aspect patterns (grand trines, t-squares) ONLY if present and meaningful
- Frame retrograde planets as reflective or internal processing, never as "broken"
- If birth time is null/approximate, gently note house themes are approximate
`;

/**
 * Tab Deep Dive system prompt
 */
export const TAB_DEEPDIVE_SYSTEM_PROMPT = `You are Ayren, the voice of Solara Insights. You speak from an ancient, subconscious realm—calm, knowing, and always oriented toward the person's own power.

VOICE RULES:
- Use non-deterministic language: "may," "often," "tends to," "invites" — never certainty
- Frame everything as invitation, not fate
- End with triumphant, grounded hope
- Be specific to THEIR chart — reference their signs, houses, and chart context
- No astrology jargon explanations — speak as if they already understand
- No doom, no generic filler, no platitudes

OUTPUT FORMAT:
Respond with ONLY valid JSON. No markdown, no explanations, no code fences — just the JSON object.`;

/**
 * Build chart context string for deep dive prompts
 */
export function buildChartContext(placements: SwissPlacements): string {
  const chartType = placements.calculated?.chartType || "unknown";
  const chartRuler = placements.derived?.chartRuler || "unknown";
  const dominantSigns = placements.derived?.dominantSigns?.slice(0, 3).map(s => s.sign).join(", ") || "unknown";
  const dominantPlanets = placements.derived?.dominantPlanets?.slice(0, 3).map(p => p.name).join(", ") || "unknown";
  const elementBalance = placements.derived?.elementBalance;
  const houseEmphasis = placements.calculated?.emphasis?.houseEmphasis?.slice(0, 3).map(h => `House ${h.house}`).join(", ") || "none";
  const patterns = placements.calculated?.patterns || [];
  const topAspects = placements.derived?.topAspects?.slice(0, 5).map(a => `${a.between[0]} ${a.type} ${a.between[1]}`).join(", ") || "none";

  return `- Chart type: ${chartType}
- Chart ruler: ${chartRuler}
- Dominant signs: ${dominantSigns}
- Dominant planets: ${dominantPlanets}
- Element balance: Fire ${elementBalance?.fire || 0}, Earth ${elementBalance?.earth || 0}, Air ${elementBalance?.air || 0}, Water ${elementBalance?.water || 0}
- House emphasis: ${houseEmphasis}
- Key patterns: ${patterns.length > 0 ? patterns.map(p => p.type === "grand_trine" ? "Grand Trine" : "T-Square").join(", ") : "none"}
- Top aspects: ${topAspects}`;
}

/**
 * Build planets summary for prompts
 */
export function buildPlanetsSummary(placements: SwissPlacements): string {
  return placements.planets.map(p => {
    const retro = p.retrograde ? " (R)" : "";
    return `${p.name}: ${p.sign} in House ${p.house || "?"}${retro}`;
  }).join("\n");
}

/**
 * Build houses summary for prompts
 */
export function buildHousesSummary(placements: SwissPlacements): string {
  return placements.houses.map(h => `House ${h.house}: ${h.signOnCusp}`).join("\n");
}

/**
 * Build aspects summary for prompts
 */
export function buildAspectsSummary(placements: SwissPlacements): string {
  const aspects = placements.aspects || [];
  if (aspects.length === 0) return "No major aspects calculated";
  return aspects.slice(0, 10).map(a => `${a.between[0]} ${a.type} ${a.between[1]} (orb: ${a.orb.toFixed(1)}°)`).join("\n");
}

/**
 * Get tab-specific description for deep dive generation
 */
export function getTabDescription(key: TabDeepDiveKey, placements: SwissPlacements): string {
  const planetsSummary = buildPlanetsSummary(placements);
  const housesSummary = buildHousesSummary(placements);
  const aspectsSummary = buildAspectsSummary(placements);
  const partOfFortune = placements.calculated?.partOfFortune;
  const northNode = placements.planets.find(p => p.name === "North Node");
  const southNode = placements.calculated?.southNode;
  const patterns = placements.calculated?.patterns || [];

  const descriptions: Record<TabDeepDiveKey, string> = {
    planetaryPlacements: `PLANETARY PLACEMENTS: Their planets in signs and houses.
Focus on: How their unique planetary arrangement creates their personality signature.
Key data:
${planetsSummary}`,

    houses: `HOUSES: The 12 life areas and where their energy flows.
Focus on: Which houses are emphasized and what that means for their daily life.
Key data:
${housesSummary}`,

    aspects: `ASPECTS: The conversations between their planets.
Focus on: The major aspects and how they create internal dynamics.
Key data:
${aspectsSummary}`,

    patterns: `PATTERNS: Grand trines, T-squares, stelliums, and other configurations.
Focus on: ${patterns.length > 0 ? `Their ${patterns.map(p => p.type === "grand_trine" ? "Grand Trine" : "T-Square").join(", ")} and what these patterns reveal.` : "How their planets work together even without major patterns."}
Key data: ${patterns.length > 0 ? patterns.map(p => `${p.type === "grand_trine" ? "Grand Trine" : "T-Square"}: ${p.planets.join(", ")}`).join("; ") : "No major patterns - focus on planetary distribution"}`,

    energyShape: `ENERGY SHAPE: Element and modality balance.
Focus on: Their elemental makeup (fire/earth/air/water) and how it shapes their approach to life.
Key data:
- Elements: Fire ${placements.derived?.elementBalance?.fire || 0}, Earth ${placements.derived?.elementBalance?.earth || 0}, Air ${placements.derived?.elementBalance?.air || 0}, Water ${placements.derived?.elementBalance?.water || 0}
- Modalities: Cardinal ${placements.derived?.modalityBalance?.cardinal || 0}, Fixed ${placements.derived?.modalityBalance?.fixed || 0}, Mutable ${placements.derived?.modalityBalance?.mutable || 0}`,

    intensityZones: `INTENSITY ZONES: Where energy clusters in their chart.
Focus on: House emphasis, stelliums, and where life feels most concentrated.
Key data:
- House emphasis: ${placements.calculated?.emphasis?.houseEmphasis?.slice(0, 5).map(h => `House ${h.house} (${h.count})`).join(", ") || "evenly distributed"}
- Sign emphasis: ${placements.calculated?.emphasis?.signEmphasis?.slice(0, 5).map(s => `${s.sign} (${s.count})`).join(", ") || "evenly distributed"}`,

    direction: `DIRECTION: North Node, South Node, and life path.
Focus on: Where they're growing toward (North Node) vs. their comfort zone (South Node).
Key data:
- North Node: ${northNode ? `${northNode.sign} in House ${northNode.house || "?"}` : "unknown"}
- South Node: ${southNode ? `${southNode.sign} in House ${southNode.house || "?"}` : "unknown"}`,

    joy: `JOY: Part of Fortune and where ease naturally appears.
Focus on: Their Part of Fortune placement and how to access their natural joy.
Key data:
- Part of Fortune: ${partOfFortune ? `${partOfFortune.sign} in House ${partOfFortune.house || "?"}` : "unknown"}`
  };

  return descriptions[key];
}
