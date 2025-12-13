import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { touchLastSeen } from "@/lib/activity/touchLastSeen";

export async function GET(req: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in to view your journal." },
        { status: 401 }
      );
    }

    // Track user activity (non-blocking)
    const admin = createAdminSupabaseClient();
    void touchLastSeen(admin, user.id, 30);

    // Get query params
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const timeframe = searchParams.get("timeframe");

    if (!date || !timeframe) {
      return NextResponse.json(
        {
          error: "Bad request",
          message: "Please provide both date and timeframe.",
        },
        { status: 400 }
      );
    }

    // Fetch entry
    const { data: entry, error } = await supabase
      .from("journal_entries")
      .select("content")
      .eq("user_id", user.id)
      .eq("entry_date", date)
      .eq("timeframe", timeframe)
      .maybeSingle();

    if (error) {
      console.error("Error fetching journal entry:", error);
      return NextResponse.json(
        {
          error: "Database error",
          message: "We couldn't load your journal entry. Please try again.",
        },
        { status: 500 }
      );
    }

    // Return content or empty string if no entry
    return NextResponse.json({ content: entry?.content || "" });
  } catch (error: any) {
    console.error("Error in GET /api/journal:", error);
    return NextResponse.json(
      {
        error: "Server error",
        message: "We couldn't load your journal entry. Please try again.",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in to save your journal." },
        { status: 401 }
      );
    }

    // Track user activity (non-blocking)
    const admin = createAdminSupabaseClient();
    void touchLastSeen(admin, user.id, 30);

    // Parse request body
    const body = await req.json();
    const { date, timeframe, content } = body;

    if (!date || !timeframe || content === undefined) {
      return NextResponse.json(
        {
          error: "Bad request",
          message: "Please provide date, timeframe, and content.",
        },
        { status: 400 }
      );
    }

    // Validate timeframe
    if (!["today", "week", "month", "year"].includes(timeframe)) {
      return NextResponse.json(
        {
          error: "Bad request",
          message: "Timeframe must be one of: today, week, month, year.",
        },
        { status: 400 }
      );
    }

    // Upsert entry (insert or update)
    const { error } = await supabase
      .from("journal_entries")
      .upsert(
        {
          user_id: user.id,
          entry_date: date,
          timeframe,
          content,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,entry_date,timeframe",
        }
      );

    if (error) {
      console.error("Error saving journal entry:", error);
      return NextResponse.json(
        {
          error: "Journal save failed",
          message: "We couldn't save your reflection. Please try again.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in POST /api/journal:", error);
    return NextResponse.json(
      {
        error: "Server error",
        message: "We couldn't save your reflection. Please try again.",
      },
      { status: 500 }
    );
  }
}
