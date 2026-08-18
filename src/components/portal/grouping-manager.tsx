"use client";

import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { StatusPill } from "@/components/portal/cards";
import { PortalButton } from "@/components/ui/portal-button";
import { PortalSelect } from "@/components/ui/portal-select";
import { usePortalSnackbar } from "@/components/ui/portal-snackbar";
import type { LedgerGroupingOption, LedgerGroupingOverride, LedgerSubgroupOption } from "@/lib/ledger-groupings";
import type { LedgerRow } from "@/lib/trial-balance";
import { formatCurrency } from "@/lib/utils";

type EditableState = {
  groupKey: string;
  subgroupKey: string;
  notes: string;
};

type MappingFilter = "all" | "mapped" | "unmapped";
type PageSize = 10 | 15 | 20;

type KeyedLedgerRow = {
  draftKey: string;
  row: LedgerRow;
};

function isMappedRow(row: LedgerRow) {
  return Boolean(row.groupingKey && row.noteNumber);
}

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

function buildDraftKey(row: LedgerRow, index: number) {
  const glNumber = row.glNumber.trim();
  return glNumber || `__blank__:${index}:${row.glDescription.trim().toLowerCase()}`;
}

function getRowEditableState(row: LedgerRow, overrideMap: Record<string, LedgerGroupingOverride>): EditableState {
  return {
    groupKey: overrideMap[row.glNumber]?.groupKey ?? row.groupingKey ?? "",
    subgroupKey: overrideMap[row.glNumber]?.subgroupKey ?? row.subgroupKey ?? "",
    notes: overrideMap[row.glNumber]?.notes ?? row.groupingNotes ?? "",
  };
}

function buildDraftState(
  rows: LedgerRow[],
  overrideMap: Record<string, LedgerGroupingOverride>,
): Record<string, EditableState> {
  return Object.fromEntries(
    rows.map((row, index) => [buildDraftKey(row, index), getRowEditableState(row, overrideMap)]),
  );
}

function isDraftDirty(draft: EditableState, original: EditableState) {
  return draft.groupKey !== original.groupKey || draft.subgroupKey !== original.subgroupKey || draft.notes !== original.notes;
}

export function GroupingManager({
  rows,
  options,
  subgroupOptions,
  savedOverrides,
  companyId,
  versionId,
  canEdit,
}: {
  rows: LedgerRow[];
  options: LedgerGroupingOption[];
  subgroupOptions: LedgerSubgroupOption[];
  savedOverrides: LedgerGroupingOverride[];
  companyId: number;
  versionId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { showSuccess, showError } = usePortalSnackbar();
  const [search, setSearch] = useState("");
  const [mappingFilter, setMappingFilter] = useState<MappingFilter>("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [subgroupFilter, setSubgroupFilter] = useState("all");
  const deferredSearch = useDeferredValue(search);
  const [isPending, startTransition] = useTransition();
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [currentPage, setCurrentPage] = useState(1);

  const overrideMap = useMemo(
    () => Object.fromEntries(savedOverrides.map((override) => [override.glNumber, override])),
    [savedOverrides],
  );
  const subgroupOptionsByGroup = useMemo(
    () =>
      subgroupOptions.reduce<Record<string, LedgerSubgroupOption[]>>((accumulator, option) => {
        accumulator[option.groupKey] = [...(accumulator[option.groupKey] ?? []), option];
        return accumulator;
      }, {}),
    [subgroupOptions],
  );
  const getFirstSubgroupKey = (groupKey: string) => subgroupOptionsByGroup[groupKey]?.[0]?.key ?? "";
  const keyedRows = useMemo<KeyedLedgerRow[]>(
    () => rows.map((row, index) => ({ row, draftKey: buildDraftKey(row, index) })),
    [rows],
  );
  const [drafts, setDrafts] = useState<Record<string, EditableState>>(() => buildDraftState(rows, overrideMap));

  useEffect(() => {
    setDrafts(buildDraftState(rows, overrideMap));
    setCurrentPage(1);
    setSearch("");
    setMappingFilter("all");
    setGroupFilter("all");
    setSubgroupFilter("all");
  }, [companyId, versionId, rows, overrideMap]);

  const filter = deferredSearch.trim().toLowerCase();
  const filterSubgroupOptions = groupFilter === "all" ? subgroupOptions : subgroupOptionsByGroup[groupFilter] ?? [];
  const filteredRows = keyedRows.filter(({ row, draftKey }) => {
    const draft = drafts[draftKey];
    const rowGroupKey = draft?.groupKey ?? row.groupingKey ?? "";
    const rowSubgroupKey = draft?.subgroupKey ?? row.subgroupKey ?? "";

    if (!matchesSearch(row, filter)) {
      return false;
    }

    if (mappingFilter === "mapped" && !isMappedRow(row)) {
      return false;
    }

    if (mappingFilter === "unmapped" && isMappedRow(row)) {
      return false;
    }

    return (groupFilter === "all" || rowGroupKey === groupFilter) && (subgroupFilter === "all" || rowSubgroupKey === subgroupFilter);
  });
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const pageStart = (activePage - 1) * pageSize;
  const paginatedRows = filteredRows.slice(pageStart, pageStart + pageSize);
  const visibleStart = filteredRows.length === 0 ? 0 : pageStart + 1;
  const visibleEnd = Math.min(pageStart + pageSize, filteredRows.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, mappingFilter, groupFilter, subgroupFilter, pageSize]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const saveOverride = (row: LedgerRow, draftKey: string) => {
    const draft = drafts[draftKey];

    startTransition(async () => {
      try {
        const response = await fetch("/api/groupings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            companyId,
            versionId,
            glNumber: row.glNumber,
            glDescription: row.glDescription,
            groupKey: draft.groupKey,
            subgroupKey: draft.subgroupKey,
            notes: draft.notes,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? "Unable to save ledger grouping.");
        }

        showSuccess(`Saved grouping for GL ${row.glNumber || row.glDescription}.`);
        router.refresh();
      } catch (saveError) {
        showError(saveError instanceof Error ? saveError.message : "Unable to save ledger grouping.");
      }
    });
  };

  const clearOverride = (row: LedgerRow, draftKey: string) => {
    startTransition(async () => {
      try {
        const response = await fetch("/api/groupings", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ companyId, versionId, glNumber: row.glNumber }),
        });

        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? "Unable to clear ledger grouping.");
        }

        setDrafts((current) => ({
          ...current,
          [draftKey]: {
            groupKey: row.groupingKey ?? "",
            subgroupKey: row.subgroupKey ?? "",
            notes: "",
          },
        }));

        showSuccess(`Removed saved grouping for GL ${row.glNumber || row.glDescription}.`);
        router.refresh();
      } catch (deleteError) {
        showError(deleteError instanceof Error ? deleteError.message : "Unable to clear ledger grouping.");
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium text-slate-900">Review and update company-version ledger mapping</p>
            <p className="mt-1 text-sm text-slate-500">
              Use the mapped and unmapped filter to review what is already classified and what still needs attention.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="field-input min-w-[260px]"
            placeholder="Search GL number, ledger, or grouping..."
          />
          <PortalSelect
            value={mappingFilter}
            onChange={(value) => setMappingFilter(value as MappingFilter)}
            fullWidth={false}
            formControlProps={{ sx: { minWidth: 170 } }}
            options={[
              { value: "all", label: "All ledgers" },
              { value: "mapped", label: "Mapped ledgers" },
              { value: "unmapped", label: "Unmapped ledgers" },
            ]}
          />
          <PortalSelect
            value={groupFilter}
            onChange={(value) => {
              setGroupFilter(value);
              setSubgroupFilter("all");
            }}
            fullWidth={false}
            formControlProps={{ sx: { minWidth: 220 } }}
            options={[
              { value: "all", label: "All groupings" },
              ...options.map((option) => ({ value: option.key, label: option.label })),
            ]}
          />
          <PortalSelect
            value={subgroupFilter}
            onChange={(value) => setSubgroupFilter(value)}
            fullWidth={false}
            formControlProps={{ sx: { minWidth: 240 } }}
            options={[
              { value: "all", label: "All subgroupings" },
              ...filterSubgroupOptions.map((option) => ({ value: option.key, label: option.label })),
            ]}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/70 dark:border-white/10">
        <div className="portal-scrollbar max-h-[68vh] overflow-auto">
          <table className="min-w-[1960px] border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="w-[130px] border-b border-slate-200/70 bg-slate-50 px-4 py-3 font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">GL</th>
                <th className="w-[300px] border-b border-slate-200/70 bg-slate-50 px-4 py-3 font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">Ledger</th>
                <th className="w-[170px] border-b border-slate-200/70 bg-slate-50 px-4 py-3 font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">Current year</th>
                <th className="w-[170px] border-b border-slate-200/70 bg-slate-50 px-4 py-3 font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">Previous year</th>
                <th className="w-[310px] border-b border-slate-200/70 bg-slate-50 px-4 py-3 font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">Change grouping</th>
                <th className="w-[310px] border-b border-slate-200/70 bg-slate-50 px-4 py-3 font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">Change subgrouping</th>
                <th className="w-[300px] border-b border-slate-200/70 bg-slate-50 px-4 py-3 font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">Note impact</th>
                <th className="w-[330px] min-w-[330px] border-b border-slate-200/70 bg-slate-50 px-4 py-3 font-semibold text-slate-600 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">Action</th>
                <th className="w-[180px] min-w-[180px] border-b border-slate-200/70 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-900" aria-label="Save controls" />
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map(({ row, draftKey }) => {
                const draft = drafts[draftKey] ?? {
                  groupKey: "",
                  subgroupKey: "",
                  notes: "",
                };
                const override = overrideMap[row.glNumber];
                const original = getRowEditableState(row, overrideMap);
                const hasUnsavedChanges = isDraftDirty(draft, original);
                const availableSubgroups = subgroupOptionsByGroup[draft.groupKey] ?? [];
                const selectedSubgroup =
                  availableSubgroups.find((option) => option.key === draft.subgroupKey) ?? availableSubgroups[0] ?? null;
                const noteImpact = selectedSubgroup
                  ? `Note ${selectedSubgroup.noteNumber} - ${selectedSubgroup.noteTitle}`
                  : row.noteNumber
                    ? `Note ${row.noteNumber} - ${row.noteTitle}`
                    : "Review required";

                return (
                  <tr key={draftKey} className="align-top">
                    <td className="border-t border-slate-200/70 px-4 py-3 text-slate-500 dark:border-white/10 dark:text-slate-400">{row.glNumber}</td>
                    <td className="border-t border-slate-200/70 px-4 py-3 dark:border-white/10">
                      <p className="font-medium">{row.glDescription}</p>
                      <div className="mt-2 space-y-2">
                        <StatusPill label={isMappedRow(row) ? "Mapped" : "Unmapped"} tone={isMappedRow(row) ? "positive" : "warning"} />
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{row.derivedLabel}</p>
                        {row.subgroupLabel ? <p className="text-xs text-slate-500 dark:text-slate-400">{row.subgroupLabel}</p> : null}
                      </div>
                    </td>
                    <td className="border-t border-slate-200/70 px-4 py-3 text-slate-700 dark:border-white/10 dark:text-slate-200">{formatCurrency(row.currentYear)}</td>
                    <td className="border-t border-slate-200/70 px-4 py-3 text-slate-700 dark:border-white/10 dark:text-slate-200">{formatCurrency(row.previousYear)}</td>
                    <td className="border-t border-slate-200/70 px-4 py-3 dark:border-white/10">
                      <PortalSelect
                        value={draft.groupKey}
                        disabled={!canEdit}
                        onChange={(value) =>
                          setDrafts((current) => ({
                            ...current,
                            [draftKey]: {
                              ...current[draftKey],
                              groupKey: value,
                              subgroupKey: subgroupOptionsByGroup[value]?.some((option) => option.key === current[draftKey]?.subgroupKey)
                                ? current[draftKey].subgroupKey
                                : getFirstSubgroupKey(value),
                            },
                          }))
                        }
                        options={[
                          { value: "", label: "Select grouping" },
                          ...options.map((option) => ({ value: option.key, label: option.label })),
                        ]}
                      />
                    </td>
                    <td className="border-t border-slate-200/70 px-4 py-3 dark:border-white/10">
                      <PortalSelect
                        value={draft.subgroupKey}
                        disabled={!canEdit || availableSubgroups.length === 0}
                        onChange={(value) =>
                          setDrafts((current) => ({
                            ...current,
                            [draftKey]: {
                              ...current[draftKey],
                              subgroupKey: value,
                            },
                          }))
                        }
                        options={[
                          { value: "", label: "Select subgrouping" },
                          ...availableSubgroups.map((option) => ({ value: option.key, label: option.label })),
                        ]}
                      />
                    </td>
                    <td className="border-t border-slate-200/70 px-4 py-3 dark:border-white/10">
                      <div className="rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-200">
                        <p>{noteImpact}</p>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{row.classificationBasis}</p>
                      </div>
                    </td>
                    <td className="min-w-[330px] border-t border-slate-200/70 px-4 py-3 dark:border-white/10">
                      <textarea
                        value={draft.notes}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [draftKey]: {
                              ...current[draftKey],
                              notes: event.target.value,
                            },
                          }))
                        }
                        rows={2}
                        className="field-input min-h-[84px] resize-y text-sm leading-5"
                        placeholder="Optional remarks..."
                      />
                    </td>
                    <td className="min-w-[180px] border-t border-slate-200/70 px-4 py-3 dark:border-white/10">
                      <div className="flex flex-col gap-3">
                        <PortalButton
                          variant="primary"
                          type="button"
                          disabled={!canEdit || isPending || !draft.groupKey || !hasUnsavedChanges}
                          onClick={() => saveOverride(row, draftKey)}
                        >
                          Save
                        </PortalButton>
                        {override ? (
                          <PortalButton
                            variant="secondary"
                            type="button"
                            disabled={!canEdit || isPending}
                            onClick={() => clearOverride(row, draftKey)}
                          >
                            Clear saved
                          </PortalButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-200/70 bg-white/90 px-4 py-3 dark:border-white/10 dark:bg-slate-950/80 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Showing {visibleStart}-{visibleEnd} of {filteredRows.length} ledgers
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              Rows
              <PortalSelect
                value={String(pageSize)}
                onChange={(value) => setPageSize(Number(value) as PageSize)}
                fullWidth={false}
                formControlProps={{ sx: { width: 92 } }}
                options={[
                  { value: "10", label: "10" },
                  { value: "15", label: "15" },
                  { value: "20", label: "20" },
                ]}
              />
            </div>
            <div className="flex items-center gap-2">
              <PortalButton
                variant="secondary"
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={activePage === 1}
              >
                Previous
              </PortalButton>
              <span className="min-w-[84px] text-center text-sm font-medium text-slate-700 dark:text-slate-200">
                {activePage} / {totalPages}
              </span>
              <PortalButton
                variant="secondary"
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={activePage === totalPages}
              >
                Next
              </PortalButton>
            </div>
          </div>
        </div>
      </div>

      <p className="text-sm text-slate-500 dark:text-slate-400">
        Saved groupings stay specific to the selected company and version, so each workspace can maintain its own mapping logic.
      </p>
    </div>
  );
}
