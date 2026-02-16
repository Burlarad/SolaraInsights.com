/**
 * Library Checkouts API
 *
 * DELETE: Remove a single checkout from the user's shelf
 *
 * Body: { book_type: "astrology" | "numerology", book_key: string }
 *
 * RLS on library_checkouts enforces user-only deletes,
 * but we also verify ownership explicitly.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { book_type, book_key } = body as {
      book_type?: string;
      book_key?: string;
    };

    if (!book_type || !book_key) {
      return NextResponse.json(
        { error: "Bad request", message: "book_type and book_key are required." },
        { status: 400 }
      );
    }

    if (book_type !== "astrology" && book_type !== "numerology") {
      return NextResponse.json(
        { error: "Bad request", message: "book_type must be 'astrology' or 'numerology'." },
        { status: 400 }
      );
    }

    // RLS enforces user_id = auth.uid(), but we also filter explicitly
    const { error } = await supabase
      .from("library_checkouts")
      .delete()
      .eq("user_id", user.id)
      .eq("book_type", book_type)
      .eq("book_key", book_key);

    if (error) {
      console.error("[LibraryCheckouts] Delete error:", error);
      return NextResponse.json(
        { error: "Failed to remove book", message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[LibraryCheckouts] Error:", error);
    return NextResponse.json(
      { error: "Internal error", message: "Failed to process request." },
      { status: 500 }
    );
  }
}
