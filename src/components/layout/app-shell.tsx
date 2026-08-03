"use client";

import { useState } from "react";

import type { WorkspaceUser } from "@/lib/company-workspace";
import { Sidebar } from "@/components/layout/sidebar";
import { TopbarAiDrawer } from "@/components/layout/topbar-ai-drawer";
import { Topbar } from "@/components/layout/topbar";

export function AppShell({
  children,
  currentUser,
}: {
  children: React.ReactNode;
  currentUser: WorkspaceUser;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="h-screen overflow-hidden text-slate-950 dark:text-slate-50">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-0 top-0 h-[32rem] w-[32rem] rounded-full bg-blue-200/35 blur-3xl dark:bg-blue-500/10" />
        <div className="absolute bottom-0 right-0 h-[26rem] w-[26rem] rounded-full bg-indigo-200/40 blur-3xl dark:bg-indigo-500/10" />
      </div>

      <div className="grid h-screen w-full grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)]">
        <Sidebar
          currentUser={currentUser}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
        />
        <div className="flex h-screen min-h-0 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="w-full px-4 lg:px-6" style={{ maxWidth: sidebarCollapsed ? "1932px" : "1720px" }}>
              <Topbar />
              <main className="pb-8 pt-5 lg:pb-10">{children}</main>
            </div>
          </div>
        </div>
      </div>
      <TopbarAiDrawer />
    </div>
  );
}
