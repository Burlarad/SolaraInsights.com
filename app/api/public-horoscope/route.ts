import { NextRequest, NextResponse } from "next/server";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { PublicHoroscopeRequest, PublicHoroscopeResponse } from "@/types";
import { getCache, setCache, getDayKey } from "@/lib/cache";

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body: PublicHoroscopeRequest = await req.json();
    const { sign, timeframe, timezone, language } = body;

    if (!sign || !timeframe || !timezone) {
      return NextResponse.json(
        { error: "Missing required fields", message: "Sign, timeframe, and timezone are required." },
        { status: 400 }
      );
    }

    // Get language preference (default to English)
    const targetLanguage = language || "en";

    // ========================================
    // CACHING LAYER
    // ========================================

    // Use timezone to compute a day key (public horoscopes refresh daily regardless of timeframe)
    const periodKey = getDayKey(timezone);
    const cacheKey = `publicHoroscope:v1:${sign}:${timeframe}:${periodKey}:${timezone}:${targetLanguage}`;

    // Check cache
    const cachedHoroscope = await getCache<PublicHoroscopeResponse>(cacheKey);
    if (cachedHoroscope) {
      console.log(`[PublicHoroscope] Cache hit for ${cacheKey}`);
      return NextResponse.json(cachedHoroscope);
    }

    console.log(`[PublicHoroscope] Cache miss for ${cacheKey}, generating fresh horoscope...`);

    // Construct the OpenAI prompt
    const systemPrompt = `You are a compassionate astrology guide for Solara Insights, a sanctuary of calm, emotionally intelligent guidance.

Core principles:
- Always uplifting, never deterministic or fear-based
- Emphasize free will, growth, and agency
- Use plain, dyslexia-friendly language with short paragraphs
- Avoid medical, legal, or financial advice
- Focus on emotional intelligence and practical wisdom

This is a PUBLIC, non-personalized reading. Keep it general but still warm and insightful.

LANGUAGE:
- The user has selected language code: ${targetLanguage}
- You MUST write ALL content (title, summary, keyThemes) in the user's selected language
- Field names in the JSON remain in English, but all content values must be in the user's language

You must respond with ONLY valid JSON matching this exact structure. No additional text, no markdown, no explanations—just the JSON object.`;

    const timeframeLabel =
      timeframe === "today"
        ? "Today's"
        : timeframe === "week"
        ? "This Week's"
        : "This Month's";

    const userPrompt = `Generate a ${timeframe} horoscope for ${sign}.

Current date: ${new Date().toISOString()}
Timeframe: ${timeframe}

Return a JSON object with this structure:
{
  "title": "${timeframeLabel} Energy for ${sign}",
  "summary": "2-3 short paragraphs of general guidance for ${sign} during this ${timeframe}",
  "keyThemes": ["theme1", "theme2", "theme3"]
}

Write in a warm, gentle tone. This is a public reading, so keep it general but meaningful.`;

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODELS.horoscope,
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

    // Parse and validate the JSON response
    let horoscope: PublicHoroscopeResponse;
    try {
      horoscope = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", responseContent);
      throw new Error("Invalid response format from AI");
    }

    // Cache the horoscope (TTL: 24 hours)
    await setCache(cacheKey, horoscope, 86400);

    // Return the horoscope
    return NextResponse.json(horoscope);
  } catch (error: any) {
    console.error("Error generating public horoscope:", error);
    return NextResponse.json(
      {
        error: "Generation failed",
        message: "We couldn't generate the horoscope. Please try again in a moment.",
      },
      { status: 500 }
    );
  }
}
