"use client";

import { useDeferredValue, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { StatusPill, SummaryLabel } from "@/components/portal/cards";
import { PortalButton } from "@/components/ui/portal-button";
import { PortalSelect } from "@/components/ui/portal-select";
import { usePortalSnackbar } from "@/components/ui/portal-snackbar";
import type { RatioDefinition } from "@/lib/key-ratios";
import type { RatioLedgerConfigStore } from "@/lib/ratio-ledger-config";
import type { LedgerRow } from "@/lib/trial-balance";
import { formatCurrency } from "@/lib/utils";

function matchesSearch(row: LedgerRow, filter: string) {
  if (!filter) {
    return true;
  }

  return (
    row.glNumber.toLowerCase().includes(filter) ||
    row.glDescription.toLowerCase().includes(filter) ||
    row.derivedLabel.toLowerCase().includes(filter) ||
    row.subgroupLabel.toLowerCase().includes(filter) ||
    row.noteTitle.toLowerCase().includes(filter)
  );
}

export function RatioLedgerSelectionManager({
  rows,
  ratioDefinitions,
  ratioConfig,
  companyId,
  versionId,
  canEdit,
}: {
  rows: LedgerRow[];
  ratioDefinitions: RatioDefinition[];
  ratioConfig: RatioLedgerConfigStore;
  companyId: number;
  versionId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { showSuccess, showError } = usePortalSnackbar();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [isPending, startTransition] = useTransition();
  const [selectedRatioId, setSelectedRatioId] = useState(ratioDefinitions[0]?.id ?? "");
  const [ratioExclusions, setRatioExclusions] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(ratioDefinitions.map((definition) => [definition.id, ratioConfig.ratios[definition.id]?.excludedGlNumbers ?? []])),
  );

  const filter = deferredSearch.trim().toLowerCase();
  const selectedRatio = ratioDefinitions.find((definition) => definition.id === selectedRatioId) ?? ratioDefinitions[0] ?? null;
  const selectedRatioExclusions = new Set(selectedRatio ? ratioExclusions[selectedRatio.id] ?? [] : []);
  const ratioCandidateRows = selectedRatio
    ? rows.filter((row) => row.noteNumber && selectedRatio.relevantNoteNumbers.includes(row.noteNumber) && matchesSearch(row, filter))
    : [];
  const ratioSelectedCount = ratioCandidateRows.filter((row) => !selectedRatioExclusions.has(row.glNumber)).length;

  const saveRatioSelection = (ratioId: string) => {
    startTransition(async () => {
      try {
        const response = await fetch("/api/ratio-ledgers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            companyId,
            versionId,
            ratioId,
            excludedGlNumbers: ratioExclusions[ratioId] ?? [],
          }),
        });

        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? "Unable to save ratio ledger selection.");
        }

        const definition = ratioDefinitions.find((entry) => entry.id === ratioId);
        showSuccess(`Saved ratio ledger selection for ${definition?.label ?? "the selected ratio"}.`);
        router.refresh();
      } catch (saveError) {
        showError(saveError instanceof Error ? saveError.message : "Unable to save ratio ledger selection.");
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Select which mapped ledgers feed each ratio</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Each ratio keeps its own company-specific ledger selection so the ratio analysis reflects your chosen basis.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="field-input min-w-[260px]"
            placeholder="Search ratio ledgers by GL, ledger, or note..."
          />
          {selectedRatio ? (
            <>
              <PortalSelect
                value={selectedRatio.id}
                onChange={(value) => setSelectedRatioId(value)}
                fullWidth={false}
                formControlProps={{ sx: { minWidth: 250 } }}
                options={ratioDefinitions.map((definition) => ({ value: definition.id, label: definition.label }))}
              />
              <div className="flex flex-wrap gap-2">
                <SummaryLabel label={`${ratioSelectedCount} selected`} tone="positive" width="9.5rem" />
                <SummaryLabel label={`${ratioCandidateRows.length - ratioSelectedCount} excluded`} tone="neutral" width="9.5rem" />
              </div>
            </>
          ) : null}
        </div>
      </div>

      {selectedRatio ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 dark:border-white/10 dark:bg-slate-900/50">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.08em] text-slate-400">Ratio basis</p>
                <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-50">{selectedRatio.label}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{selectedRatio.formula}</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Mapped note buckets: {selectedRatio.notes}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <PortalButton
                  variant="secondary"
                  type="button"
                  disabled={!canEdit || isPending}
                  onClick={() =>
                    setRatioExclusions((current) => ({
                      ...current,
                      [selectedRatio.id]: [],
                    }))
                  }
                >
                  Select all
                </PortalButton>
                <PortalButton
                  variant="secondary"
                  type="button"
                  disabled={!canEdit || isPending}
                  onClick={() =>
                    setRatioExclusions((current) => ({
                      ...current,
                      [selectedRatio.id]: ratioCandidateRows.map((row) => row.glNumber),
                    }))
                  }
                >
                  Deselect all
                </PortalButton>
                <PortalButton
                  variant="primary"
                  type="button"
                  disabled={!canEdit || isPending}
                  onClick={() => saveRatioSelection(selectedRatio.id)}
                >
                  Save ratio selection
                </PortalButton>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/70 dark:border-white/10">
            <table className="min-w-full table-fixed text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="w-[8%] px-4 py-3 font-medium">Use</th>
                  <th className="w-[10%] px-4 py-3 font-medium">GL</th>
                  <th className="w-[22%] px-4 py-3 font-medium">Ledger</th>
                  <th className="w-[12%] px-4 py-3 font-medium">Current year</th>
                  <th className="w-[12%] px-4 py-3 font-medium">Previous year</th>
                  <th className="w-[14%] px-4 py-3 font-medium">Grouping</th>
                  <th className="w-[10%] px-4 py-3 font-medium">Subgrouping</th>
                  <th className="w-[12%] px-4 py-3 font-medium">Note impact</th>
                </tr>
              </thead>
              <tbody>
                {ratioCandidateRows.slice(0, 150).map((row) => {
                  const isSelected = !selectedRatioExclusions.has(row.glNumber);

                  return (
                    <tr key={`${selectedRatio.id}-${row.glNumber}`} className="border-t border-slate-200/70 align-top dark:border-white/10">
                      <td className="px-4 py-3">
                        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!canEdit}
                            onChange={(event) =>
                              setRatioExclusions((current) => {
                                const existing = new Set(current[selectedRatio.id] ?? []);

                                if (event.target.checked) {
                                  existing.delete(row.glNumber);
                                } else {
                                  existing.add(row.glNumber);
                                }

                                return {
                                  ...current,
                                  [selectedRatio.id]: [...existing].sort((left, right) => left.localeCompare(right)),
                                };
                              })
                            }
                          />
                          <span>{isSelected ? "Included" : "Excluded"}</span>
                        </label>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{row.glNumber}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-950 dark:text-slate-50">{row.glDescription}</p>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{row.classificationBasis}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{formatCurrency(row.currentYear)}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{formatCurrency(row.previousYear)}</td>
                      <td className="px-4 py-3">
                        <StatusPill label={row.derivedLabel || "Review required"} tone="neutral" />
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{row.subgroupLabel || "No subgrouping"}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                        {row.noteNumber ? `Note ${row.noteNumber} - ${row.noteTitle}` : "Not mapped"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ratio ledger selections are stored separately for each company version so one workspace can exclude or include ledgers without affecting another.
          </p>
        </>
      ) : null}
    </div>
  );
}
