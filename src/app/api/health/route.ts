import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "fingen-ai-portal",
    checkedAt: new Date().toISOString(),
  });
}

