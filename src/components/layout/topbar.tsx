"use client";

import { useEffect, useState } from "react";

import type { Route } from "next";
import {
  ChevronDown,
  MoonStar,
  Search,
  SunMedium,
} from "lucide-react";
import { useTheme } from "next-themes";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type WorkspaceContextPayload = {
  company: { id: string; name: string };
  companies: Array<{ id: string; name: string }>;
  currentUser: { id: string; name: string; role: string };
  currentVersion: { id: string; label: string; financialYear: string };
  versions: Array<{ id: string; label: string; financialYear: string }>;
};

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
      <div className="enterprise-shell-card overflow-hidden">
        <div className="border-b border-slate-200/70 bg-gradient-to-r from-white via-white to-blue-50/60 px-4 py-3 dark:border-white/10 dark:from-slate-950 dark:via-slate-950 dark:to-blue-950/25 lg:px-5">
          <div className="flex items-center justify-between gap-3">
            <label className="relative w-full max-w-[320px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="field-input field-input-icon-left text-sm placeholder:text-slate-400"
                placeholder="Search workspaces and reports"
              />
            </label>
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:text-blue-700 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100"
              aria-label="Toggle theme"
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
            </button>
          </div>
        </div>

        {isDashboard && workspace ? (
          <div className="border-t border-slate-200/70 bg-gradient-to-r from-white/90 via-blue-50/50 to-white/90 px-4 py-6 dark:border-white/10 dark:from-slate-950/90 dark:via-blue-950/15 dark:to-slate-950/90 lg:px-5">
            <div className="min-w-0">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-blue-600 dark:text-blue-300">
                {workspace.company.name} | {workspace.currentVersion.label}
              </p>
              <div className="relative mt-3 h-[2.6rem] sm:h-[2.9rem]">
                <h2
                  className={cn(
                    "absolute inset-0 font-[var(--font-display)] text-[2rem] font-semibold tracking-[-0.04em] text-slate-950 transition-all duration-700 ease-in-out dark:text-slate-50 sm:text-[2.3rem]",
                    showExploreHeadline ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100",
                  )}
                >
                  Good morning, {greetingName}
                </h2>
                <h2
                  aria-hidden={!showExploreHeadline}
                  className={cn(
                    "absolute inset-0 font-[var(--font-display)] text-[2rem] font-semibold tracking-[-0.04em] text-slate-950 transition-all duration-700 ease-in-out dark:text-slate-50 sm:text-[2.3rem]",
                    showExploreHeadline ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
                  )}
                >
                  Explore your dashboard
                </h2>
              </div>
            </div>
          </div>
        ) : null}

        <div className="border-t border-slate-200/70 bg-white/90 px-4 py-3 dark:border-white/10 dark:bg-slate-950/80 lg:px-5">
          <div className="flex w-fit max-w-full flex-wrap items-start gap-x-5 gap-y-3">
            {workspace ? (
              <>
                {workspace.currentUser.role === "SITE_ADMIN" ? (
                  <label className="w-[260px] min-w-0 border-slate-200 pr-5 dark:border-white/10 md:border-r">
                    <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Company</span>
                    <span className="relative mt-1 block min-w-0">
                      <select
                        value={workspace.company.id}
                        onChange={(event) => updateSelection("company", event.target.value)}
                        className="w-full appearance-none bg-transparent py-0.5 pr-6 text-sm font-semibold text-slate-950 outline-none transition hover:text-blue-700 focus:text-blue-700 dark:text-slate-50 dark:hover:text-blue-300 dark:focus:text-blue-300"
                      >
                        {workspace.companies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    </span>
                  </label>
                ) : (
                  <div className="w-[260px] min-w-0 border-slate-200 pr-5 dark:border-white/10 md:border-r">
                    <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Company</span>
                    <span className="mt-1 block truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{workspace.company.name}</span>
                  </div>
                )}

                <label className="w-[310px] min-w-0 border-slate-200 pr-5 dark:border-white/10 md:border-r">
                  <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Version</span>
                  <span className="relative mt-1 block min-w-0">
                    <select
                      value={workspace.currentVersion.id}
                      onChange={(event) => updateSelection("version", event.target.value)}
                      className="w-full appearance-none bg-transparent py-0.5 pr-6 text-sm font-semibold text-slate-950 outline-none transition hover:text-blue-700 focus:text-blue-700 dark:text-slate-50 dark:hover:text-blue-300 dark:focus:text-blue-300"
                    >
                      {workspace.versions.map((version) => (
                        <option key={version.id} value={version.id}>
                          {version.label} | {version.financialYear}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </span>
                </label>

                <div className="w-[150px] min-w-0">
                  <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Financial Year</span>
                  <span className="mt-1 block truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{workspace.currentVersion.financialYear}</span>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
