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
import { getCache, setCache, acquireLock, releaseLock } from "@/lib/cache/redis";
import { buildInsightCacheKey, buildInsightLockKey } from "@/lib/timezone/periodKeys";
import { toZonedTime, format } from "date-fns-tz";
import { addDays } from "date-fns";
import { SanctuaryInsight } from "@/types";
import { trackAiUsage } from "@/lib/ai/trackUsage";
import { AYREN_MODE_SHORT } from "@/lib/ai/voice";

const PROMPT_VERSION = 2;
const PREWARM_WINDOW_HOURS = 3; // Pre-warm if within 3 hours of midnight
const MAX_USERS_PER_RUN = 500; // Safety cap to avoid timeouts

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
    errors: 0,
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
        const timezone = profile.timezone || "UTC";
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
            .order("last_collected_at", { ascending: false })
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
      {"value": 18, "label": "ROOT", "meaning": "one sentence"},
      {"value": 56, "label": "ROOT", "meaning": "one sentence"},
      {"value": 66, "label": "ROOT", "meaning": "one sentence"}
    ],
    "powerWords": ["WORD1", "WORD2", "WORD3"],
    "handwrittenNote": "1-2 sentence affirmation"
  },
  "journalPrompt": "A gentle reflection question for their private journal"
}`;

          // Call OpenAI
          const completion = await openai.chat.completions.create({
            model: OPENAI_MODELS.insights,
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
            model: OPENAI_MODELS.insights,
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

          // Parse response
          const insight: SanctuaryInsight = JSON.parse(responseContent);

          // Cache with 48h TTL (same as daily insights)
          await setCache(cacheKey, insight, 172800);

          stats.warmed++;
          console.log(`[Prewarm] ✓ Warmed insight for user ${userId} (${tomorrowPeriodKey})`);
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
