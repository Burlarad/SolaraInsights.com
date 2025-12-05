import { NextRequest, NextResponse } from "next/server";
import { openai, OPENAI_MODELS } from "@/lib/openai/client";
import { PublicHoroscopeRequest, PublicHoroscopeResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body: PublicHoroscopeRequest = await req.json();
    const { sign, timeframe } = body;

    if (!sign || !timeframe) {
      return NextResponse.json(
        { error: "Missing required fields", message: "Sign and timeframe are required." },
        { status: 400 }
      );
    }

    // Construct the OpenAI prompt
    const systemPrompt = `You are a compassionate astrology guide for Solara Insights, a sanctuary of calm, emotionally intelligent guidance.

Core principles:
- Always uplifting, never deterministic or fear-based
- Emphasize free will, growth, and agency
- Use plain, dyslexia-friendly language with short paragraphs
- Avoid medical, legal, or financial advice
- Focus on emotional intelligence and practical wisdom

This is a PUBLIC, non-personalized reading. Keep it general but still warm and insightful.

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
