"use client";

import { useState } from "react";
import type { Route } from "next";
import type { WorkspaceUser } from "@/lib/company-workspace";
import { getNavigationForRole } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Blocks, Building2, ChartNoAxesCombined, ChartPie, ChevronLeft, ChevronRight, Combine, FileSpreadsheet, FileText, GitBranch, LayoutDashboard, LogOut, ReceiptText, Settings2, Users2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const iconMap: Record<string, typeof LayoutDashboard> = {
  "/dashboard": LayoutDashboard,
  "/clients": Users2,
  "/import-center": FileSpreadsheet,
  "/fixed-assets": Building2,
  "/mapping-studio": GitBranch,
  "/ageing": ReceiptText,
  "/consolidation": Combine,
  "/ratio-analysis": ChartPie,
  "/statements": FileText,
  "/workflow": Blocks,
  "/reports": ChartNoAxesCombined,
  "/admin": Settings2,
} as const;

const groupedRoutes = [
  {
    label: "Dashboard",
    matches: ["/dashboard"],
  },
  {
    label: "Operations",
    matches: ["/clients", "/import-center", "/mapping-studio", "/ageing", "/consolidation"],
  },
  {
    label: "Fixed Assets",
    matches: ["/fixed-assets"],
  },
  {
    label: "Financial Statements",
    matches: ["/ratio-analysis", "/statements", "/workflow"],
  },
  {
    label: "Reports",
    matches: ["/reports"],
  },
  {
    label: "Administration",
    matches: ["/admin"],
  },
] as const;

function WorkspaceLink({
  href,
  title,
  badge,
  active,
  collapsed,
  queryString,
}: {
  href: string;
  title: string;
  badge?: string;
  active: boolean;
  collapsed: boolean;
  queryString: string;
}) {
  const Icon = iconMap[href] ?? LayoutDashboard;

  return (
    <Link
      href={(queryString ? `${href}?${queryString}` : href) as Route}
      aria-current={active ? "page" : undefined}
      className={cn(
        "portal-sidebar-link flex items-center gap-3 px-3 py-2.5 text-sm font-medium",
        collapsed ? "justify-center px-2" : "justify-between",
        active ? "portal-sidebar-link-active" : "",
      )}
      title={collapsed ? title : undefined}
    >
      <span className="flex items-center gap-3">
        <span className={cn("grid h-8 w-8 place-items-center rounded-xl", active ? "portal-sidebar-icon-active" : "portal-sidebar-icon")}>
          <Icon className="h-4.5 w-4.5" />
        </span>
        {!collapsed ? <span>{title}</span> : null}
      </span>
      {!collapsed && badge ? (
        <span className={cn("portal-sidebar-badge px-2 py-0.5 text-[0.7rem] font-semibold", active ? "portal-sidebar-badge-active" : "")}>
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export function Sidebar({
  currentUser,
  collapsed,
  onToggleCollapse,
}: {
  currentUser: WorkspaceUser;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const visibleNavigation = getNavigationForRole(currentUser.role);
  const [profileOpen, setProfileOpen] = useState(false);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  return (
    <aside
      className={cn(
        "portal-sidebar hidden h-screen min-h-0 flex-col overflow-hidden px-3 py-4 lg:flex",
        collapsed ? "w-[108px]" : "w-[320px]",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center gap-3 pb-4",
          collapsed ? "justify-center" : "justify-between",
        )}
        style={{ borderBottom: "1px solid var(--sidebar-border)" }}
      >
        {!collapsed ? (
          <div className="min-w-0">
            <p className="portal-sidebar-title font-[var(--font-display)] text-[1.45rem] font-semibold tracking-[-0.03em]">Drishti</p>
            <p className="portal-sidebar-muted text-sm">Trial balance intelligence</p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onToggleCollapse}
          className="portal-sidebar-toggle grid h-10 w-10 shrink-0 place-items-center rounded-xl transition"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="portal-sidebar-scroll mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden pr-1">
        {groupedRoutes.map((group) => {
          const links = visibleNavigation.filter((item) => group.matches.some((match) => match === item.href));

          if (links.length === 0) {
            return null;
          }

          return (
            <div key={group.label}>
              {!collapsed ? (
                <p className="portal-sidebar-muted mb-2 px-2 text-[0.68rem] font-semibold uppercase tracking-[0.08em]">{group.label}</p>
              ) : null}
              <div className="space-y-1">
                {links.map((item) => (
                  <WorkspaceLink
                    key={item.href}
                    href={item.href}
                    title={item.title}
                    badge={item.badge}
                    active={pathname === item.href}
                    collapsed={collapsed}
                    queryString={queryString}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className={cn("portal-sidebar-profile mt-4 shrink-0 rounded-[1.35rem] p-3", collapsed && "px-3 py-3")}>
        <button
          type="button"
          onClick={() => setProfileOpen((current) => !current)}
          className={cn("flex w-full items-center gap-3 text-left", collapsed && "justify-center")}
        >
          <div className="portal-sidebar-avatar grid h-10 w-10 place-items-center rounded-2xl text-sm font-semibold">
            {currentUser.name
              .split(" ")
              .slice(0, 2)
              .map((part) => part.charAt(0).toUpperCase())
              .join("")}
          </div>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="portal-sidebar-title truncate font-semibold">{currentUser.name}</p>
              <p className="portal-sidebar-muted text-xs">{currentUser.role.replace("_", " ")}</p>
            </div>
          ) : null}
        </button>

        {!collapsed && profileOpen ? (
          <div className="portal-sidebar-divider mt-3 pt-3">
            <button
              type="button"
              onClick={signOut}
              className="portal-button-secondary inline-flex w-full items-center justify-center gap-2 px-4 py-2 text-sm font-medium"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
