/**
 * Token Audit Helper for OpenAI Cost Analysis
 *
 * This helper logs compact JSON lines for token usage analysis.
 * IMPORTANT: Never log prompts, responses, API keys, or any PII.
 *
 * Usage:
 *   import { logTokenAudit, estimateTokens } from "@/lib/ai/tokenAudit";
 *
 *   // After OpenAI call:
 *   logTokenAudit({
 *     route: "/api/insights",
 *     featureLabel: "Sanctuary • Daily",
 *     model: OPENAI_MODELS.insights,
 *     cacheStatus: "miss",
 *     promptVersion: 2,
 *     inputTokens: completion.usage?.prompt_tokens || 0,
 *     outputTokens: completion.usage?.completion_tokens || 0,
 *     language: "en",
 *     timeframe: "today",
 *   });
 */

export interface TokenAuditEvent {
  route: string;
  featureLabel: string;
  model: string;
  cacheStatus: "hit" | "miss";
  promptVersion?: number;
  inputTokens: number;
  outputTokens: number;
  language?: string;
  timeframe?: string;
  periodKey?: string;
  userId?: string; // Optional - only include if needed for user-level analysis
}

/**
 * Log a compact JSON line for token audit.
 * Format: [TOKEN_AUDIT] {"route":"/api/insights","feature":"...","model":"...","cache":"miss","in":1234,"out":456,"total":1690}
 *
 * Only logs in development or when TOKEN_AUDIT_ENABLED=true
 */
export function logTokenAudit(event: TokenAuditEvent): void {
  // Only log if TOKEN_AUDIT_ENABLED is set or in development
  if (process.env.TOKEN_AUDIT_ENABLED !== "true" && process.env.NODE_ENV !== "development") {
    return;
  }

  const total = event.inputTokens + event.outputTokens;

  // Compact JSON format - no secrets, no prompts
  const auditLog = {
    route: event.route,
    feature: event.featureLabel,
    model: event.model,
    cache: event.cacheStatus,
    pv: event.promptVersion || 0,
    in: event.inputTokens,
    out: event.outputTokens,
    total,
    lang: event.language || "en",
    tf: event.timeframe || null,
  };

  console.log(`[TOKEN_AUDIT] ${JSON.stringify(auditLog)}`);
}

/**
 * Estimate token count from text using character approximation.
 * This is a fallback when tiktoken is not available.
 *
 * Approximation: ~4 characters per token (GPT-4 average)
 *
 * For accurate counts, use OpenAI's response.usage values instead.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // GPT-4 averages ~4 chars per token
  // This is an approximation - actual tokenization varies
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens for a messages array (system + user prompts)
 * Adds overhead for message structure (~4 tokens per message)
 */
export function estimateMessagesTokens(messages: { role: string; content: string }[]): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateTokens(msg.content);
    total += 4; // ~4 tokens per message overhead
  }
  total += 3; // priming tokens
  return total;
}

/**
 * Log a cache hit event (0 tokens consumed)
 */
export function logCacheHit(route: string, featureLabel: string, model: string): void {
  logTokenAudit({
    route,
    featureLabel,
    model,
    cacheStatus: "hit",
    inputTokens: 0,
    outputTokens: 0,
  });
}

/**
 * Format for extracting audit logs:
 * grep '\[TOKEN_AUDIT\]' logs.txt | sed 's/.*\[TOKEN_AUDIT\] //' > raw_audit.json
 *
 * Then sum in any language:
 * jq -s '[.[] | select(.cache == "miss")] | {total_in: (map(.in) | add), total_out: (map(.out) | add)}' raw_audit.json
 */
