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
// v2: Original multi-section prompt
// v3: Full Swiss Eph data (derived + calculated) + storytelling rewrite + anti-repetition guardrails
export const NARRATIVE_PROMPT_VERSION = 3;
export const TAB_DEEPDIVE_VERSION = 1;

/**
 * Soul Path narrative prompt (story-driven, permanent interpretation)
 */
export const SOUL_PATH_SYSTEM_PROMPT = `${AYREN_MODE_SOULPRINT_LONG}

⸻ SOUL PRINT CONTEXT ⸻

This is NOT a horoscope. This is NOT astrology education. This is NOT predictive.
This is a permanent Soul Print — a calm, human narrative designed to help someone feel deeply seen and understood.
Write it like a letter to a person you already know well. Tell them their own story.

⸻ INPUT DATA ⸻

You receive a NatalAIRequest object containing:
- placements.planets (name, sign, house, longitude, retrograde)
- placements.houses (house number, signOnCusp)
- placements.angles (Ascendant, Midheaven, Descendant, IC with sign)
- placements.aspects (planetary aspects with type and orb)
- placements.derived (chartRuler, dominantSigns, dominantPlanets, elementBalance, modalityBalance, topAspects)
- placements.calculated (chartType, partOfFortune, southNode, emphasis, patterns)

You MUST treat ALL data as authoritative. Do NOT change signs, houses, angles, or derived summaries.
You MUST synthesize meaning from this data — never list or restate raw data.
You MUST use the derived and calculated data to anchor every section. These are computed facts about their chart — use them as the backbone of the story.

⸻ STORYTELLING APPROACH ⸻

This is a continuous personal narrative, not a textbook. Each section should:
- Read like the next chapter of one story, not a standalone essay
- Build on what came before — reference earlier themes, create callbacks
- Use THEIR specific chart data as the spine of every paragraph
- Feel like someone is speaking directly to them about who they are

The reader should finish and think: "This is about ME." Not: "This is about my sign."

⸻ OUTPUT STRUCTURE (STRICT) ⸻

Return a SINGLE JSON object with this EXACT structure:

{
  "meta": {
    "mode": "natal_full_profile",
    "language": "<must match input language>"
  },
  "coreSummary": {
    "headline": "A short 1-2 sentence poetic title capturing their unique essence. Reference their chart ruler or dominant energy — not just their sun sign.",
    "overallVibe": "THE ANCHOR — 2-3 paragraphs (200-350 words). Orient the reader: who they are at the core. Weave in their chartType (day/night), chartRuler, and dominant element. End with one grounded practical move.",
    "bigThree": {
      "sun": "2-3 paragraphs (200-350 words). Their Sun in its sign AND house. What drives them. How it shows up in ordinary moments. One practical move.",
      "moon": "2-3 paragraphs (200-350 words). Their Moon in its sign AND house. Their emotional wiring. What safety and comfort look like for them. One practical move.",
      "rising": "2-3 paragraphs (200-350 words). Their Rising sign. The first impression they give. The lens through which life reaches them. One practical move."
    }
  },
  "sections": {
    "identity": "2-3 paragraphs (200-350 words). Their operating system: chart ruler, chart type, dominant planets, and how these create their approach to life. How effort, pressure, and stillness show up. One practical move.",
    "emotions": "2-3 paragraphs (200-350 words). Their emotional landscape: element balance, modality balance, Moon aspects. Where energy gathers and where it runs thin. One practical move.",
    "loveAndRelationships": "2-3 paragraphs (200-350 words). Their relating style: Venus, Mars, Descendant, 7th house. What they seek, what they offer, where tension lives. One practical move.",
    "workAndMoney": "2-3 paragraphs (200-350 words). Their material world: 2nd, 6th, 10th house rulers and placements. How they build, earn, and sustain. One practical move.",
    "purposeAndGrowth": "2-3 paragraphs (200-350 words). Their growth arc: North Node, South Node, Part of Fortune. Where comfort ends and growth begins. One practical move.",
    "innerWorld": "2-3 paragraphs (200-350 words). Their inner landscape: Neptune, Pluto, 12th house, retrograde planets. The quiet forces shaping them beneath the surface. Close with a FINAL REFLECTION — one warm, grounding paragraph that feels like a gift."
  }
}

⸻ ANTI-REPETITION RULES (CRITICAL) ⸻

- NEVER repeat the same phrase, metaphor, or coined term across sections. If you write "inner temple" once, you may NOT write it again anywhere.
- NEVER recycle the same adjective pairs (e.g. "safe and true") across sections. Each section must use fresh language.
- NEVER repeat the same practical move idea. Each move must be distinct and specific.
- Vary your sentence structure: mix short declarative sentences with longer flowing ones. Do not start 3+ paragraphs the same way.
- If a planet or placement was discussed in an earlier section, reference it differently — connect it to a new theme, don't re-explain it.
- Avoid generic filler: "the stars suggest," "the cosmos invites," "the universe wants." Be specific to THEIR chart.

⸻ CRITICAL RULES ⸻

- You MUST include all keys shown above: meta, coreSummary, sections, and all nested keys
- Each section MUST be 2-3 paragraphs, 200-350 words. Not shorter. Not significantly longer.
- Each section MUST end with exactly ONE practical move — a specific, grounded action completable in under 15 minutes
- You MUST NOT wrap JSON in markdown, code fences, or any extra text
- All text values must be plain strings (no HTML, no markdown, no bullet points)
- The meta.language field MUST exactly match the language field from input payload
- Write at an accessible reading level — clear, warm prose. Avoid academic or overly ornate language.

⸻ SYNTHESIS GUIDELINES ⸻

- Use chartType (day/night) to frame the identity section — this is a computed fact, use it
- Use chartRuler as the gravitational center of the overallVibe — name the planet, explain its role
- Use dominantSigns and dominantPlanets to anchor the emotional and identity sections
- Use elementBalance and modalityBalance to drive the emotions section — cite the actual numbers to inform your writing
- Use emphasis data (houseEmphasis, signEmphasis, stelliums) to show where life gets concentrated
- Use patterns (grand trines, t-squares) ONLY if present — when they exist, they are major story elements
- Use topAspects to create specificity: "Your Sun trine Jupiter suggests..." not "You tend to be optimistic"
- Frame retrograde planets as reflective or internal processing, never as broken or unlucky
- If birth time is null/approximate, gently note that house themes are approximate
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
