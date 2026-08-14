import { NextResponse } from "next/server";

import { requireRequestWorkspaceContext } from "@/lib/auth";
import { readAgeingStore, saveAgeingGroups, type AgeingGroup } from "@/lib/ageing";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const context = await requireRequestWorkspaceContext(request, {
    companyId: searchParams.get("companyId") ?? undefined,
    versionId: searchParams.get("versionId") ?? undefined,
  });

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  return NextResponse.json({
    store: readAgeingStore({
      companyId: context.company.id,
      versionId: context.currentVersion.id,
    }),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    companyId?: string;
    versionId?: string;
    asOfDate?: string;
    ageGroups?: AgeingGroup[];
  };

  const context = await requireRequestWorkspaceContext(request, {
    companyId: body.companyId,
    versionId: body.versionId,
  });

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!context.permissions.canManageGrouping) {
    return NextResponse.json({ error: "You do not have permission to update ageing logic." }, { status: 403 });
  }

  if (!body.asOfDate || !Array.isArray(body.ageGroups) || body.ageGroups.length === 0) {
    return NextResponse.json({ error: "asOfDate and ageGroups are required." }, { status: 400 });
  }

  const store = saveAgeingGroups(
    {
      asOfDate: body.asOfDate,
      ageGroups: body.ageGroups,
    },
    {
      companyId: context.company.id,
      versionId: context.currentVersion.id,
    },
  );

  return NextResponse.json({ store });
}
