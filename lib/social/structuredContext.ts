/**
 * Structured Social Context
 *
 * Defines the stable schema for social insights that get passed to OpenAI.
 * Replaces freeform text to reduce hallucination and improve stability.
 */

/**
 * Humor style classification
 */
export type HumorStyle = "wholesome" | "witty" | "playful" | "dry" | "absurd" | "unknown";

/**
 * Account type classification for signal quality
 */
export type AccountType = "personal" | "creator" | "brand" | "meme" | "low_signal";

/**
 * A scored theme/topic from social analysis
 */
export interface ScoredItem {
  name: string;
  score: number; // 0-1 confidence/relevance
}

/**
 * Tone characteristics
 */
export interface ToneProfile {
  humorStyle: HumorStyle;
  warmth: number; // 0-1
  directness: number; // 0-1
}

/**
 * Communication descriptors
 */
export interface CommunicationStyle {
  descriptors: string[]; // e.g., ["thoughtful", "asks questions", "shares personal stories"]
}

/**
 * Emotional expression patterns
 */
export interface EmotionalCadence {
  descriptors: string[]; // e.g., ["reflective", "openly vulnerable", "optimistic"]
}

/**
 * Confidence metadata for social signal quality
 */
export interface ConfidenceMetadata {
  signalStrength: number; // 0-1
  accountType: AccountType;
  humorEligible: boolean;
  humorDial: number; // 0-1
}

/**
 * The complete structured social context object
 * This is what gets stored in metadata_json and passed to OpenAI
 */
export interface StructuredSocialContext {
  tone: ToneProfile;
  themes: ScoredItem[];
  stressors: ScoredItem[];
  goals: ScoredItem[];
  communicationStyle: CommunicationStyle;
  emotionalCadence: EmotionalCadence;
  confidence: ConfidenceMetadata;
}

/**
 * Default/empty social context for users without social data
 */
export const EMPTY_SOCIAL_CONTEXT: StructuredSocialContext = {
  tone: {
    humorStyle: "unknown",
    warmth: 0.5,
    directness: 0.5,
  },
  themes: [],
  stressors: [],
  goals: [],
  communicationStyle: { descriptors: [] },
  emotionalCadence: { descriptors: [] },
  confidence: {
    signalStrength: 0,
    accountType: "low_signal",
    humorEligible: false,
    humorDial: 0,
  },
};

/**
 * Validate and clamp a StructuredSocialContext
 * Ensures all values are within expected bounds
 */
export function validateStructuredContext(
  ctx: Partial<StructuredSocialContext> | null | undefined
): StructuredSocialContext {
  if (!ctx) return EMPTY_SOCIAL_CONTEXT;

  const validAccountTypes: AccountType[] = ["personal", "creator", "brand", "meme", "low_signal"];
  const validHumorStyles: HumorStyle[] = ["wholesome", "witty", "playful", "dry", "absurd", "unknown"];

  const accountType = validAccountTypes.includes(ctx.confidence?.accountType as AccountType)
    ? ctx.confidence!.accountType
    : "low_signal";

  const humorStyle = validHumorStyles.includes(ctx.tone?.humorStyle as HumorStyle)
    ? ctx.tone!.humorStyle
    : "unknown";

  const signalStrength = clamp(ctx.confidence?.signalStrength ?? 0, 0, 1);

  return {
    tone: {
      humorStyle,
      warmth: clamp(ctx.tone?.warmth ?? 0.5, 0, 1),
      directness: clamp(ctx.tone?.directness ?? 0.5, 0, 1),
    },
    themes: validateScoredItems(ctx.themes),
    stressors: validateScoredItems(ctx.stressors),
    goals: validateScoredItems(ctx.goals),
    communicationStyle: {
      descriptors: Array.isArray(ctx.communicationStyle?.descriptors)
        ? ctx.communicationStyle.descriptors.filter(d => typeof d === "string").slice(0, 10)
        : [],
    },
    emotionalCadence: {
      descriptors: Array.isArray(ctx.emotionalCadence?.descriptors)
        ? ctx.emotionalCadence.descriptors.filter(d => typeof d === "string").slice(0, 10)
        : [],
    },
    confidence: {
      signalStrength,
      accountType,
      humorEligible: signalStrength > 0.5 && ctx.confidence?.humorEligible === true,
      humorDial: clamp(ctx.confidence?.humorDial ?? 0, 0, 1),
    },
  };
}

/**
 * Validate an array of scored items
 */
function validateScoredItems(items: unknown): ScoredItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is ScoredItem =>
      item &&
      typeof item === "object" &&
      typeof (item as ScoredItem).name === "string" &&
      typeof (item as ScoredItem).score === "number"
    )
    .map(item => ({
      name: item.name.slice(0, 100), // Limit length
      score: clamp(item.score, 0, 1),
    }))
    .slice(0, 10); // Limit count
}

/**
 * Clamp a number between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Format structured context for inclusion in OpenAI prompt
 * Provides a clean, non-surveillance-implying representation
 */
export function formatContextForPrompt(ctx: StructuredSocialContext): string {
  const lines: string[] = [];

  // Only include if there's meaningful signal
  if (ctx.confidence.signalStrength < 0.1) {
    return ""; // No meaningful social context
  }

  lines.push("PERSONALIZATION CONTEXT (internal guidance only, never mention sources):");
  lines.push("");

  // Tone
  if (ctx.tone.humorStyle !== "unknown") {
    lines.push(`Preferred tone: ${ctx.tone.humorStyle} humor, ${describeWarmth(ctx.tone.warmth)}, ${describeDirectness(ctx.tone.directness)}`);
  }

  // Themes
  if (ctx.themes.length > 0) {
    const topThemes = ctx.themes
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(t => t.name);
    lines.push(`Interests: ${topThemes.join(", ")}`);
  }

  // Emotional patterns
  if (ctx.emotionalCadence.descriptors.length > 0) {
    lines.push(`Emotional expression: ${ctx.emotionalCadence.descriptors.slice(0, 3).join(", ")}`);
  }

  // Communication style
  if (ctx.communicationStyle.descriptors.length > 0) {
    lines.push(`Communication style: ${ctx.communicationStyle.descriptors.slice(0, 3).join(", ")}`);
  }

  // Confidence metadata for internal use
  lines.push("");
  lines.push(`Signal confidence: ${(ctx.confidence.signalStrength * 100).toFixed(0)}%`);
  lines.push(`Humor eligible: ${ctx.confidence.humorEligible ? "yes" : "no"}`);
  if (ctx.confidence.humorEligible) {
    lines.push(`Humor dial: ${(ctx.confidence.humorDial * 100).toFixed(0)}%`);
  }

  return lines.join("\n");
}

function describeWarmth(value: number): string {
  if (value < 0.3) return "reserved warmth";
  if (value < 0.6) return "moderate warmth";
  return "high warmth";
}

function describeDirectness(value: number): string {
  if (value < 0.3) return "indirect approach preferred";
  if (value < 0.6) return "balanced directness";
  return "direct communication preferred";
}

/**
 * Merge multiple social contexts (e.g., from different providers)
 * Uses weighted averaging based on signal strength
 */
export function mergeContexts(contexts: StructuredSocialContext[]): StructuredSocialContext {
  if (contexts.length === 0) return EMPTY_SOCIAL_CONTEXT;
  if (contexts.length === 1) return contexts[0];

  // Weight by signal strength
  const totalWeight = contexts.reduce((sum, ctx) => sum + ctx.confidence.signalStrength, 0);
  if (totalWeight === 0) return EMPTY_SOCIAL_CONTEXT;

  // Weighted average for numeric values
  const avgWarmth = weightedAverage(contexts, c => c.tone.warmth, totalWeight);
  const avgDirectness = weightedAverage(contexts, c => c.tone.directness, totalWeight);
  const avgSignalStrength = weightedAverage(contexts, c => c.confidence.signalStrength, totalWeight);
  const avgHumorDial = weightedAverage(contexts, c => c.confidence.humorDial, totalWeight);

  // Pick humor style from highest-signal context
  const bestContext = contexts.reduce((best, ctx) =>
    ctx.confidence.signalStrength > best.confidence.signalStrength ? ctx : best
  );

  // Merge and dedupe arrays
  const allThemes = mergeAndDedupe(contexts.flatMap(c => c.themes));
  const allStressors = mergeAndDedupe(contexts.flatMap(c => c.stressors));
  const allGoals = mergeAndDedupe(contexts.flatMap(c => c.goals));
  const allComm = [...new Set(contexts.flatMap(c => c.communicationStyle.descriptors))];
  const allEmotional = [...new Set(contexts.flatMap(c => c.emotionalCadence.descriptors))];

  return {
    tone: {
      humorStyle: bestContext.tone.humorStyle,
      warmth: avgWarmth,
      directness: avgDirectness,
    },
    themes: allThemes.slice(0, 10),
    stressors: allStressors.slice(0, 10),
    goals: allGoals.slice(0, 10),
    communicationStyle: { descriptors: allComm.slice(0, 10) },
    emotionalCadence: { descriptors: allEmotional.slice(0, 10) },
    confidence: {
      signalStrength: avgSignalStrength,
      accountType: bestContext.confidence.accountType,
      humorEligible: avgSignalStrength > 0.5,
      humorDial: avgHumorDial,
    },
  };
}

function weightedAverage(
  contexts: StructuredSocialContext[],
  getValue: (ctx: StructuredSocialContext) => number,
  totalWeight: number
): number {
  return contexts.reduce(
    (sum, ctx) => sum + getValue(ctx) * ctx.confidence.signalStrength,
    0
  ) / totalWeight;
}

function mergeAndDedupe(items: ScoredItem[]): ScoredItem[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const existing = map.get(item.name) ?? 0;
    map.set(item.name, Math.max(existing, item.score));
  }
  return Array.from(map.entries())
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);
}
