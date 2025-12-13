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
        { error: "Unauthorized", message: "Please sign in to export your journal." },
        { status: 401 }
      );
    }

    // Track user activity (non-blocking)
    const admin = createAdminSupabaseClient();
    void touchLastSeen(admin, user.id, 30);

    // Fetch all entries for user, ordered by date (oldest first)
    const { data: entries, error } = await supabase
      .from("journal_entries")
      .select("entry_date, timeframe, content")
      .eq("user_id", user.id)
      .order("entry_date", { ascending: true });

    if (error) {
      console.error("Error fetching journal entries:", error);
      return NextResponse.json(
        {
          error: "Database error",
          message: "We couldn't export your journal. Please try again.",
        },
        { status: 500 }
      );
    }

    // Build markdown content
    let markdown = "# Solara Journal\n\n";

    if (!entries || entries.length === 0) {
      markdown += "*No journal entries yet.*\n";
    } else {
      for (const entry of entries) {
        markdown += `## ${entry.entry_date} (${entry.timeframe})\n\n`;
        markdown += `${entry.content}\n\n`;
        markdown += "---\n\n";
      }
    }

    // Return as downloadable markdown file
    return new NextResponse(markdown, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": 'attachment; filename="solara-journal.md"',
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/journal/export:", error);
    return NextResponse.json(
      {
        error: "Server error",
        message: "We couldn't export your journal. Please try again.",
      },
      { status: 500 }
    );
  }
}
