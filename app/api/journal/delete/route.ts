import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { touchLastSeen } from "@/lib/activity/touchLastSeen";

export async function DELETE(req: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in to delete your journal." },
        { status: 401 }
      );
    }

    // Track user activity (non-blocking)
    const admin = createAdminSupabaseClient();
    void touchLastSeen(admin, user.id, 30);

    // Delete all entries for this user
    const { error } = await supabase
      .from("journal_entries")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting journal entries:", error);
      return NextResponse.json(
        {
          error: "Database error",
          message: "We couldn't clear your journal. Please try again.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in DELETE /api/journal/delete:", error);
    return NextResponse.json(
      {
        error: "Server error",
        message: "We couldn't clear your journal. Please try again.",
      },
      { status: 500 }
    );
  }
}
