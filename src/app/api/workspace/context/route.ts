import { NextResponse } from "next/server";

import { requireRequestWorkspaceState } from "@/lib/auth";
import { getWorkspaceSelection } from "@/lib/portal-context";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const context = await requireRequestWorkspaceState(request, getWorkspaceSelection(searchParams));

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  return NextResponse.json(context, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
