import { NextResponse } from "next/server";

import { requireRequestWorkspaceCompany } from "@/lib/auth";
import { createCompanyUser, listCompanyUsers, type WorkspaceUserRole } from "@/lib/company-workspace";

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
    users: await listCompanyUsers(context.company.id),
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    companyId?: string;
    name?: string;
    email?: string;
    role?: WorkspaceUserRole;
    password?: string;
  };

  if (!body.companyId || !body.name || !body.email || !body.role || body.role === "SITE_ADMIN") {
    return NextResponse.json({ error: "companyId, name, email, and a company role are required." }, { status: 400 });
  }

  const context = await requireRequestWorkspaceCompany(request, {
    companyId: body.companyId,
  });

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!context.permissions.canManageCompanyUsers) {
    return NextResponse.json({ error: "You do not have permission to create company users." }, { status: 403 });
  }

  try {
    const user = await createCompanyUser({
      companyId: context.company.id,
      name: body.name,
      email: body.email,
      role: body.role,
      password: body.password,
    });

    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create user.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
