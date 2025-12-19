import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createAdminSupabaseClient } from "@/lib/supabase/server";
import { Connection, DailyBrief } from "@/types";
import { touchLastSeen } from "@/lib/activity/touchLastSeen";
import { getDayKey } from "@/lib/cache";
import { resolveProfileFromConnection } from "@/lib/connections/profileMatch";
import tzLookup from "tz-lookup";

// Helper to compute timezone from coordinates and validate it's not UTC/GMT
function computeTimezone(lat: number, lon: number): string | null {
  // Validate coordinate ranges
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return null;
  }

  try {
    const tz = tzLookup(lat, lon);
    // Reject UTC/GMT timezones - they indicate ocean/invalid coordinates
    if (!tz || tz === "UTC" || tz === "Etc/UTC" || tz.startsWith("Etc/GMT")) {
      return null;
    }
    return tz;
  } catch {
    return null;
  }
}

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
      birth_lat,
      birth_lon,
      linked_profile_id,
    } = body;

    if (!name || !relationship_type) {
      return NextResponse.json(
        { error: "Bad request", message: "Name and relationship type are required." },
        { status: 400 }
      );
    }

    // Compute timezone from coordinates if provided
    let timezone: string | null = null;
    if (birth_lat !== undefined && birth_lon !== undefined && birth_lat !== null && birth_lon !== null) {
      timezone = computeTimezone(birth_lat, birth_lon);
      if (!timezone) {
        return NextResponse.json(
          { error: "Bad request", message: "Invalid coordinates. Please select a valid birth location." },
          { status: 400 }
        );
      }
    }

    // Attempt profile resolution (silent - never reveals account existence)
    // Uses admin client to bypass RLS for profile lookup
    let resolvedProfileId: string | null = null;

    if (!linked_profile_id) {
      // Only resolve if not explicitly provided
      resolvedProfileId = await resolveProfileFromConnection(admin, user.id, {
        name,
        birth_date: birth_date || null,
        birth_time: birth_time || null,
        birth_city: birth_city || null,
        birth_region: birth_region || null,
        birth_country: birth_country || null,
      });

      if (resolvedProfileId) {
        console.log(`[Connections] Resolved profile ${resolvedProfileId} for connection "${name}"`);
      }
    }

    // Insert new connection with resolved or provided linked_profile_id
    const { data: connection, error } = await supabase
      .from("connections")
      .insert({
        owner_user_id: user.id,
        linked_profile_id: linked_profile_id || resolvedProfileId || null,
        name,
        relationship_type,
        birth_date: birth_date || null,
        birth_time: birth_time || null,
        birth_city: birth_city || null,
        birth_region: birth_region || null,
        birth_country: birth_country || null,
        birth_lat: birth_lat ?? null,
        birth_lon: birth_lon ?? null,
        timezone: timezone,
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

// Fields that require the connection to be unlinked
const BIRTH_LOCATION_FIELDS = [
  "birth_date",
  "birth_time",
  "birth_city",
  "birth_region",
  "birth_country",
  "birth_lat",
  "birth_lon",
] as const;

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
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Bad request", message: "Connection ID is required." },
        { status: 400 }
      );
    }

    // Fetch the existing connection to check linked status
    const { data: existing, error: fetchError } = await supabase
      .from("connections")
      .select("*")
      .eq("id", id)
      .eq("owner_user_id", user.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Not found", message: "Connection not found." },
        { status: 404 }
      );
    }

    // If linked, check if any birth/location fields are being updated
    if (existing.linked_profile_id) {
      const attemptedBirthUpdates = BIRTH_LOCATION_FIELDS.filter(
        (field) => body[field] !== undefined
      );
      if (attemptedBirthUpdates.length > 0) {
        return NextResponse.json(
          {
            error: "Forbidden",
            message:
              "Cannot update birth/location fields for a linked connection. The linked profile is the source of truth.",
          },
          { status: 400 }
        );
      }
    }

    // Build dynamic update object from provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Always-allowed fields
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        return NextResponse.json(
          { error: "Bad request", message: "Name must be a non-empty string." },
          { status: 400 }
        );
      }
      updateData.name = body.name.trim();
    }

    if (body.relationship_type !== undefined) {
      const validTypes = ["Partner", "Child", "Parent", "Sibling", "Friend", "Colleague", "Other"];
      if (!validTypes.includes(body.relationship_type)) {
        return NextResponse.json(
          { error: "Bad request", message: `Invalid relationship type. Must be one of: ${validTypes.join(", ")}` },
          { status: 400 }
        );
      }
      updateData.relationship_type = body.relationship_type;
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes || null;
    }

    // Space Between toggle (always allowed)
    if (body.space_between_enabled !== undefined) {
      updateData.space_between_enabled = Boolean(body.space_between_enabled);
    }

    // Birth/location fields (only for unlinked connections)
    if (!existing.linked_profile_id) {
      if (body.birth_date !== undefined) {
        // Basic ISO date validation
        if (body.birth_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.birth_date)) {
          return NextResponse.json(
            { error: "Bad request", message: "Birth date must be in YYYY-MM-DD format." },
            { status: 400 }
          );
        }
        updateData.birth_date = body.birth_date || null;
      }

      if (body.birth_time !== undefined) {
        // Basic HH:MM validation
        if (body.birth_time && !/^\d{2}:\d{2}$/.test(body.birth_time)) {
          return NextResponse.json(
            { error: "Bad request", message: "Birth time must be in HH:MM format." },
            { status: 400 }
          );
        }
        updateData.birth_time = body.birth_time || null;
      }

      if (body.birth_city !== undefined) {
        updateData.birth_city = body.birth_city || null;
      }

      if (body.birth_region !== undefined) {
        updateData.birth_region = body.birth_region || null;
      }

      if (body.birth_country !== undefined) {
        updateData.birth_country = body.birth_country || null;
      }

      // Handle birth coordinates and compute timezone
      if (body.birth_lat !== undefined || body.birth_lon !== undefined) {
        const lat = body.birth_lat ?? null;
        const lon = body.birth_lon ?? null;

        if (lat !== null && lon !== null) {
          // Both coordinates provided - compute timezone
          const computedTimezone = computeTimezone(lat, lon);
          if (!computedTimezone) {
            return NextResponse.json(
              { error: "Bad request", message: "Invalid coordinates. Please select a valid birth location." },
              { status: 400 }
            );
          }
          updateData.birth_lat = lat;
          updateData.birth_lon = lon;
          updateData.timezone = computedTimezone;
        } else {
          // Clearing coordinates - also clear timezone
          updateData.birth_lat = null;
          updateData.birth_lon = null;
          updateData.timezone = null;
        }
      }

      // Re-attempt linking if birth data changed and still unlinked
      const birthFieldsChanged =
        body.birth_date !== undefined ||
        body.birth_city !== undefined ||
        body.birth_region !== undefined ||
        body.birth_country !== undefined ||
        body.name !== undefined;

      if (birthFieldsChanged) {
        // Build the connection data for matching (use new values if provided, else existing)
        const matchData = {
          name: (body.name !== undefined ? body.name.trim() : existing.name),
          birth_date: (body.birth_date !== undefined ? body.birth_date : existing.birth_date) || null,
          birth_time: (body.birth_time !== undefined ? body.birth_time : existing.birth_time) || null,
          birth_city: (body.birth_city !== undefined ? body.birth_city : existing.birth_city) || null,
          birth_region: (body.birth_region !== undefined ? body.birth_region : existing.birth_region) || null,
          birth_country: (body.birth_country !== undefined ? body.birth_country : existing.birth_country) || null,
        };

        const resolvedProfileId = await resolveProfileFromConnection(admin, user.id, matchData);

        if (resolvedProfileId) {
          console.log(`[Connections] Re-linking: resolved profile ${resolvedProfileId} for connection "${matchData.name}"`);
          updateData.linked_profile_id = resolvedProfileId;
        }
      }
    }

    // Perform update
    const { data: connection, error } = await supabase
      .from("connections")
      .update(updateData)
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
