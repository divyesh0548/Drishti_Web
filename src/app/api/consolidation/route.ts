import { NextResponse } from "next/server";

import { requireRequestWorkspaceContext } from "@/lib/auth";
import { parseCompanyId } from "@/lib/company-id";
import { buildConsolidationSnapshot, getConsolidationConfig, saveConsolidationConfig } from "@/lib/consolidation";
import { getWorkspaceSelection } from "@/lib/portal-context";

function toNumber(value: number | string | undefined) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    return normalized ? Number(normalized) || 0 : 0;
  }

  return 0;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const context = await requireRequestWorkspaceContext(request, getWorkspaceSelection(searchParams));

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const scope = {
    companyId: context.company.id,
    versionId: context.currentVersion.id,
  };

  return NextResponse.json(
    {
      config: getConsolidationConfig(scope),
      snapshot: await buildConsolidationSnapshot(scope),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    companyId?: string | number;
    versionId?: string;
    members?: Array<{ companyId?: string | number; versionId?: string }>;
    eliminations?: Array<{
      id?: string;
      fromCompanyId?: string | number;
      toCompanyId?: string | number;
      description?: string;
      statementArea?: string;
      noteNumber?: string;
      lineItem?: string;
      direction?: string;
      currentAmount?: number | string;
      previousAmount?: number | string;
      active?: boolean;
    }>;
  };

  const context = await requireRequestWorkspaceContext(request, {
    companyId: body.companyId,
    versionId: body.versionId,
  });

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!context.permissions.canManageConsolidation) {
    return NextResponse.json({ error: "You do not have permission to manage consolidation." }, { status: 403 });
  }

  const scope = {
    companyId: context.company.id,
    versionId: context.currentVersion.id,
  };

  const config = saveConsolidationConfig(
    {
      members: (body.members ?? []).flatMap((member) => {
        const companyId = parseCompanyId(member.companyId);
        return companyId ? [{ companyId, versionId: member.versionId }] : [];
      }),
      eliminations: (body.eliminations ?? []).map((entry) => ({
        id: entry.id,
        fromCompanyId: parseCompanyId(entry.fromCompanyId),
        toCompanyId: parseCompanyId(entry.toCompanyId),
        description: entry.description,
        statementArea: entry.statementArea === "profit-and-loss" ? "profit-and-loss" : "balance-sheet",
        noteNumber: entry.noteNumber,
        lineItem: entry.lineItem,
        direction: entry.direction === "increase" ? "increase" : "decrease",
        currentAmount: toNumber(entry.currentAmount),
        previousAmount: toNumber(entry.previousAmount),
        active: entry.active,
      })),
    },
    scope,
  );

  return NextResponse.json({
    config,
    snapshot: await buildConsolidationSnapshot(scope),
  });
}
