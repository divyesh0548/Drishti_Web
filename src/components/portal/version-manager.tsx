"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, FileSpreadsheet, History, Sparkles } from "lucide-react";

import type { StatementVersionRecord, WorkspaceContext } from "@/lib/company-workspace";

export function VersionManager({
  context,
}: {
  context: WorkspaceContext;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [financialYear, setFinancialYear] = useState("");
  const [trialBalanceFile, setTrialBalanceFile] = useState<File | null>(null);
  const [statementWorkbookFile, setStatementWorkbookFile] = useState<File | null>(null);

  const readResponsePayload = async (response: Response) => {
    const text = await response.text();

    if (!text.trim()) {
      return {};
    }

    try {
      return JSON.parse(text) as { error?: string; version?: StatementVersionRecord };
    } catch {
      return {
        error: response.ok ? "Unexpected response from server." : text,
      };
    }
  };

  const createVersion = () => {
    setMessage(null);
    setError(null);

    if (!trialBalanceFile) {
      setError("Please select a trial balance workbook to upload.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("companyId", context.company.id);
      formData.set("label", label);
      formData.set("financialYear", financialYear);

      if (trialBalanceFile) {
        formData.set("trialBalanceFile", trialBalanceFile);
      }

      if (statementWorkbookFile) {
        formData.set("statementWorkbookFile", statementWorkbookFile);
      }

      const response = await fetch("/api/workspace/versions", {
        method: "POST",
        body: formData,
      });

      const payload = await readResponsePayload(response);

      if (!response.ok) {
        setError(payload.error ?? "Unable to create statement version.");
        return;
      }

      if (!payload.version) {
        setError("Upload finished but the version response was incomplete.");
        return;
      }

      setMessage(`Trial balance uploaded to ${payload.version.label}.`);
      setLabel("");
      setFinancialYear("");
      setTrialBalanceFile(null);
      setStatementWorkbookFile(null);
      router.push(`/import-center?company=${context.company.id}&version=${payload.version.id}`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      {message ? <div className="rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/12 dark:text-emerald-300">{message}</div> : null}
      {error ? <div className="rounded-[1.2rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/12 dark:text-rose-300">{error}</div> : null}

      {context.permissions.canUploadTrialBalance ? (
        <div className="enterprise-shell-card overflow-hidden">
          <div className="border-b border-slate-200/70 bg-gradient-to-r from-white to-blue-50/70 px-5 py-4 dark:border-white/10 dark:from-slate-950 dark:to-blue-950/20">
            <div className="space-y-3">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/12 dark:text-blue-300 dark:ring-blue-500/20">
                  <Sparkles className="h-3.5 w-3.5" />
                  Version creation wizard
                </div>
                <h3 className="mt-3 text-lg font-semibold text-slate-950 dark:text-slate-50">Upload trial balance and create version</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Upload a trial balance workbook for the next company-specific version. The TB is stored inside that company version folder, and statement downloads are generated from the shared V-8 template for every company.
                </p>
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <div className="rounded-xl bg-white/85 px-3 py-2.5 ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-white/10">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Step 1</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">Upload file</p>
                </div>
                <div className="rounded-xl bg-white/85 px-3 py-2.5 ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-white/10">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Step 2</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">Create version</p>
                </div>
                <div className="rounded-xl bg-white/85 px-3 py-2.5 ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-white/10">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Step 3</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">Open workspace</p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="grid gap-2 xl:grid-cols-4">
              <input className="field-input field-input-compact text-sm" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Version label" />
              <input className="field-input field-input-compact text-sm" value={financialYear} onChange={(event) => setFinancialYear(event.target.value)} placeholder="Financial year" />
              <label className="flex h-10 min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 text-sm text-slate-600 transition hover:border-blue-200 hover:bg-blue-50/40 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-300">
                <input className="hidden" type="file" accept=".xlsx,.xls" onChange={(event) => setTrialBalanceFile(event.target.files?.[0] ?? null)} />
                <CloudUpload className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
                <span className="truncate">{trialBalanceFile ? `TB: ${trialBalanceFile.name}` : "Select trial balance workbook"}</span>
              </label>
              <label className="flex h-10 min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 text-sm text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-300">
                <input className="hidden" type="file" accept=".xlsx,.xls" onChange={(event) => setStatementWorkbookFile(event.target.files?.[0] ?? null)} />
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />
                <span className="truncate">{statementWorkbookFile ? `Reference workbook: ${statementWorkbookFile.name}` : "Optional reference workbook"}</span>
              </label>
            </div>

            <button
              type="button"
              disabled={isPending || !trialBalanceFile}
              onClick={createVersion}
              className="portal-button-primary mt-3 inline-flex h-10 items-center justify-center px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {isPending ? "Uploading..." : "Upload TB"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="enterprise-shell-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200/70 bg-gradient-to-r from-white to-slate-50 px-5 py-4 dark:border-white/10 dark:from-slate-950 dark:to-slate-900/70">
          <div>
            <p className="text-lg font-semibold text-slate-950 dark:text-slate-50">Version history</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Every upload remains isolated to its own company version.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <History className="h-3.5 w-3.5" />
            {context.versions.length} versions
          </div>
        </div>
        <div className="enterprise-table rounded-none border-0 shadow-none">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 font-medium">Version</th>
                <th className="px-4 py-3 font-medium">Financial year</th>
                <th className="px-4 py-3 font-medium">Trial balance</th>
                <th className="px-4 py-3 font-medium">Uploaded reference workbook</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {context.versions.map((version: StatementVersionRecord) => (
                <tr key={version.id} className="border-t border-slate-200/70 dark:border-white/10">
                  <td className="px-4 py-3 font-medium">{version.label}</td>
                  <td className="px-4 py-3">{version.financialYear}</td>
                  <td className="px-4 py-3">{version.trialBalanceWorkbookName}</td>
                  <td className="px-4 py-3">{version.statementWorkbookName}</td>
                  <td className="px-4 py-3">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(version.createdAt))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
