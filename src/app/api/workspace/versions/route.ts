import { NextResponse } from "next/server";

import { requireRequestWorkspaceCompany } from "@/lib/auth";
import { createCompanyVersionFromFormData, deleteCompanyVersion, listCompanyVersions } from "@/lib/company-workspace";
import { parseCompanyId } from "@/lib/company-id";
import { clearTrialBalanceSnapshotCache } from "@/lib/trial-balance";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");

  const context = await requireRequestWorkspaceCompany(request, {
    companyId: companyId ?? undefined,
  });

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  return NextResponse.json({
    versions: listCompanyVersions(context.company.id),
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const companyId = String(formData.get("companyId") ?? "");
  const label = String(formData.get("label") ?? "");
  const financialYear = String(formData.get("financialYear") ?? "");

  if (!companyId) {
    return NextResponse.json({ error: "companyId is required." }, { status: 400 });
  }

  const context = await requireRequestWorkspaceCompany(request, {
    companyId,
  });

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!context.permissions.canUploadTrialBalance) {
    return NextResponse.json({ error: "You do not have permission to create version snapshots." }, { status: 403 });
  }

  try {
    const version = await createCompanyVersionFromFormData({
      companyId: context.company.id,
      label,
      financialYear,
      createdByUserId: context.currentUser.id,
      trialBalanceFile: formData.get("trialBalanceFile") as File | null,
      statementWorkbookFile: formData.get("statementWorkbookFile") as File | null,
    });

    return NextResponse.json({ version });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload trial balance.";
    const status = message.toLowerCase().includes("database") ? 500 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as {
    companyId?: string | number;
    versionId?: string;
  };
  const companyId = parseCompanyId(body.companyId);
  const versionId = body.versionId?.trim();

  if (!companyId || !versionId) {
    return NextResponse.json({ error: "companyId and versionId are required." }, { status: 400 });
  }

  const context = await requireRequestWorkspaceCompany(request, {
    companyId,
  });

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (context.currentUser.role !== "SITE_ADMIN") {
    return NextResponse.json({ error: "Only the site admin can delete a company version." }, { status: 403 });
  }

  try {
    const result = await deleteCompanyVersion({
      companyId: context.company.id,
      versionId,
    });
    clearTrialBalanceSnapshotCache(context.company.id, versionId);

    return NextResponse.json({
      deleted: true,
      defaultVersionId: result.defaultVersionId,
      versions: result.remaining,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete version.";
    const status = message.toLowerCase().includes("database") ? 500 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
