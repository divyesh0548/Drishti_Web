import { NextResponse } from "next/server";

import { requireRequestUser, requireRequestWorkspaceState } from "@/lib/auth";
import { createCompany, listCompanies, updateCompanyExcelProfile } from "@/lib/company-workspace";
import { isRegisteredExcelProfileId } from "@/lib/export/excel/profile-options";

export async function GET(request: Request) {
  const context = await requireRequestWorkspaceState(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const companies = await listCompanies();

  return NextResponse.json({
    companies: context.currentUser.role === "SITE_ADMIN" ? companies : companies.filter((company) => company.id === context.currentUser.companyId),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    code?: string;
    adminName?: string;
    adminEmail?: string;
  };

  const user = await requireRequestUser(request);

  if (!user || user.tempLogin) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (user.role !== "SITE_ADMIN") {
    return NextResponse.json({ error: "Only the site admin can create companies." }, { status: 403 });
  }

  if (!body.name || !body.code || !body.adminName || !body.adminEmail) {
    return NextResponse.json({ error: "Company name, code, admin name, and admin email are required." }, { status: 400 });
  }

  try {
    const company = await createCompany({
      name: body.name,
      code: body.code,
      adminName: body.adminName,
      adminEmail: body.adminEmail,
    });

    return NextResponse.json({ company });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create company.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const body = (await request.json()) as {
    companyId?: number | string;
    excelProfileId?: string | null;
  };

  const user = await requireRequestUser(request);

  if (!user || user.tempLogin) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (user.role !== "SITE_ADMIN") {
    return NextResponse.json({ error: "Only the site admin can map Excel structure profiles." }, { status: 403 });
  }

  const companyId = typeof body.companyId === "number" ? body.companyId : Number(body.companyId);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    return NextResponse.json({ error: "companyId is required." }, { status: 400 });
  }

  const excelProfileId = body.excelProfileId?.trim() || null;
  if (!isRegisteredExcelProfileId(excelProfileId)) {
    return NextResponse.json({ error: "Unknown Excel structure profile." }, { status: 400 });
  }

  try {
    const company = await updateCompanyExcelProfile(companyId, excelProfileId);
    return NextResponse.json({ company });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update Excel profile mapping.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
