import { NextResponse } from "next/server";

import { requireRequestWorkspaceContext } from "@/lib/auth";
import { createCompanyVersionFromFormData, listCompanyVersions } from "@/lib/company-workspace";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");

  const context = requireRequestWorkspaceContext(request, {
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

  const context = requireRequestWorkspaceContext(request, {
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
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
