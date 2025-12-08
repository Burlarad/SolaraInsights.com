import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "Not implemented",
      message: "Dev birth chart testing endpoint is disabled while we rebuild the birth chart engine.",
    },
    { status: 501 },
  );
}
