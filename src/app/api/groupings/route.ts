import {
  deleteLedgerGroupingOverride,
  getLedgerGroupingOptions,
  getLedgerGroupingOverrideList,
  getLedgerSubgroupOptions,
  saveLedgerGroupingOverride,
} from "@/lib/ledger-groupings";
import { requireRequestWorkspaceContext } from "@/lib/auth";
import { companyHasMasterGrouping, MASTER_GROUPING_REQUIRED_ERROR } from "@/lib/grouping-database";
import { NextResponse } from "next/server";

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
    options: await getLedgerGroupingOptions({ companyId: context.company.id, versionId: context.currentVersion.id }),
    subgroupOptions: getLedgerSubgroupOptions({ companyId: context.company.id, versionId: context.currentVersion.id }),
    overrides: await getLedgerGroupingOverrideList({ companyId: context.company.id, versionId: context.currentVersion.id }),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    companyId?: string;
    versionId?: string;
    glNumber?: string;
    glDescription?: string;
    groupKey?: string;
    subgroupKey?: string;
    notes?: string;
  };

  if (!body.glNumber || !body.glDescription || !body.groupKey) {
    return NextResponse.json({ error: "glNumber, glDescription, and groupKey are required." }, { status: 400 });
  }

  try {
    const context = await requireRequestWorkspaceContext(request, {
      companyId: body.companyId,
      versionId: body.versionId,
    });

    if (!context) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    if (!context.permissions.canManageGrouping) {
      return NextResponse.json({ error: "You do not have permission to change ledger grouping." }, { status: 403 });
    }

    if (!(await companyHasMasterGrouping(context.company.id))) {
      return NextResponse.json({ error: MASTER_GROUPING_REQUIRED_ERROR }, { status: 409 });
    }

    const override = await saveLedgerGroupingOverride({
      glNumber: body.glNumber,
      glDescription: body.glDescription,
      groupKey: body.groupKey,
      subgroupKey: body.subgroupKey,
      notes: body.notes,
    }, {
      companyId: context.company.id,
      versionId: context.currentVersion.id,
    });

    return NextResponse.json({ override });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to save grouping override.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as {
    companyId?: string;
    versionId?: string;
    glNumber?: string;
  };

  if (!body.glNumber) {
    return NextResponse.json({ error: "glNumber is required." }, { status: 400 });
  }

  const context = await requireRequestWorkspaceContext(request, {
    companyId: body.companyId,
    versionId: body.versionId,
  });

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!context.permissions.canManageGrouping) {
    return NextResponse.json({ error: "You do not have permission to change ledger grouping." }, { status: 403 });
  }

  return NextResponse.json({
    deleted: await deleteLedgerGroupingOverride(body.glNumber, {
      companyId: context.company.id,
      versionId: context.currentVersion.id,
    }),
  });
}
