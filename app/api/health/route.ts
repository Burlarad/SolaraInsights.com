import { NextResponse } from "next/server";

/**
 * Health check endpoint for Render monitoring.
 * Returns 200 OK with basic status info.
 */
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "unknown",
  });
}
