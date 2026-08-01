"use client";

import { useDeferredValue, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import { StatusPill } from "@/components/portal/cards";
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
  companyId: string;
  versionId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [mappingFilter, setMappingFilter] = useState<MappingFilter>("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [subgroupFilter, setSubgroupFilter] = useState("all");
  const deferredSearch = useDeferredValue(search);
  const [isPending, startTransition] = useTransition();
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [currentPage, setCurrentPage] = useState(1);

  const overrideMap = Object.fromEntries(savedOverrides.map((override) => [override.glNumber, override]));
  const subgroupOptionsByGroup = subgroupOptions.reduce<Record<string, LedgerSubgroupOption[]>>((accumulator, option) => {
    accumulator[option.groupKey] = [...(accumulator[option.groupKey] ?? []), option];
    return accumulator;
  }, {});
  const getFirstSubgroupKey = (groupKey: string) => subgroupOptionsByGroup[groupKey]?.[0]?.key ?? "";
  const [drafts, setDrafts] = useState<Record<string, EditableState>>(() =>
    Object.fromEntries(
      rows.map((row) => [
        row.glNumber,
        {
          groupKey: overrideMap[row.glNumber]?.groupKey ?? row.groupingKey ?? "",
          subgroupKey: overrideMap[row.glNumber]?.subgroupKey ?? row.subgroupKey ?? "",
          notes: overrideMap[row.glNumber]?.notes ?? row.groupingNotes ?? "",
        },
      ]),
    ),
  );

  const filter = deferredSearch.trim().toLowerCase();
  const filterSubgroupOptions = groupFilter === "all" ? subgroupOptions : subgroupOptionsByGroup[groupFilter] ?? [];
  const filteredRows = rows.filter((row) => {
    const draft = drafts[row.glNumber];
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

  const saveOverride = (row: LedgerRow) => {
    const draft = drafts[row.glNumber];

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

        toast.success(`Saved grouping for GL ${row.glNumber}.`);
        router.refresh();
      } catch (saveError) {
        toast.error(saveError instanceof Error ? saveError.message : "Unable to save ledger grouping.");
      }
    });
  };

  const clearOverride = (glNumber: string) => {
    const fallbackRow = rows.find((row) => row.glNumber === glNumber);

    startTransition(async () => {
      try {
        const response = await fetch("/api/groupings", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ companyId, versionId, glNumber }),
        });

        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? "Unable to clear ledger grouping.");
        }

        if (fallbackRow) {
          setDrafts((current) => ({
            ...current,
            [glNumber]: {
              groupKey: fallbackRow.groupingKey ?? "",
              subgroupKey: fallbackRow.subgroupKey ?? "",
              notes: "",
            },
          }));
        }

        toast.success(`Removed saved grouping for GL ${glNumber}.`);
        router.refresh();
      } catch (deleteError) {
        toast.error(deleteError instanceof Error ? deleteError.message : "Unable to clear ledger grouping.");
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
          <select
            value={mappingFilter}
            onChange={(event) => setMappingFilter(event.target.value as MappingFilter)}
            className="field-input min-w-[170px] py-3"
          >
            <option value="all">All ledgers</option>
            <option value="mapped">Mapped ledgers</option>
            <option value="unmapped">Unmapped ledgers</option>
          </select>
          <select
            value={groupFilter}
            onChange={(event) => {
              setGroupFilter(event.target.value);
              setSubgroupFilter("all");
            }}
            className="field-input min-w-[220px] py-3"
          >
            <option value="all">All groupings</option>
            {options.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            value={subgroupFilter}
            onChange={(event) => setSubgroupFilter(event.target.value)}
            className="field-input min-w-[240px] py-3"
          >
            <option value="all">All subgroupings</option>
            {filterSubgroupOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/70 dark:border-white/10">
        <div className="max-h-[68vh] overflow-auto">
        <table className="min-w-[1960px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 shadow-[0_1px_0_var(--border)] dark:bg-slate-900 dark:text-slate-300">
            <tr>
              <th className="w-[130px] px-4 py-3 font-semibold">GL</th>
              <th className="w-[300px] px-4 py-3 font-semibold">Ledger</th>
              <th className="w-[170px] px-4 py-3 font-semibold">Current year</th>
              <th className="w-[170px] px-4 py-3 font-semibold">Previous year</th>
              <th className="w-[310px] px-4 py-3 font-semibold">Change grouping</th>
              <th className="w-[310px] px-4 py-3 font-semibold">Change subgrouping</th>
              <th className="w-[300px] px-4 py-3 font-semibold">Note impact</th>
              <th className="w-[330px] min-w-[330px] px-4 py-3 font-semibold">Action</th>
              <th className="w-[180px] min-w-[180px] px-4 py-3" aria-label="Save controls" />
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row) => {
              const draft = drafts[row.glNumber];
              const override = overrideMap[row.glNumber];
              const availableSubgroups = subgroupOptionsByGroup[draft.groupKey] ?? [];
              const selectedSubgroup =
                availableSubgroups.find((option) => option.key === draft.subgroupKey) ?? availableSubgroups[0] ?? null;
              const noteImpact = selectedSubgroup
                ? `Note ${selectedSubgroup.noteNumber} - ${selectedSubgroup.noteTitle}`
                : row.noteNumber
                  ? `Note ${row.noteNumber} - ${row.noteTitle}`
                  : "Review required";

              return (
                <tr key={row.glNumber} className="border-t border-slate-200/70 align-top dark:border-white/10">
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{row.glNumber}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.glDescription}</p>
                    <div className="mt-2 space-y-2">
                      <StatusPill label={isMappedRow(row) ? "Mapped" : "Unmapped"} tone={isMappedRow(row) ? "positive" : "warning"} />
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{row.derivedLabel}</p>
                      {row.subgroupLabel ? <p className="text-xs text-slate-500 dark:text-slate-400">{row.subgroupLabel}</p> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{formatCurrency(row.currentYear)}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{formatCurrency(row.previousYear)}</td>
                  <td className="px-4 py-3">
                    <select
                      value={draft.groupKey}
                      disabled={!canEdit}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [row.glNumber]: {
                            ...current[row.glNumber],
                            groupKey: event.target.value,
                            subgroupKey:
                              subgroupOptionsByGroup[event.target.value]?.some((option) => option.key === current[row.glNumber]?.subgroupKey)
                                ? current[row.glNumber].subgroupKey
                                : getFirstSubgroupKey(event.target.value),
                          },
                        }))
                      }
                      className="field-input w-full py-3"
                    >
                      <option value="">Select grouping</option>
                      {options.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={draft.subgroupKey}
                      disabled={!canEdit || availableSubgroups.length === 0}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [row.glNumber]: {
                            ...current[row.glNumber],
                            subgroupKey: event.target.value,
                          },
                        }))
                      }
                      className="field-input w-full py-3"
                    >
                      <option value="">Select subgrouping</option>
                      {availableSubgroups.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-200">
                      <p>{noteImpact}</p>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{row.classificationBasis}</p>
                    </div>
                  </td>
                  <td className="min-w-[330px] px-4 py-3">
                    <div>
                      <textarea
                        value={draft.notes}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setDrafts((current) => ({
                            ...current,
                            [row.glNumber]: {
                              ...current[row.glNumber],
                              notes: event.target.value,
                            },
                          }))
                        }
                        rows={2}
                        className="field-input min-h-[84px] resize-y text-sm leading-5"
                        placeholder="Optional remarks..."
                      />
                    </div>
                  </td>
                  <td className="min-w-[180px] px-4 py-3">
                    <div className="flex flex-col gap-3">
                      <button
                        type="button"
                        disabled={!canEdit || isPending || !draft.groupKey}
                        onClick={() => saveOverride(row)}
                        className="portal-button-primary inline-flex min-h-[44px] items-center justify-center px-4 py-2 text-sm font-semibold disabled:opacity-60"
                      >
                        Save
                      </button>
                      {override ? (
                        <button
                          type="button"
                          disabled={!canEdit || isPending}
                          onClick={() => clearOverride(row.glNumber)}
                          className="portal-button-secondary inline-flex min-h-[42px] items-center justify-center px-4 py-2 text-sm font-semibold disabled:opacity-60"
                        >
                          Clear saved
                        </button>
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
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              Rows
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value) as PageSize)}
                className="field-input w-[92px] py-2 text-sm"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
              </select>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={activePage === 1}
                className="portal-button-secondary px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Previous
              </button>
              <span className="min-w-[84px] text-center text-sm font-medium text-slate-700 dark:text-slate-200">
                {activePage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={activePage === totalPages}
                className="portal-button-secondary px-3 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Next
              </button>
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
