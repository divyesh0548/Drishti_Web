"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { StatusPill } from "@/components/portal/cards";
import type { AgeingGroup, AgeingKind, AgeingStore, AgeingSummary } from "@/lib/ageing";

function emptyGroup(): AgeingGroup {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `group-${Date.now()}`;
  return {
    id,
    label: "New bucket",
    minDays: 0,
    maxDays: null,
  };
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function SummaryTable({
  title,
  summary,
  groups,
}: {
  title: string;
  summary: AgeingSummary;
  groups: AgeingGroup[];
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/70 dark:border-white/10">
      <div className="flex items-center justify-between border-b border-slate-200/70 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-900/70">
        <p className="font-medium text-slate-950 dark:text-slate-50">{title}</p>
        <StatusPill label={`${summary.rows.length} parties`} tone="positive" />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3 font-medium">Party</th>
              <th className="px-4 py-3 font-medium">Ledger</th>
              {groups.map((group) => (
                <th key={group.id} className="px-4 py-3 font-medium">
                  {group.label}
                </th>
              ))}
              <th className="px-4 py-3 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.length === 0 ? (
              <tr className="border-t border-slate-200/70 dark:border-white/10">
                <td colSpan={groups.length + 3} className="px-4 py-6 text-center text-slate-500">
                  No uploaded ledger data available for this section yet.
                </td>
              </tr>
            ) : (
              <>
                {summary.rows.map((row) => (
                  <tr key={`${row.partyName}-${row.ledgerName}`} className="border-t border-slate-200/70 dark:border-white/10">
                    <td className="px-4 py-3 font-medium text-slate-950 dark:text-slate-50">{row.partyName}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.ledgerName}</td>
                    {groups.map((group) => (
                      <td key={group.id} className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {formatAmount(row.bucketValues[group.id] ?? 0)}
                      </td>
                    ))}
                    <td className="px-4 py-3 font-semibold text-slate-950 dark:text-slate-50">{formatAmount(row.total)}</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200/70 bg-slate-50/80 dark:border-white/10 dark:bg-slate-900/60">
                  <td className="px-4 py-3 font-semibold text-slate-950 dark:text-slate-50" colSpan={2}>
                    Total
                  </td>
                  {groups.map((group) => (
                    <td key={group.id} className="px-4 py-3 font-semibold text-slate-950 dark:text-slate-50">
                      {formatAmount(summary.totals[group.id] ?? 0)}
                    </td>
                  ))}
                  <td className="px-4 py-3 font-semibold text-slate-950 dark:text-slate-50">{formatAmount(summary.grandTotal)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AgeingManager({
  companyId,
  versionId,
  canEdit,
  store,
  receivables,
  payables,
}: {
  companyId: string;
  versionId: string;
  canEdit: boolean;
  store: AgeingStore;
  receivables: { normal: AgeingSummary; msme: AgeingSummary };
  payables: { normal: AgeingSummary; msme: AgeingSummary };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asOfDate, setAsOfDate] = useState(store.asOfDate);
  const [ageGroups, setAgeGroups] = useState<AgeingGroup[]>(store.ageGroups);
  const [files, setFiles] = useState<Record<AgeingKind, File | null>>({
    receivables: null,
    payables: null,
  });

  const uploadLedgerFile = (kind: AgeingKind) => {
    if (!files[kind]) {
      setError(`Select a ${kind} file before uploading.`);
      return;
    }

    setMessage(null);
    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("companyId", companyId);
      formData.set("versionId", versionId);
      formData.set("kind", kind);
      formData.set("file", files[kind]!);

      const response = await fetch("/api/ageing/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error ?? "Unable to upload ageing file.");
        return;
      }

      setMessage(`${kind === "receivables" ? "Trade receivables" : "Trade payables"} file uploaded.`);
      setFiles((current) => ({ ...current, [kind]: null }));
      router.refresh();
    });
  };

  const saveAgeingLogic = () => {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/ageing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId,
          versionId,
          asOfDate,
          ageGroups,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error ?? "Unable to save ageing groups.");
        return;
      }

      setMessage("Ageing groups and as-of date saved.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <section className="space-y-5">
        <div className="rounded-xl border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-lg font-semibold text-slate-950 dark:text-slate-50">Ageing logic</p>
              <p className="mt-1 text-sm text-slate-500">
                Define the ageing cut-off date and customize the buckets used for both Normal and MSME summaries.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={asOfDate}
                disabled={!canEdit}
                onChange={(event) => setAsOfDate(event.target.value)}
                className="field-input field-input-compact w-[150px] text-sm"
              />
              <button
                type="button"
                disabled={!canEdit || isPending}
                onClick={saveAgeingLogic}
                className="portal-button-primary inline-flex h-10 items-center justify-center px-4 py-2 text-sm font-semibold disabled:opacity-60"
              >
                Save logic
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {ageGroups.map((group, index) => (
              <div key={group.id} className="grid gap-2 rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-slate-900/55 xl:grid-cols-[1.25fr_0.7fr_0.7fr_auto]">
                <input
                  value={group.label}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setAgeGroups((current) =>
                      current.map((entry) => (entry.id === group.id ? { ...entry, label: event.target.value } : entry)),
                    )
                  }
                  className="field-input field-input-compact text-sm"
                  placeholder="Bucket label"
                />
                <input
                  type="number"
                  value={group.minDays ?? ""}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setAgeGroups((current) =>
                      current.map((entry) =>
                        entry.id === group.id
                          ? {
                              ...entry,
                              minDays: event.target.value === "" ? null : Number(event.target.value),
                            }
                          : entry,
                      ),
                    )
                  }
                  className="field-input field-input-compact text-sm"
                  placeholder="Min days"
                />
                <input
                  type="number"
                  value={group.maxDays ?? ""}
                  disabled={!canEdit}
                  onChange={(event) =>
                    setAgeGroups((current) =>
                      current.map((entry) =>
                        entry.id === group.id
                          ? {
                              ...entry,
                              maxDays: event.target.value === "" ? null : Number(event.target.value),
                            }
                          : entry,
                      ),
                    )
                  }
                  className="field-input field-input-compact text-sm"
                  placeholder="Max days"
                />
                <button
                  type="button"
                  disabled={!canEdit || isPending || ageGroups.length === 1}
                  onClick={() => setAgeGroups((current) => current.filter((entry) => entry.id !== group.id))}
                  className="portal-button-secondary inline-flex h-10 items-center justify-center px-4 py-2 text-sm font-semibold disabled:opacity-60"
                >
                  Remove
                </button>
                <p className="xl:col-span-4 text-xs text-slate-500">
                  Bucket {index + 1}: leave min or max blank to keep the range open-ended.
                </p>
              </div>
            ))}
            <button
              type="button"
              disabled={!canEdit || isPending}
              onClick={() => setAgeGroups((current) => [...current, emptyGroup()])}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50/40 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200"
            >
              Add ageing bucket
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/70">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-slate-950 dark:text-slate-50">Ledger uploads</p>
              <p className="mt-1 text-sm text-slate-500">
                Upload receivable and payable ledger extracts. The parser supports columns such as party name, ledger, invoice date, due date,
                outstanding amount, and category or MSME flag.
              </p>
            </div>
            <StatusPill label={canEdit ? "Editable" : "Read only"} tone="positive" />
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {(["receivables", "payables"] as AgeingKind[]).map((kind) => (
              <div key={kind} className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-slate-900/55">
                <div className="min-w-0">
                  <p className="font-medium text-slate-950 dark:text-slate-50">{kind === "receivables" ? "Trade Receivables" : "Trade Payables"}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {store.uploads[kind].sourceName
                      ? `Last upload: ${store.uploads[kind].sourceName} on ${new Intl.DateTimeFormat("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(store.uploads[kind].uploadedAt ?? new Date().toISOString()))}`
                      : "No file uploaded yet."}
                  </p>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="flex h-10 min-w-0 cursor-pointer items-center rounded-xl border border-dashed border-slate-300 bg-white px-3 text-sm text-slate-600 transition hover:border-blue-200 hover:bg-blue-50/40 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300 sm:w-[220px]">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      disabled={!canEdit}
                      onChange={(event) => setFiles((current) => ({ ...current, [kind]: event.target.files?.[0] ?? null }))}
                      className="hidden"
                    />
                    <span className="truncate">{files[kind]?.name ?? "Choose file"}</span>
                  </label>
                  <button
                    type="button"
                    disabled={!canEdit || isPending}
                    onClick={() => uploadLedgerFile(kind)}
                    className="portal-button-primary inline-flex h-10 items-center justify-center px-4 py-2 text-sm font-semibold disabled:opacity-60"
                  >
                    Upload {kind === "receivables" ? "Receivables" : "Payables"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <SummaryTable title="Trade Receivables - Normal" summary={receivables.normal} groups={store.ageGroups} />
          <SummaryTable title="Trade Receivables - MSME" summary={receivables.msme} groups={store.ageGroups} />
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <SummaryTable title="Trade Payables - Normal" summary={payables.normal} groups={store.ageGroups} />
          <SummaryTable title="Trade Payables - MSME" summary={payables.msme} groups={store.ageGroups} />
        </div>
      </section>
    </div>
  );
}
