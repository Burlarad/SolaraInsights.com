import { NextRequest, NextResponse } from "next/server";

/**
 * Dev-only endpoint for testing birth chart generation.
 *
 * Security:
 * - In production: Returns 404 (does not advertise existence)
 * - In development: Requires x-dev-secret header matching DEV_TEST_SECRET env var
 */
export async function GET(req: NextRequest) {
  // In production, return 404 to not advertise this endpoint exists
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }

  // In development, require secret header
  const devSecret = req.headers.get("x-dev-secret");
  const expectedSecret = process.env.DEV_TEST_SECRET;

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "DEV_TEST_SECRET not configured" },
      { status: 500 }
    );
  }

  if (!devSecret || devSecret !== expectedSecret) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Endpoint is currently disabled
  return NextResponse.json(
    {
      error: "Not implemented",
      message: "Dev birth chart testing endpoint is disabled while we rebuild the birth chart engine.",
    },
    { status: 501 }
  );
}
