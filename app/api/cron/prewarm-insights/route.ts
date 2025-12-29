/**
 * Cron job to pre-warm Sanctuary Insights cache for active users
 *
 * Runs every 30 minutes, checks for users within 3 hours of their local midnight,
 * and pre-generates tomorrow's daily insight to ensure instant page loads.
 *
 * Schedule: every 30 minutes
 * Auth: x-cron-secret header must match CRON_SECRET env var
 *
 * Usage:
 *   curl -H "x-cron-secret: YOUR_SECRET" https://your-domain.com/api/cron/prewarm-insights
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { getTarotCardNames } from "@/lib/tarot";
import { getRuneNames } from "@/lib/runes";
import { getCache, setCache, acquireLock, releaseLock, getDayKey } from "@/lib/cache/redis";
import { buildInsightCacheKey, buildInsightLockKey } from "@/lib/timezone/periodKeys";
import { toZonedTime, format } from "date-fns-tz";
import { addDays } from "date-fns";
import { SanctuaryInsight, Connection } from "@/types";
import { trackAiUsage } from "@/lib/ai/trackUsage";
import { checkBudget, incrementBudget } from "@/lib/ai/costControl";
import { AYREN_MODE_SHORT, PRO_SOCIAL_NUDGE_INSTRUCTION, HUMOR_INSTRUCTION, LOW_SIGNAL_GUARDRAIL } from "@/lib/ai/voice";
import { logTokenAudit } from "@/lib/ai/tokenAudit";
import { isValidBirthTimezone } from "@/lib/location/detection";

const PROMPT_VERSION = 2;
const BRIEF_PROMPT_VERSION = 1; // Must match /api/connection-brief
const PREWARM_WINDOW_HOURS = 3; // Pre-warm if within 3 hours of midnight
const MAX_USERS_PER_RUN = 500; // Safety cap to avoid timeouts
const BRIEF_ACTIVITY_WINDOW_DAYS = 3; // Only prewarm briefs for users active in last 3 days

export async function GET(req: NextRequest) {
  // Auth: Check x-cron-secret header
  const cronSecret = req.headers.get("x-cron-secret");

  if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
    console.warn("[Prewarm] Unauthorized cron attempt");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Prewarm] Starting pre-warm job...");

  const stats = {
    scannedUsers: 0,
    candidates: 0,
    warmed: 0,
    skippedCached: 0,
    skippedLocked: 0,
    skippedInvalidTz: 0, // PR2: Users with missing/UTC timezone
    errors: 0,
    // Connection brief stats
    briefCandidates: 0, // Users eligible for brief prewarming (active in last 3 days)
    briefsWarmed: 0,
    briefsSkippedCached: 0,
    briefsSkippedLocked: 0,
    briefErrors: 0,
  };

  try {
    const admin = createAdminSupabaseClient();

    // Query active users (last seen in last 7 days)
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id, timezone, language, last_seen_at")
      .gte("last_seen_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(MAX_USERS_PER_RUN);

    if (error) {
      console.error("[Prewarm] Failed to query profiles:", error);
      return NextResponse.json(
        { error: "Database query failed", stats },
        { status: 500 }
      );
    }

    if (!profiles || profiles.length === 0) {
      console.log("[Prewarm] No active users found");
      return NextResponse.json({ message: "No active users", stats });
    }

    stats.scannedUsers = profiles.length;
    console.log(`[Prewarm] Scanned ${stats.scannedUsers} active users`);

    // Process each user
    for (const profile of profiles) {
      try {
        const userId = profile.id;

        // PR2 Guardrail: Skip users with invalid/UTC timezone
        // Don't fall back to UTC - it produces wrong timing for insights
        if (!isValidBirthTimezone(profile.timezone)) {
          stats.skippedInvalidTz++;
          continue; // Skip this user silently (logged once at end via stats)
        }

        const timezone = profile.timezone!; // Safe - validated above
        const language = profile.language || "en";

        // Check if user is within PREWARM_WINDOW_HOURS of their local midnight
        const now = new Date();
        const localNow = toZonedTime(now, timezone);

        // Calculate next midnight in user's timezone
        const tomorrow = addDays(localNow, 1);
        const nextMidnight = new Date(
          tomorrow.getFullYear(),
          tomorrow.getMonth(),
          tomorrow.getDate(),
          0, 0, 0, 0
        );

        const timeUntilMidnight = (nextMidnight.getTime() - localNow.getTime()) / (1000 * 60 * 60);

        if (timeUntilMidnight > PREWARM_WINDOW_HOURS) {
          // Not within pre-warm window, skip
          continue;
        }

        stats.candidates++;

        // Compute tomorrow's period key (format: YYYY-MM-DD)
        const tomorrowPeriodKey = format(tomorrow, "yyyy-MM-dd", { timeZone: timezone });

        // Build cache and lock keys for tomorrow's daily insight
        const cacheKey = buildInsightCacheKey(userId, "today", tomorrowPeriodKey, language, PROMPT_VERSION);
        const lockKey = buildInsightLockKey(userId, "today", tomorrowPeriodKey, PROMPT_VERSION);

        // Check if already cached
        const cached = await getCache<SanctuaryInsight>(cacheKey);
        if (cached) {
          stats.skippedCached++;
          continue;
        }

        // Try to acquire lock
        const lockAcquired = await acquireLock(lockKey, 60);
        if (!lockAcquired) {
          stats.skippedLocked++;
          continue;
        }

        // Generate insight (same logic as /api/insights)
        try {
          // P0: Budget check before OpenAI call
          const budgetCheck = await checkBudget();
          if (!budgetCheck.allowed) {
            console.warn(`[Prewarm] Budget exceeded, stopping pre-warm job`);
            await releaseLock(lockKey);
            // Return early with current stats when budget is exceeded
            return NextResponse.json({
              message: "Pre-warm stopped - budget exceeded",
              stats,
            });
          }

          // Load full profile for generation
          const { data: fullProfile } = await admin
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .single();

          if (!fullProfile || !fullProfile.birth_date || !fullProfile.timezone) {
            // Skip if profile incomplete
            await releaseLock(lockKey);
            continue;
          }

          // Optionally load social summary
          const { data: socialSummary } = await admin
            .from("social_summaries")
            .select("*")
            .eq("user_id", userId)
            .eq("provider", "facebook")
            .order("last_fetched_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          // Build OpenAI prompt using Ayren voice (same as /api/insights)
          const systemPrompt = `${AYREN_MODE_SHORT}

CONTEXT:
This is a PERSONALIZED insight for a specific person based on their birth chart and current transits.

LANGUAGE:
- Write ALL narrative text in language code: ${language}
- Field names in JSON remain in English, but all content values must be in the user's language

OUTPUT FORMAT:
Respond with ONLY valid JSON. No markdown, no explanations—just the JSON object.`;

          const tarotCardNames = getTarotCardNames();
          const runeNames = getRuneNames();

          const userPrompt = `Generate today insights for ${fullProfile.preferred_name || fullProfile.full_name || "this person"}.

Birth details:
- Date: ${fullProfile.birth_date}
- Time: ${fullProfile.birth_time || "unknown"}
- Location: ${fullProfile.birth_city || "unknown"}, ${fullProfile.birth_region || ""}, ${fullProfile.birth_country || ""}
- Timezone: ${fullProfile.timezone}
- Sign: ${fullProfile.zodiac_sign || "unknown"}

Current date: ${new Date().toISOString()}
Period: ${tomorrowPeriodKey} (today)
Timeframe: today

${socialSummary?.summary ? `Social context (optional, do not mention platforms directly):

${socialSummary.summary}

If this block is empty or missing, ignore it. Use it subtly to enhance your understanding of their emotional tone and expression patterns.` : ""}

IMPORTANT CONSTRAINTS:

For the tarot card:
- You MUST choose exactly one cardName from this list: ${tarotCardNames.join(", ")}.
- Do NOT invent card names outside this list.
- Do NOT claim you are literally drawing from a physical deck.
- Treat the card as a symbolic archetype that fits this person's current energy.

For the rune:
- You MUST choose exactly one name from this list: ${runeNames.join(", ")}.
- Do NOT invent new rune names.
- Do NOT claim you are physically pulling a rune.
- Present it as a symbolic archetype.

Return a JSON object with this structure:
{
  "personalNarrative": "Exactly 2 paragraphs, 8-12 sentences total. Include 1 micro-action (<=10 min). Follow Ayren voice rules.",
  "emotionalCadence": {
    "dawn": "one-word emotional state",
    "midday": "one-word emotional state",
    "dusk": "one-word emotional state"
  },
  "coreThemes": ["theme1", "theme2", "theme3"],
  "focusForPeriod": "one paragraph of practical focus",
  "tarot": {
    "cardName": "card name",
    "arcanaType": "Major or Minor Arcana",
    "summary": "one sentence",
    "symbolism": "one paragraph",
    "guidance": "one paragraph"
  },
  "rune": {
    "name": "rune name",
    "keyword": "one word",
    "meaning": "one paragraph",
    "affirmation": "one sentence"
  },
  "luckyCompass": {
    "numbers": [
      {"value": NUMBER_1_99, "label": "ROOT|PATH|BLOOM", "meaning": "one sentence"},
      {"value": NUMBER_1_99, "label": "ROOT|PATH|BLOOM", "meaning": "one sentence"},
      {"value": NUMBER_1_99, "label": "ROOT|PATH|BLOOM", "meaning": "one sentence"}
    ],
    "powerWords": ["WORD1", "WORD2", "WORD3"],
    "handwrittenNote": "1-2 sentence affirmation"
  },
  "journalPrompt": "A gentle reflection question for their private journal"
}

LUCKY COMPASS RULES:
- Generate 3 DIFFERENT lucky numbers between 1-99 (not duplicates)
- Numbers should feel meaningful for this specific period (${tomorrowPeriodKey}) and person
- Each period should produce different numbers - do NOT reuse the same numbers across periods
- Labels should be one of: ROOT (grounding), PATH (direction), BLOOM (growth)
- Power words should be inspiring single words relevant to this period`;

          // Call OpenAI
          const completion = await openai.chat.completions.create({
            model: OPENAI_MODELS.dailyInsights,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.8,
            response_format: { type: "json_object" },
          });

          const responseContent = completion.choices[0]?.message?.content;

          if (!responseContent) {
            throw new Error("No response from OpenAI");
          }

          // Track AI usage (cache miss only - no tracking for cache hits in cron)
          void trackAiUsage({
            featureLabel: "Sanctuary • Daily Light (Prewarm)",
            route: "/api/cron/prewarm-insights",
            model: OPENAI_MODELS.dailyInsights,
            promptVersion: PROMPT_VERSION,
            cacheStatus: "miss",
            inputTokens: completion.usage?.prompt_tokens || 0,
            outputTokens: completion.usage?.completion_tokens || 0,
            totalTokens: completion.usage?.total_tokens || 0,
            userId,
            timeframe: "today",
            periodKey: tomorrowPeriodKey,
            language,
            timezone,
          });

          // P0: Increment daily budget counter
          void incrementBudget(
            OPENAI_MODELS.dailyInsights,
            completion.usage?.prompt_tokens || 0,
            completion.usage?.completion_tokens || 0
          );

          // Token audit logging
          logTokenAudit({
            route: "/api/cron/prewarm-insights",
            featureLabel: "Sanctuary • Daily Light (Prewarm)",
            model: OPENAI_MODELS.dailyInsights,
            cacheStatus: "miss",
            promptVersion: PROMPT_VERSION,
            inputTokens: completion.usage?.prompt_tokens || 0,
            outputTokens: completion.usage?.completion_tokens || 0,
            language,
            timeframe: "today",
          });

          // Parse response
          const insight: SanctuaryInsight = JSON.parse(responseContent);

          // Cache with 48h TTL (same as daily insights)
          await setCache(cacheKey, insight, 172800);

          stats.warmed++;
          console.log(`[Prewarm] ✓ Warmed insight for user ${userId} (${tomorrowPeriodKey})`);

          // ========================================
          // PREWARM CONNECTION BRIEFS
          // Only for users active in last 3 days
          // ========================================
          const lastSeenAt = profile.last_seen_at ? new Date(profile.last_seen_at) : null;
          const threeDaysAgo = new Date(Date.now() - BRIEF_ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

          if (lastSeenAt && lastSeenAt >= threeDaysAgo) {
            stats.briefCandidates++;

            // Load all connections for this user
            const { data: connections } = await admin
              .from("connections")
              .select("id, name, relationship_type")
              .eq("owner_user_id", userId);

            if (connections && connections.length > 0) {
              console.log(`[Prewarm] Processing ${connections.length} connection briefs for user ${userId}`);

              // Calculate tomorrow's local date for briefs
              const tomorrowLocalDate = format(tomorrow, "yyyy-MM-dd", { timeZone: timezone });

              for (const connection of connections) {
                try {
                  // Check if brief already exists for tomorrow
                  const { data: existingBrief } = await admin
                    .from("daily_briefs")
                    .select("id")
                    .eq("connection_id", connection.id)
                    .eq("local_date", tomorrowLocalDate)
                    .eq("language", language)
                    .eq("prompt_version", BRIEF_PROMPT_VERSION)
                    .single();

                  if (existingBrief) {
                    stats.briefsSkippedCached++;
                    continue;
                  }

                  // Try to acquire lock for this brief
                  const briefLockKey = `lock:dailybrief:v${BRIEF_PROMPT_VERSION}:${connection.id}:${tomorrowLocalDate}:${language}`;
                  const briefLockAcquired = await acquireLock(briefLockKey, 60);

                  if (!briefLockAcquired) {
                    stats.briefsSkippedLocked++;
                    continue;
                  }

                  try {
                    // Budget check before each brief
                    const briefBudgetCheck = await checkBudget();
                    if (!briefBudgetCheck.allowed) {
                      console.warn(`[Prewarm] Budget exceeded during brief generation, stopping`);
                      await releaseLock(briefLockKey);
                      break; // Stop all brief generation for this user
                    }

                    // Generate brief using same logic as /api/connection-brief
                    const getToneGuidance = (type: string): string => {
                      const t = type.toLowerCase();
                      if (t === "partner") {
                        return "Warm, affectionate tone is appropriate. May reference closeness and partnership.";
                      } else if (t === "friend" || t === "colleague") {
                        return "Warm, platonic tone. Never romance-coded. Focus on mutual support and camaraderie.";
                      } else if (t === "parent" || t === "child" || t === "sibling") {
                        return "Family-appropriate tone. Focus on unconditional bonds and care.";
                      }
                      return "Warm, neutral tone. Default to friend-safe content.";
                    };

                    const toneGuidance = getToneGuidance(connection.relationship_type);
                    const connectionName = connection.name;

                    const briefSystemPrompt = `${AYREN_MODE_SHORT}
${PRO_SOCIAL_NUDGE_INSTRUCTION}
${HUMOR_INSTRUCTION}
${LOW_SIGNAL_GUARDRAIL}

You are generating a DAILY CONNECTION BRIEF - a light, general "weather report" for the connection today.

CONTEXT:
This is a ${connection.relationship_type} connection with ${connectionName}.

TONE GUIDANCE:
${toneGuidance}

NAMING RULES (STRICT):
- Always use "you" when referring to the person reading this
- Always use "${connectionName}" when referring to the other person
- NEVER use "Person 1", "Person 2", or any impersonal labels
- Use "you and ${connectionName}" phrasing throughout

SAFETY RULES (STRICT):
- This is a GENERAL "weather report" - NOT a detailed analysis
- Never claim to know ${connectionName}'s private thoughts or feelings
- Never be creepy, coercive, or manipulative
- Never give advice to manipulate or trigger ${connectionName}
- Keep it uplifting and general
- Use "may," "might," "could" — not "will" or "is"

OUTPUT FORMAT:
Return ONLY valid JSON:
{
  "title": "Today with ${connectionName}",
  "shared_vibe": "2-4 sentences describing the shared energy today. General, warm, non-invasive. Like a weather report for the connection.",
  "ways_to_show_up": [
    "Action-verb bullet 1 (e.g., 'Listen for what isn't being said')",
    "Action-verb bullet 2 (e.g., 'Share a small appreciation')",
    "Action-verb bullet 3 (e.g., 'Give space when needed')"
  ],
  "nudge": "Optional single line micro-nudge, or null if not needed. Must be gentle, never pushy."
}`;

                    const briefUserPrompt = `Generate a daily connection brief for ${connectionName} (${connection.relationship_type}).

The brief should feel like a gentle morning weather report for the connection - light, warm, and supportive.

Ways to show up bullets must:
- Start with an action verb
- Be completable in 10 minutes or less
- Be appropriate for a ${connection.relationship_type} relationship

Return the JSON object now.`;

                    const briefCompletion = await openai.chat.completions.create({
                      model: OPENAI_MODELS.connectionBrief,
                      messages: [
                        { role: "system", content: briefSystemPrompt },
                        { role: "user", content: briefUserPrompt },
                      ],
                      temperature: 0.75,
                      response_format: { type: "json_object" },
                    });

                    const briefResponseContent = briefCompletion.choices[0]?.message?.content;

                    if (!briefResponseContent) {
                      throw new Error("No response from OpenAI for brief");
                    }

                    // Track usage
                    void trackAiUsage({
                      featureLabel: "Connections • Daily Brief (Prewarm)",
                      route: "/api/cron/prewarm-insights",
                      model: OPENAI_MODELS.connectionBrief,
                      promptVersion: BRIEF_PROMPT_VERSION,
                      cacheStatus: "miss",
                      inputTokens: briefCompletion.usage?.prompt_tokens || 0,
                      outputTokens: briefCompletion.usage?.completion_tokens || 0,
                      totalTokens: briefCompletion.usage?.total_tokens || 0,
                      userId,
                      timeframe: "today",
                      periodKey: tomorrowLocalDate,
                      language,
                      timezone,
                    });

                    void incrementBudget(
                      OPENAI_MODELS.connectionBrief,
                      briefCompletion.usage?.prompt_tokens || 0,
                      briefCompletion.usage?.completion_tokens || 0
                    );

                    logTokenAudit({
                      route: "/api/cron/prewarm-insights",
                      featureLabel: "Connections • Daily Brief (Prewarm)",
                      model: OPENAI_MODELS.connectionBrief,
                      cacheStatus: "miss",
                      promptVersion: BRIEF_PROMPT_VERSION,
                      inputTokens: briefCompletion.usage?.prompt_tokens || 0,
                      outputTokens: briefCompletion.usage?.completion_tokens || 0,
                      language,
                      timeframe: "today",
                    });

                    // Parse response
                    const briefContent = JSON.parse(briefResponseContent);

                    // Validate required fields
                    if (!briefContent.title || !briefContent.shared_vibe || !Array.isArray(briefContent.ways_to_show_up)) {
                      throw new Error("Missing required fields in brief AI response");
                    }

                    // Ensure exactly 3 ways_to_show_up
                    while (briefContent.ways_to_show_up.length < 3) {
                      briefContent.ways_to_show_up.push("Be present and attentive");
                    }
                    briefContent.ways_to_show_up = briefContent.ways_to_show_up.slice(0, 3);

                    // Save to database
                    const { error: saveError } = await admin
                      .from("daily_briefs")
                      .insert({
                        connection_id: connection.id,
                        owner_user_id: userId,
                        local_date: tomorrowLocalDate,
                        language,
                        prompt_version: BRIEF_PROMPT_VERSION,
                        model_version: OPENAI_MODELS.connectionBrief,
                        title: briefContent.title,
                        shared_vibe: briefContent.shared_vibe,
                        ways_to_show_up: briefContent.ways_to_show_up,
                        nudge: briefContent.nudge || null,
                      });

                    if (saveError) {
                      console.error(`[Prewarm] Failed to save brief for connection ${connection.id}:`, saveError.message);
                    } else {
                      stats.briefsWarmed++;
                    }
                  } finally {
                    await releaseLock(briefLockKey);
                  }
                } catch (briefError: any) {
                  console.error(`[Prewarm] Brief generation failed for connection ${connection.id}:`, briefError.message);
                  stats.briefErrors++;
                }
              }

              console.log(`[Prewarm] Generated ${stats.briefsWarmed} briefs for user ${userId}`);
            }
          }
        } catch (genError: any) {
          console.error(`[Prewarm] Generation failed for user ${userId}:`, genError.message);
          stats.errors++;
        } finally {
          // Always release lock
          await releaseLock(lockKey);
        }
      } catch (userError: any) {
        console.error(`[Prewarm] Error processing user ${profile.id}:`, userError.message);
        stats.errors++;
      }
    }

    // Log summary including timezone issues
    if (stats.skippedInvalidTz > 0) {
      console.log(
        `[Prewarm] Note: ${stats.skippedInvalidTz} users skipped due to missing/UTC timezone (need to update birth location)`
      );
    }

    // Log brief stats separately for clarity
    if (stats.briefCandidates > 0) {
      console.log(
        `[Prewarm] Connection briefs: ${stats.briefsWarmed} warmed, ${stats.briefsSkippedCached} cached, ${stats.briefsSkippedLocked} locked, ${stats.briefErrors} errors`
      );
    }

    console.log(`[Prewarm] Job complete:`, stats);

    return NextResponse.json({
      message: "Pre-warm complete",
      stats,
    });
  } catch (error: any) {
    console.error("[Prewarm] Job failed:", error);
    return NextResponse.json(
      { error: "Pre-warm job failed", message: error.message, stats },
      { status: 500 }
    );
  }
}
