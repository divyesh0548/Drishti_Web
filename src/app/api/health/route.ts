import { NextResponse } from "next/server";

import { ensureDefaultSiteAdmin } from "@/lib/user-database";

export async function GET() {
  await ensureDefaultSiteAdmin();

  return NextResponse.json({
    status: "ok",
    service: "fingen-ai-portal",
    checkedAt: new Date().toISOString(),
  });
}

