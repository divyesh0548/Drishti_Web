import { NextResponse } from "next/server";

import { requireRequestWorkspaceContext } from "@/lib/auth";
import { readRatioLedgerConfig, saveRatioLedgerSelection } from "@/lib/ratio-ledger-config";

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
    config: readRatioLedgerConfig({
      companyId: context.company.id,
      versionId: context.currentVersion.id,
    }),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    companyId?: string;
    versionId?: string;
    ratioId?: string;
    excludedGlNumbers?: string[];
  };

  if (!body.ratioId) {
    return NextResponse.json({ error: "ratioId is required." }, { status: 400 });
  }

  const context = await requireRequestWorkspaceContext(request, {
    companyId: body.companyId,
    versionId: body.versionId,
  });

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!context.permissions.canManageGrouping) {
    return NextResponse.json({ error: "You do not have permission to update ratio ledger selections." }, { status: 403 });
  }

  const selection = saveRatioLedgerSelection(
    {
      ratioId: body.ratioId,
      excludedGlNumbers: Array.isArray(body.excludedGlNumbers) ? body.excludedGlNumbers : [],
    },
    {
      companyId: context.company.id,
      versionId: context.currentVersion.id,
    },
  );

  return NextResponse.json({ selection });
}
