import type { Route } from "next";
import { redirect } from "next/navigation";

import type { WorkspaceUserRole } from "@/lib/company-workspace";

export type NavItem = {
  title: string;
  href: Route;
  badge?: string;
  roles: WorkspaceUserRole[];
};

export const navigation: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", roles: ["SITE_ADMIN", "COMPANY_ADMIN", "FINANCE", "AUDITOR"] },
  { title: "Imports", href: "/import-center", roles: ["SITE_ADMIN", "COMPANY_ADMIN", "FINANCE"] },
  { title: "Fixed Assets", href: "/fixed-assets", badge: "Premium", roles: ["SITE_ADMIN", "COMPANY_ADMIN", "FINANCE", "AUDITOR"] },
  { title: "Mapping", href: "/mapping-studio", roles: ["SITE_ADMIN", "COMPANY_ADMIN", "FINANCE"] },
  { title: "Ageing", href: "/ageing", roles: ["SITE_ADMIN", "COMPANY_ADMIN", "FINANCE", "AUDITOR"] },
  { title: "Consolidation", href: "/consolidation", roles: ["SITE_ADMIN", "COMPANY_ADMIN", "FINANCE", "AUDITOR"] },
  { title: "Ratio Analysis", href: "/ratio-analysis", roles: ["SITE_ADMIN", "COMPANY_ADMIN", "FINANCE", "AUDITOR"] },
  { title: "Financial Statements", href: "/statements", roles: ["SITE_ADMIN", "COMPANY_ADMIN", "FINANCE", "AUDITOR"] },
  { title: "Workflow", href: "/workflow", roles: ["SITE_ADMIN", "COMPANY_ADMIN", "FINANCE", "AUDITOR"] },
  { title: "Reports", href: "/reports", roles: ["SITE_ADMIN", "COMPANY_ADMIN", "FINANCE", "AUDITOR"] },
  { title: "Administration", href: "/admin", roles: ["SITE_ADMIN", "COMPANY_ADMIN"] },
];

export function getNavigationForRole(role: WorkspaceUserRole) {
  return navigation.filter((item) => item.roles.includes(role));
}

export function canAccessRoute(role: WorkspaceUserRole, href: Route) {
  return navigation.find((item) => item.href === href)?.roles.includes(role) ?? false;
}

export function assertRouteAccess(role: WorkspaceUserRole, href: Route) {
  if (!canAccessRoute(role, href)) {
    redirect("/dashboard");
  }
}
