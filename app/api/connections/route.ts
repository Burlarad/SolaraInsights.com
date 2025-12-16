import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { Connection, DailyBrief } from "@/types";
import { touchLastSeen } from "@/lib/activity/touchLastSeen";
import { getDayKey } from "@/lib/cache";

// Must match the PROMPT_VERSION in /api/connection-brief
const DAILY_BRIEF_PROMPT_VERSION = 1;

// Response type with optional brief preview
interface ConnectionWithPreview extends Connection {
  todayBrief?: {
    title: string;
    shared_vibe: string;
  } | null;
}

export async function GET(req: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in to view connections." },
        { status: 401 }
      );
    }

    // Track user activity (non-blocking)
    const admin = createAdminSupabaseClient();
    void touchLastSeen(admin, user.id, 30);

    // Get user's profile for timezone and language
    const { data: profile } = await supabase
      .from("profiles")
      .select("timezone, language")
      .eq("id", user.id)
      .single();

    const timezone = profile?.timezone || "America/New_York";
    const language = profile?.language || "en";

    // Calculate today's local date
    const localDateKey = getDayKey(timezone);
    const localDate = localDateKey.replace("day:", ""); // "YYYY-MM-DD"

    // Fetch all connections for this user
    const { data: connections, error } = await supabase
      .from("connections")
      .select("*")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching connections:", error);
      return NextResponse.json(
        { error: "Database error", message: "Failed to load connections." },
        { status: 500 }
      );
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({ connections: [] });
    }

    // Fetch today's briefs for all connections (if they exist)
    const connectionIds = connections.map((c: Connection) => c.id);
    const { data: todayBriefs } = await supabase
      .from("daily_briefs")
      .select("connection_id, title, shared_vibe")
      .in("connection_id", connectionIds)
      .eq("local_date", localDate)
      .eq("language", language)
      .eq("prompt_version", DAILY_BRIEF_PROMPT_VERSION);

    // Create a map of connection_id -> brief
    const briefMap = new Map<string, { title: string; shared_vibe: string }>();
    if (todayBriefs) {
      for (const brief of todayBriefs) {
        briefMap.set(brief.connection_id, {
          title: brief.title,
          shared_vibe: brief.shared_vibe,
        });
      }
    }

    // Attach brief preview to connections
    const connectionsWithPreviews: ConnectionWithPreview[] = connections.map(
      (connection: Connection) => ({
        ...connection,
        todayBrief: briefMap.get(connection.id) || null,
      })
    );

    return NextResponse.json({ connections: connectionsWithPreviews });
  } catch (error: any) {
    console.error("Error in GET /api/connections:", error);
    return NextResponse.json(
      { error: "Server error", message: "Failed to load connections." },
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
        { error: "Unauthorized", message: "Please sign in to add connections." },
        { status: 401 }
      );
    }

    // Track user activity (non-blocking)
    const admin = createAdminSupabaseClient();
    void touchLastSeen(admin, user.id, 30);

    // Parse request body
    const body = await req.json();
    const {
      name,
      relationship_type,
      birth_date,
      birth_time,
      birth_city,
      birth_region,
      birth_country,
      linked_profile_id,
    } = body;

    if (!name || !relationship_type) {
      return NextResponse.json(
        { error: "Bad request", message: "Name and relationship type are required." },
        { status: 400 }
      );
    }

    // Insert new connection
    const { data: connection, error } = await supabase
      .from("connections")
      .insert({
        owner_user_id: user.id,
        linked_profile_id: linked_profile_id || null,
        name,
        relationship_type,
        birth_date: birth_date || null,
        birth_time: birth_time || null,
        birth_city: birth_city || null,
        birth_region: birth_region || null,
        birth_country: birth_country || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating connection:", error);
      return NextResponse.json(
        { error: "Database error", message: "Failed to create connection." },
        { status: 500 }
      );
    }

    return NextResponse.json({ connection });
  } catch (error: any) {
    console.error("Error in POST /api/connections:", error);
    return NextResponse.json(
      { error: "Server error", message: "Failed to create connection." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in to update connections." },
        { status: 401 }
      );
    }

    // Track user activity (non-blocking)
    const admin = createAdminSupabaseClient();
    void touchLastSeen(admin, user.id, 30);

    // Parse request body
    const body = await req.json();
    const { id, notes } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Bad request", message: "Connection ID is required." },
        { status: 400 }
      );
    }

    // Update connection notes (RLS ensures only owner can update)
    const { data: connection, error } = await supabase
      .from("connections")
      .update({ notes: notes || null, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating connection:", error);
      return NextResponse.json(
        { error: "Database error", message: "Failed to update connection." },
        { status: 500 }
      );
    }

    return NextResponse.json({ connection });
  } catch (error: any) {
    console.error("Error in PATCH /api/connections:", error);
    return NextResponse.json(
      { error: "Server error", message: "Failed to update connection." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Please sign in to delete connections." },
        { status: 401 }
      );
    }

    // Track user activity (non-blocking)
    const admin = createAdminSupabaseClient();
    void touchLastSeen(admin, user.id, 30);

    // Parse request body
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Bad request", message: "Connection ID is required." },
        { status: 400 }
      );
    }

    // Delete connection (RLS ensures only owner can delete)
    const { error } = await supabase
      .from("connections")
      .delete()
      .eq("id", id)
      .eq("owner_user_id", user.id);

    if (error) {
      console.error("Error deleting connection:", error);
      return NextResponse.json(
        { error: "Database error", message: "Failed to delete connection." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in DELETE /api/connections:", error);
    return NextResponse.json(
      { error: "Server error", message: "Failed to delete connection." },
      { status: 500 }
    );
  }
}
