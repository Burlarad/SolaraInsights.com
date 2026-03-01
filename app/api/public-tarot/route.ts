/**
 * DEPRECATED — this endpoint has been renamed.
 *
 * Use POST /api/tarot instead.
 *
 * Returns 410 Gone so callers update their URLs immediately
 * rather than silently following a redirect.
 */
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Gone",
      errorCode: "ENDPOINT_GONE",
      message: "This endpoint has been retired. Use POST /api/tarot instead.",
    },
    { status: 410 }
  );
}
