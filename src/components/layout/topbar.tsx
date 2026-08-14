"use client";

import { useEffect, useState } from "react";

import type { Route } from "next";
import {
  Building2,
  CalendarRange,
  Layers3,
  MoonStar,
  Search,
  SunMedium,
} from "lucide-react";
import { useTheme } from "next-themes";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PortalIconButton } from "@/components/ui/portal-button";
import { PortalSelect } from "@/components/ui/portal-select";
import { cn } from "@/lib/utils";

export type WorkspaceContextPayload = {
  company: { id: number; name: string } | null;
  companies: Array<{ id: number; name: string }>;
  currentUser: { id: string; name: string; role: string };
  currentVersion: { id: string; label: string; financialYear: string } | null;
  versions: Array<{ id: string; label: string; financialYear: string }>;
};

function ContextChip({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: typeof Building2;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-3.5 py-2.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur dark:border-white/10 dark:bg-slate-950/70 dark:shadow-[0_8px_24px_rgba(2,6,23,0.25)]",
        className,
      )}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/12 dark:text-blue-300">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{label}</p>
        <div className="mt-0.5 min-w-0">{children}</div>
      </div>
    </div>
  );
}

export function Topbar() {
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [workspace, setWorkspace] = useState<WorkspaceContextPayload | null>(null);
  const [showExploreHeadline, setShowExploreHeadline] = useState(false);
  const [themeReady, setThemeReady] = useState(false);
  const isDashboard = pathname === "/dashboard";
  const workspaceUserId = workspace?.currentUser.id;

  useEffect(() => {
    setThemeReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const query = searchParams.toString();

    fetch(`/api/workspace/context${query ? `?${query}` : ""}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(String(response.status));
        }

        return response.json() as Promise<WorkspaceContextPayload>;
      })
      .then((workspacePayload) => {
        if (!cancelled) {
          setWorkspace(workspacePayload);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setWorkspace(null);

          if (error instanceof Error && error.message === "401") {
            router.replace("/login");
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  useEffect(() => {
    if (!isDashboard || !workspaceUserId) {
      setShowExploreHeadline(false);
      return;
    }

    setShowExploreHeadline(false);
    const timer = window.setTimeout(() => {
      setShowExploreHeadline(true);
    }, 7000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isDashboard, workspaceUserId]);

  const updateSelection = (key: "company" | "version", value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.replace(`${pathname}?${params.toString()}` as Route);
  };

  const greetingName = workspace?.currentUser.name.split(" ")[0] ?? "";

  return (
    <header className="pt-4">
      <div className="enterprise-shell-card relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.16),transparent_55%),radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.1),transparent_45%)] dark:bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.18),transparent_55%),radial-gradient(ellipse_at_top_left,rgba(99,102,241,0.12),transparent_45%)]"
        />

        <div className="relative border-b border-slate-200/70 px-4 py-4 dark:border-white/10 lg:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              {isDashboard && workspace ? (
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/70 bg-blue-50/80 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500 dark:bg-blue-300" />
                    {workspace.company?.name ?? "No company yet"}
                    {workspace.currentVersion ? (
                      <>
                        <span className="text-blue-400 dark:text-blue-400/70">|</span>
                        {workspace.currentVersion.label}
                      </>
                    ) : null}
                  </div>
                  <div className="relative mt-3 h-[2.5rem] sm:h-[2.85rem]">
                    <h2
                      className={cn(
                        "absolute inset-0 font-[var(--font-display)] text-[1.85rem] font-semibold tracking-[-0.04em] text-slate-950 transition-all duration-700 ease-in-out dark:text-slate-50 sm:text-[2.15rem]",
                        showExploreHeadline ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100",
                      )}
                    >
                      Good morning, {greetingName}
                    </h2>
                    <h2
                      aria-hidden={!showExploreHeadline}
                      className={cn(
                        "absolute inset-0 font-[var(--font-display)] text-[1.85rem] font-semibold tracking-[-0.04em] text-slate-950 transition-all duration-700 ease-in-out dark:text-slate-50 sm:text-[2.15rem]",
                        showExploreHeadline ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
                      )}
                    >
                      Explore your dashboard
                    </h2>
                  </div>
                  <p className="mt-1 max-w-xl text-sm text-slate-500 dark:text-slate-400">
                    Review mappings, statements, and workspace controls from one place.
                  </p>
                </div>
              ) : (
                <div className="min-w-0">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-blue-600 dark:text-blue-300">Workspace</p>
                  <h2 className="mt-1 font-[var(--font-display)] text-[1.55rem] font-semibold tracking-[-0.03em] text-slate-950 dark:text-slate-50">
                    {workspace?.company?.name ?? "Drishti portal"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {workspace?.currentVersion
                      ? `${workspace.currentVersion.label} · FY ${workspace.currentVersion.financialYear}`
                      : workspace
                        ? "Upload a trial balance to create the first version"
                        : "Loading company context..."}
                  </p>
                </div>
              )}
            </div>

            <div className="flex w-full items-center gap-3 lg:w-auto lg:justify-end">
              <label className="relative min-w-0 flex-1 lg:w-[340px] lg:flex-none">
                <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="field-input field-input-compact field-input-icon-left h-11 rounded-2xl border-slate-200/80 bg-white/90 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] placeholder:text-slate-400 dark:border-white/10 dark:bg-slate-950/80"
                  placeholder="Search workspaces and reports"
                />
              </label>
              <PortalIconButton
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
                sx={{
                  height: 44,
                  width: 44,
                  flexShrink: 0,
                  borderRadius: "1rem",
                  boxShadow: "0 8px 20px rgba(15,23,42,0.06)",
                }}
              >
                {themeReady ? (
                  resolvedTheme === "dark" ? (
                    <SunMedium className="h-4.5 w-4.5" />
                  ) : (
                    <MoonStar className="h-4.5 w-4.5" />
                  )
                ) : (
                  <span className="h-4.5 w-4.5" aria-hidden />
                )}
              </PortalIconButton>
            </div>
          </div>
        </div>

        <div className="relative bg-slate-50/55 px-4 py-3.5 dark:bg-slate-950/40 lg:px-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {workspace ? (
              <>
                {workspace.currentUser.role === "SITE_ADMIN" ? (
                  <ContextChip icon={Building2} label="Company">
                    {workspace.companies.length > 0 && workspace.company ? (
                      <PortalSelect
                        id="workspace-company"
                        value={String(workspace.company.id)}
                        onChange={(value) => updateSelection("company", value)}
                        options={workspace.companies.map((company) => ({
                          value: String(company.id),
                          label: company.name,
                        }))}
                        sx={{
                          minWidth: 0,
                          "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                          "& .MuiSelect-select": {
                            px: 0,
                            py: 0,
                            fontWeight: 600,
                            fontSize: "0.875rem",
                          },
                          bgcolor: "transparent",
                        }}
                      />
                    ) : (
                      <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">No company yet</p>
                    )}
                  </ContextChip>
                ) : (
                  <ContextChip icon={Building2} label="Company">
                    <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{workspace.company?.name ?? "No company"}</p>
                  </ContextChip>
                )}

                <ContextChip icon={Layers3} label="Version">
                  {workspace.currentVersion ? (
                    <PortalSelect
                      id="workspace-version"
                      value={workspace.currentVersion.id}
                      onChange={(value) => updateSelection("version", value)}
                      options={workspace.versions.map((version) => ({
                        value: version.id,
                        label: `${version.label} | ${version.financialYear}`,
                      }))}
                      sx={{
                        minWidth: 0,
                        "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                        "& .MuiSelect-select": {
                          px: 0,
                          py: 0,
                          fontWeight: 600,
                          fontSize: "0.875rem",
                        },
                        bgcolor: "transparent",
                      }}
                    />
                  ) : (
                    <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">No version</p>
                  )}
                </ContextChip>

                <ContextChip icon={CalendarRange} label="Financial Year" className="md:col-span-2 xl:col-span-1">
                  <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
                    {workspace.currentVersion?.financialYear ?? "—"}
                  </p>
                </ContextChip>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200/80 px-4 py-3 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400 md:col-span-2 xl:col-span-3">
                Loading workspace filters...
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
