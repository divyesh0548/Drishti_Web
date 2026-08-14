import { NextResponse } from "next/server";

import { requireRequestWorkspaceCompany } from "@/lib/auth";
import { getCompanySettings, updateCompanySettings } from "@/lib/company-workspace";

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
    settings: getCompanySettings(context.company.id),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    companyId?: string;
    reportingCurrency?: string;
    unitsLabel?: string;
    footerNote?: string;
    directors?: Array<{ name?: string; designation?: string }>;
    auditors?: Array<{ name?: string; designation?: string; firmName?: string; membershipNumber?: string }>;
  };

  if (!body.companyId) {
    return NextResponse.json({ error: "companyId is required." }, { status: 400 });
  }

  const context = await requireRequestWorkspaceCompany(request, {
    companyId: body.companyId,
  });

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!context.permissions.canEditSignatories) {
    return NextResponse.json({ error: "You do not have permission to update company settings." }, { status: 403 });
  }

  const existing = getCompanySettings(context.company.id);

  const settings = updateCompanySettings(context.company.id, {
    reportingCurrency: body.reportingCurrency?.trim() || "INR",
    unitsLabel: body.unitsLabel?.trim() || "(Rs. in lakhs)",
    footerNote: body.footerNote?.trim() || "",
    // Excel profile is mapped by site admin only.
    excelProfileId: existing.excelProfileId,
    directors: (body.directors ?? [])
      .filter((entry) => entry.name && entry.designation)
      .map((entry) => ({
        name: entry.name!.trim(),
        designation: entry.designation!.trim(),
      })),
    auditors: (body.auditors ?? [])
      .filter((entry) => entry.name && entry.designation)
      .map((entry) => ({
        name: entry.name!.trim(),
        designation: entry.designation!.trim(),
        firmName: entry.firmName?.trim() || undefined,
        membershipNumber: entry.membershipNumber?.trim() || undefined,
      })),
  });

  return NextResponse.json({ settings });
}
