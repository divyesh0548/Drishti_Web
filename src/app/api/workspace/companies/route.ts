import { NextResponse } from "next/server";

import { requireRequestWorkspaceContext } from "@/lib/auth";
import { createCompany, listCompanies } from "@/lib/company-workspace";

export async function GET(request: Request) {
  const context = requireRequestWorkspaceContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  return NextResponse.json({
    companies: context.currentUser.role === "SITE_ADMIN" ? listCompanies() : [context.company],
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    code?: string;
    adminName?: string;
    adminEmail?: string;
    adminPassword?: string;
  };

  const context = requireRequestWorkspaceContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!context.permissions.canManageCompanies) {
    return NextResponse.json({ error: "Only the site admin can create companies." }, { status: 403 });
  }

  if (!body.name || !body.code || !body.adminName || !body.adminEmail || !body.adminPassword) {
    return NextResponse.json({ error: "Company name, code, admin name, admin username, and password are required." }, { status: 400 });
  }

  try {
    const company = createCompany({
      name: body.name,
      code: body.code,
      adminName: body.adminName,
      adminEmail: body.adminEmail,
      adminPassword: body.adminPassword,
    });

    return NextResponse.json({ company });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create company.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
