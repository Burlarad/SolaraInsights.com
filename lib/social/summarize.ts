/**
 * Social Insights Summarization
 *
 * Generates AI summaries from user-provided social content.
 * Output is structured, safe, and privacy-respecting.
 */

import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { SocialProvider } from "@/types";
import { logTokenAudit } from "@/lib/ai/tokenAudit";
import { trackAiUsage } from "@/lib/ai/trackUsage";
import { checkBudget } from "@/lib/ai/costControl";

// Current prompt version - increment when prompt changes significantly
export const SOCIAL_SUMMARY_PROMPT_VERSION = 1;

// Maximum input size (characters)
export const MAX_PAYLOAD_SIZE = 50000; // ~50k characters

/**
 * Account type classification for social insights
 */
export type SocialAccountType = "personal" | "creator" | "brand" | "meme" | "low_signal";

/**
 * Humor style detected from social content
 */
export type SocialHumorStyle = "wholesome" | "witty" | "playful" | "dry" | "absurd" | "unknown";

/**
 * Metadata extracted from social content analysis
 */
export interface SocialInsightsMetadata {
  signalStrength: number; // 0-1, how much genuine personal signal is present
  accountType: SocialAccountType;
  humorEligible: boolean; // true only when signalStrength is strong (>0.5)
  humorDial: number; // 0-1, how much humor to apply
  humorStyle: SocialHumorStyle;
}

/**
 * Result of a social summary generation
 */
export interface SocialSummaryResult {
  summary: string;
  metadata: SocialInsightsMetadata;
  promptVersion: number;
  modelVersion: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Generate a social insights summary from user-provided content.
 *
 * @param provider - The social platform (for context, not mentioned in output)
 * @param payload - User-pasted content (posts, captions, etc.)
 * @param handle - Optional handle/username
 * @returns Structured summary result
 */
export async function generateSocialSummary(
  provider: SocialProvider,
  payload: string,
  handle?: string
): Promise<SocialSummaryResult> {
  // Validate input size
  if (payload.length > MAX_PAYLOAD_SIZE) {
    throw new Error(`Payload too large. Maximum ${MAX_PAYLOAD_SIZE} characters allowed.`);
  }

  if (payload.trim().length < 100) {
    throw new Error("Payload too short. Please provide at least 100 characters of content.");
  }

  // Defense-in-depth: Check budget before making OpenAI call
  const budgetCheck = await checkBudget();
  if (!budgetCheck.allowed) {
    throw new Error("Service temporarily unavailable: budget exceeded");
  }

  const systemPrompt = `You are a compassionate observer who reads social media content to understand someone's communication style, interests, and emotional patterns.

Your task is to generate a brief "Social Insights" profile based on the provided content. This profile will be used to personalize astrological insights and help the user understand their own patterns.

OUTPUT FORMAT - Return valid JSON with this exact structure:
{
  "summary": "The full text summary (see format below)",
  "metadata": {
    "signalStrength": 0.0-1.0,
    "accountType": "personal|creator|brand|meme|low_signal",
    "humorEligible": true|false,
    "humorDial": 0.0-1.0,
    "humorStyle": "wholesome|witty|playful|dry|absurd|unknown"
  }
}

SUMMARY FORMAT (for the "summary" field):

## Tone & Voice
[2-3 sentences about how they express themselves: playful, thoughtful, direct, poetic, etc.]

## Communication Style
[2-3 sentences about how they engage: shares personal stories, asks questions, uses humor, educational tone, etc.]

## Interests & Themes
[Bullet list of 3-5 recurring topics or interests they discuss]

## Emotional Cadence
[2-3 sentences about their emotional expression: openly vulnerable, guarded, optimistic, reflective, etc.]

## How to Approach Me
[3-4 bullet points of guidance for personalizing content for this person]

METADATA RULES:
- signalStrength: How much genuine personal signal is present (0=none, 1=strong). Meme accounts, reposts, low-effort content = low signal.
- accountType: Classify as personal (individual sharing life), creator (content-focused), brand (business/promotional), meme (humor/repost account), or low_signal (not enough data)
- humorEligible: Set true ONLY if signalStrength > 0.5 AND content shows genuine personality
- humorDial: 0-1 indicating how much humor to use in personalized content (0=serious, 1=very playful)
- humorStyle: Detect their humor preference - wholesome (warm/positive), witty (clever), playful (light/fun), dry (deadpan), absurd (surreal), unknown (unclear)

MEME/LOW-SIGNAL DETECTION:
If the content is primarily memes, reposts, or lacks personal expression:
- Set signalStrength LOW (0.1-0.3)
- Set accountType to "meme" or "low_signal"
- Set humorEligible to false
- The summary should still be warm but acknowledge limited personal insight

STRICT SAFETY RULES:
- NEVER diagnose mental health conditions
- NEVER make claims about protected attributes (race, religion, sexuality, etc.)
- NEVER mention the specific platform name in the output
- NEVER include usernames, handles, or identifiable information
- NEVER reference specific posts, dates, or events
- Use gentle language: "tends to", "often", "appears to" - not absolutes
- Keep it warm, affirming, and useful
- Focus on communication patterns, not personality judgments`;

  const userPrompt = `Based on the following social content, generate a Social Insights profile.

CONTENT:
${payload}

Generate the JSON response now using the exact format specified.`;

  const completion = await openai.chat.completions.create({
    model: OPENAI_MODELS.fast,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 1500,
    response_format: { type: "json_object" },
  });

  const responseContent = completion.choices[0]?.message?.content;

  if (!responseContent) {
    throw new Error("No response from AI");
  }

  // Parse the JSON response
  let parsed: {
    summary: string;
    metadata: {
      signalStrength: number;
      accountType: string;
      humorEligible: boolean;
      humorDial: number;
      humorStyle: string;
    };
  };

  try {
    parsed = JSON.parse(responseContent);
  } catch (e) {
    // Fallback: if JSON parsing fails, treat the entire response as summary with default metadata
    console.warn("[SocialSummary] Failed to parse JSON, using fallback metadata");
    parsed = {
      summary: responseContent.trim(),
      metadata: {
        signalStrength: 0.5,
        accountType: "personal",
        humorEligible: false,
        humorDial: 0.3,
        humorStyle: "unknown",
      },
    };
  }

  // Validate and normalize metadata
  const metadata: SocialInsightsMetadata = {
    signalStrength: Math.max(0, Math.min(1, parsed.metadata?.signalStrength ?? 0.5)),
    accountType: (["personal", "creator", "brand", "meme", "low_signal"].includes(parsed.metadata?.accountType)
      ? parsed.metadata.accountType
      : "personal") as SocialAccountType,
    humorEligible: parsed.metadata?.humorEligible === true && (parsed.metadata?.signalStrength ?? 0) > 0.5,
    humorDial: Math.max(0, Math.min(1, parsed.metadata?.humorDial ?? 0.3)),
    humorStyle: (["wholesome", "witty", "playful", "dry", "absurd", "unknown"].includes(parsed.metadata?.humorStyle)
      ? parsed.metadata.humorStyle
      : "unknown") as SocialHumorStyle,
  };

  // Token audit logging
  logTokenAudit({
    route: "/api/social-insights",
    featureLabel: "Social • Summary",
    model: OPENAI_MODELS.fast,
    cacheStatus: "miss",
    promptVersion: SOCIAL_SUMMARY_PROMPT_VERSION,
    inputTokens: completion.usage?.prompt_tokens || 0,
    outputTokens: completion.usage?.completion_tokens || 0,
  });

  // Track AI usage for analytics
  void trackAiUsage({
    featureLabel: "Social • Summary",
    route: "/api/social-insights",
    model: OPENAI_MODELS.fast,
    promptVersion: SOCIAL_SUMMARY_PROMPT_VERSION,
    cacheStatus: "miss",
    inputTokens: completion.usage?.prompt_tokens || 0,
    outputTokens: completion.usage?.completion_tokens || 0,
    totalTokens: completion.usage?.total_tokens || 0,
    userId: null, // User ID not available at this layer
  });

  return {
    summary: parsed.summary?.trim() || responseContent.trim(),
    metadata,
    promptVersion: SOCIAL_SUMMARY_PROMPT_VERSION,
    modelVersion: OPENAI_MODELS.fast,
    inputTokens: completion.usage?.prompt_tokens || 0,
    outputTokens: completion.usage?.completion_tokens || 0,
  };
}

/**
 * Validate a provider string
 */
export function isValidProvider(provider: string): provider is SocialProvider {
  const validProviders: SocialProvider[] = [
    "facebook",
    "instagram",
    "tiktok",
    "x",
    "reddit",
  ];
  return validProviders.includes(provider as SocialProvider);
}

/**
 * Parse metadata from a stored summary that contains embedded metadata
 * Returns default metadata if parsing fails
 */
export function parseMetadataFromSummary(summary: string): SocialInsightsMetadata {
  const defaultMetadata: SocialInsightsMetadata = {
    signalStrength: 0.5,
    accountType: "personal",
    humorEligible: false,
    humorDial: 0.3,
    humorStyle: "unknown",
  };

  try {
    const match = summary.match(/<!-- SOCIAL_INSIGHTS_METADATA\n([\s\S]*?)\n-->/);
    if (match && match[1]) {
      const parsed = JSON.parse(match[1]);
      return {
        signalStrength: Math.max(0, Math.min(1, parsed.signalStrength ?? 0.5)),
        accountType: (["personal", "creator", "brand", "meme", "low_signal"].includes(parsed.accountType)
          ? parsed.accountType
          : "personal") as SocialAccountType,
        humorEligible: parsed.humorEligible === true && (parsed.signalStrength ?? 0) > 0.5,
        humorDial: Math.max(0, Math.min(1, parsed.humorDial ?? 0.3)),
        humorStyle: (["wholesome", "witty", "playful", "dry", "absurd", "unknown"].includes(parsed.humorStyle)
          ? parsed.humorStyle
          : "unknown") as SocialHumorStyle,
      };
    }
  } catch (e) {
    console.warn("[parseMetadataFromSummary] Failed to parse metadata:", e);
  }

  return defaultMetadata;
}

/**
 * Get just the text summary without the metadata block
 */
export function getSummaryTextOnly(summary: string): string {
  return summary.replace(/\n*<!-- SOCIAL_INSIGHTS_METADATA[\s\S]*?-->/, "").trim();
}
