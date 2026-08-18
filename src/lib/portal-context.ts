import { redirect } from "next/navigation";

import { companyHasMasterGrouping } from "@/lib/grouping-database";
import { requireWorkspaceContext } from "@/lib/auth";
import { companyIdToParam, parseCompanyId } from "@/lib/company-id";
import type { ActiveWorkspaceContext, CompanyWorkspaceContext, WorkspaceContext } from "@/lib/company-workspace";
import { canAccessRoute } from "@/lib/navigation";

export type WorkspaceSelection = {
  companyId?: number;
  versionId?: string;
};

type SearchParamsInput =
  | Record<string, string | string[] | undefined>
  | URLSearchParams
  | undefined;

function readValue(input: SearchParamsInput, key: string) {
  if (!input) {
    return undefined;
  }

  if (input instanceof URLSearchParams) {
    return input.get(key) ?? undefined;
  }

  const value = input[key];
  return Array.isArray(value) ? value[0] : value;
}

export function getWorkspaceSelection(input?: SearchParamsInput): WorkspaceSelection {
  return {
    companyId: parseCompanyId(readValue(input, "company")),
    versionId: readValue(input, "version"),
  };
}

export async function resolveWorkspaceContextFromSearchParams(input?: SearchParamsInput): Promise<ActiveWorkspaceContext> {
  const context = await requireWorkspaceContext(getWorkspaceSelection(input));

  if (!context.company) {
    redirect(context.currentUser.role === "SITE_ADMIN" ? "/admin" : "/login");
  }

  if (!context.currentVersion) {
    if (canAccessRoute(context.currentUser.role, "/import-center")) {
      redirect(`/import-center?company=${context.company.id}`);
    }

    redirect(`/dashboard?company=${context.company.id}`);
  }

  if (!(await companyHasMasterGrouping(context.company.id))) {
    if (canAccessRoute(context.currentUser.role, "/import-center")) {
      redirect(`/import-center?company=${context.company.id}`);
    }

    redirect(`/dashboard?company=${context.company.id}`);
  }

  return context as ActiveWorkspaceContext;
}

export async function resolveWorkspaceCompanyFromSearchParams(input?: SearchParamsInput): Promise<CompanyWorkspaceContext> {
  const context = await requireWorkspaceContext(getWorkspaceSelection(input));

  if (!context.company) {
    redirect(context.currentUser.role === "SITE_ADMIN" ? "/admin" : "/login");
  }

  return context as CompanyWorkspaceContext;
}

export async function resolveOptionalWorkspaceContextFromSearchParams(input?: SearchParamsInput): Promise<WorkspaceContext> {
  return requireWorkspaceContext(getWorkspaceSelection(input));
}

export function buildWorkspaceQuery(selection: WorkspaceSelection) {
  const params = new URLSearchParams();

  if (selection.companyId) {
    params.set("company", companyIdToParam(selection.companyId));
  }

  if (selection.versionId) {
    params.set("version", selection.versionId);
  }

  return params.toString();
}
