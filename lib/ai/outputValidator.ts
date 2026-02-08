/**
 * Output Validator: "Fun Not Creepy"
 *
 * Validates AI outputs to ensure they don't imply surveillance,
 * mention social platforms, or reference specific posts/content.
 *
 * Used as a post-processor for OpenAI responses.
 */

import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { incrementValidatorViolation } from "./metrics";

/**
 * Banned phrase patterns that indicate "creepy" surveillance language
 */
const BANNED_PATTERNS: RegExp[] = [
  // Direct surveillance implications
  /\bi\s+(saw|noticed|observed|read|found|detected)\b.{0,30}(your|their)\s+(post|tweet|content|update|message|comment|caption)/i,
  /\b(your|their)\s+social\s+(media|account|profile|presence|feed|timeline)/i,
  /\bfrom\s+(what\s+)?i\s+(can\s+)?(see|observe|notice|read|tell)/i,
  /\bi['']ve\s+been\s+(watching|observing|monitoring|tracking|following)/i,
  /\byou\s+(posted|shared|tweeted|wrote|said)\b/i,
  /\bin\s+your\s+(recent\s+)?(posts?|tweets?|updates?|stories?)/i,
  /\bbased\s+on\s+(your|their)\s+(posts?|content|activity)/i,

  // Platform name mentions
  /\b(facebook|instagram|twitter|tiktok|reddit|x\.com)\b/i,
  /\b(fb|ig|insta)\b/i,

  // Specific post references
  /\byour\s+(last|recent|latest)\s+(post|tweet|story|update)/i,
  /\bwhen\s+you\s+(posted|shared|wrote)\s+about/i,
  /\bthat\s+(post|tweet|story)\s+(you|where)/i,
];

/**
 * Softer patterns that are warnings but may be acceptable in context
 */
const WARNING_PATTERNS: RegExp[] = [
  /\byour\s+online\s+(presence|activity)/i,
  /\bdigital\s+(footprint|presence)/i,
  /\bsocial\s+(signals?|cues?|patterns?)/i,
];

export interface ValidationResult {
  valid: boolean;
  matches: string[];
  warnings: string[];
}

/**
 * Validate that text doesn't contain creepy surveillance language
 */
export function validateOutputNotCreepy(text: string): ValidationResult {
  const matches: string[] = [];
  const warnings: string[] = [];

  for (const pattern of BANNED_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }

  for (const pattern of WARNING_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      warnings.push(match[0]);
    }
  }

  return {
    valid: matches.length === 0,
    matches,
    warnings,
  };
}

/**
 * Validate a JSON object by checking all string values recursively
 */
export function validateJsonOutputNotCreepy(obj: unknown): ValidationResult {
  const allText = extractAllStrings(obj).join(" ");
  return validateOutputNotCreepy(allText);
}

/**
 * Extract all string values from a nested object
 */
function extractAllStrings(obj: unknown): string[] {
  const strings: string[] = [];

  if (typeof obj === "string") {
    strings.push(obj);
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      strings.push(...extractAllStrings(item));
    }
  } else if (obj && typeof obj === "object") {
    for (const value of Object.values(obj)) {
      strings.push(...extractAllStrings(value));
    }
  }

  return strings;
}

/**
 * Repair prompt for remediation
 */
const REPAIR_PROMPT = `You provided a response that contained phrases implying you observed the user's social media posts directly. This violates our privacy guidelines.

TASK: Rewrite the JSON exactly, preserving the meaning and structure, but:
1. Remove ANY phrases like "I saw your posts", "your social media", "you posted", "based on your content"
2. Remove ANY platform names (Facebook, Instagram, TikTok, Twitter, Reddit)
3. Keep the warm, fun, personalized tone
4. Ground insights in astrology/cosmic themes instead of social observations
5. If referencing emotional patterns, attribute them to "your current energy" or "cosmic influences" not social activity

Return ONLY the corrected JSON object, no explanation.`;

/**
 * Attempt to remediate a creepy response by asking OpenAI to rewrite it
 *
 * @param originalResponse - The original JSON response that failed validation
 * @param route - Route name for logging
 * @returns Remediated response or null if remediation fails
 */
export async function attemptRemediation(
  originalResponse: string,
  route: string
): Promise<string | null> {
  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODELS.fast,
      messages: [
        { role: "system", content: REPAIR_PROMPT },
        { role: "user", content: originalResponse },
      ],
      temperature: 0.3, // Lower temperature for more deterministic repair
      response_format: { type: "json_object" },
    });

    const repaired = completion.choices[0]?.message?.content;
    if (!repaired) return null;

    // Validate the repaired response
    const revalidation = validateOutputNotCreepy(repaired);
    if (!revalidation.valid) {
      // Remediation failed - still has banned phrases
      console.warn(`[OutputValidator] Remediation failed for ${route}, still has violations:`, revalidation.matches);
      incrementValidatorViolation(route, "remediation_failed");
      return null;
    }

    incrementValidatorViolation(route, "remediation_success");
    return repaired;
  } catch (error) {
    console.error(`[OutputValidator] Remediation error for ${route}:`, error);
    incrementValidatorViolation(route, "remediation_error");
    return null;
  }
}

/**
 * Process an OpenAI response with validation and optional remediation
 *
 * @param responseContent - Raw response content from OpenAI
 * @param route - Route name for logging
 * @param allowRemediation - Whether to attempt remediation on failure
 * @returns Processed response (original, remediated, or null if all fails)
 */
export async function processWithValidation(
  responseContent: string,
  route: string,
  allowRemediation: boolean = true
): Promise<{ content: string; wasRemediated: boolean } | null> {
  const validation = validateOutputNotCreepy(responseContent);

  if (validation.valid) {
    // Log warnings but don't block
    if (validation.warnings.length > 0) {
      console.log(`[OutputValidator] Warnings for ${route}:`, validation.warnings);
    }
    return { content: responseContent, wasRemediated: false };
  }

  // Log violation (no sensitive data)
  console.warn(`[OutputValidator] Violation in ${route}: ${validation.matches.length} banned phrases detected`);
  incrementValidatorViolation(route, "violation");

  if (!allowRemediation) {
    return null;
  }

  // Attempt remediation
  const remediated = await attemptRemediation(responseContent, route);
  if (remediated) {
    return { content: remediated, wasRemediated: true };
  }

  return null;
}
