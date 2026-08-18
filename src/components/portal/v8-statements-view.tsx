"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";

import { MiniStat, PageHeader, SectionCard, StatusPill } from "@/components/portal/cards";
import { PortalButton } from "@/components/ui/portal-button";
import type { StatementDisplayRow } from "@/lib/statement-pack";
import {
  serializeStatementLineOverrides,
  type StatementLineOverride,
  type StatementOverrideArea,
} from "@/lib/statement-line-overrides";
import type { V8FinancialModel, V8WorkbookSheet } from "@/lib/v8-financials";
import { cn } from "@/lib/utils";
import { BookOpen, FileDown, Printer } from "lucide-react";

const statementSheetConfigs: Partial<Record<string, { columns: number[]; roundedValueColumns: number[]; widths: string[]; fixed?: boolean }>> = {
  BS: {
    columns: [0, 1, 2, 3],
    roundedValueColumns: [2, 3],
    widths: ["58%", "10%", "16%", "16%"],
    fixed: true,
  },
  PL: {
    columns: [0, 1, 2, 3],
    roundedValueColumns: [2, 3],
    widths: ["58%", "10%", "16%", "16%"],
    fixed: true,
  },
  "Cash Flow_FY26": {
    columns: [0, 1, 2],
    roundedValueColumns: [1, 2],
    widths: ["68%", "16%", "16%"],
    fixed: true,
  },
  SOCIE: {
    columns: [0, 1, 3, 4],
    roundedValueColumns: [3, 4],
    widths: ["46%", "18%", "18%", "18%"],
  },
  "BS Notes 3-18": {
    columns: [0, 1, 2, 3],
    roundedValueColumns: [1, 2],
    widths: ["58%", "14%", "14%", "14%"],
    fixed: true,
  },
  "PL Notes 19-27": {
    columns: [0, 1, 2, 3],
    roundedValueColumns: [1, 2],
    widths: ["58%", "14%", "14%", "14%"],
    fixed: true,
  },
};

type NoteOption = {
  noteNumber: string;
  title: string;
};

type EditableStatementLine = {
  statementArea: StatementOverrideArea;
  particulars: string;
  defaultNoteNumber: string;
};

function rowText(row: string[]) {
  return row.join(" ").replace(/\s+/g, " ").trim().toUpperCase();
}

function rowTone(row: string[], rowIndex: number) {
  const text = rowText(row);

  if (rowIndex === 0) {
    return "title";
  }

  if (rowIndex === 1) {
    return "subtitle";
  }

  if (
    text === "ASSETS" ||
    text === "EQUITY AND LIABILITIES" ||
    text === "INCOME" ||
    text === "EXPENSES" ||
    text.startsWith("NOTE ")
  ) {
    return "section";
  }

  if (
    text.includes("TOTAL ") ||
    text.startsWith("TOTAL") ||
    text.includes("COMPREHENSIVE INCOME") ||
    text.includes("PROFIT / (LOSS)") ||
    text.includes("PROFIT/(LOSS)") ||
    text.includes("NET CASH FLOW")
  ) {
    return "total";
  }

  if (
    text.includes("NON CURRENT") ||
    text.includes("CURRENT ASSETS") ||
    text === "EQUITY" ||
    text.includes("LIABILITIES") ||
    text.includes("TAX EXPENSES") ||
    text.includes("OTHER COMPREHENSIVE INCOME") ||
    text.includes("EARNINGS PER SHARE") ||
    text.startsWith("(A) ") ||
    text.startsWith("(B) ") ||
    text.startsWith("(C) ")
  ) {
    return "heading";
  }

  return "default";
}

function rowClassName(tone: ReturnType<typeof rowTone>) {
  if (tone === "title") {
    return "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950";
  }

  if (tone === "subtitle") {
    return "bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100";
  }

  if (tone === "section") {
    return "bg-slate-200 font-semibold text-slate-950 dark:bg-slate-800 dark:text-slate-50";
  }

  if (tone === "heading") {
    return "bg-slate-50 font-semibold text-slate-700 dark:bg-slate-900/70 dark:text-slate-100";
  }

  if (tone === "total") {
    return "bg-amber-50 font-semibold text-slate-950 dark:bg-amber-500/10 dark:text-slate-50";
  }

  return "";
}

function getVisibleColumns(sheet: V8WorkbookSheet) {
  return statementSheetConfigs[sheet.name]?.columns ?? Array.from({ length: sheet.columnCount }, (_, columnIndex) => columnIndex);
}

function isNumericCell(value: string) {
  const normalized = value.replace(/,/g, "").trim();

  if (!normalized) {
    return false;
  }

  return Number.isFinite(Number(normalized));
}

function formatCellValue(sheet: V8WorkbookSheet, columnIndex: number, value: string) {
  const config = statementSheetConfigs[sheet.name];

  if (!config?.roundedValueColumns.includes(columnIndex) || !isNumericCell(value)) {
    return value;
  }

  return Math.round(Number(value.replace(/,/g, "").trim())).toString();
}

function WorkbookSheetTable({ sheet }: { sheet: V8WorkbookSheet }) {
  const visibleColumns = getVisibleColumns(sheet);
  const config = statementSheetConfigs[sheet.name];

  return (
    <div className="overflow-hidden rounded-[1.35rem] border border-slate-200/80 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-slate-950/70 dark:shadow-[0_12px_32px_rgba(2,6,23,0.35)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 bg-slate-50/90 px-4 py-3 dark:border-white/10 dark:bg-slate-900/70">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Active sheet</p>
          <p className="mt-0.5 font-semibold text-slate-950 dark:text-slate-50">{sheet.name}</p>
        </div>
        <StatusPill label={`${sheet.rows.length} rows`} tone="neutral" />
      </div>
      <div className="max-h-[70vh] overflow-auto p-3 sm:p-4">
        <div className="overflow-hidden rounded-xl border border-slate-200/70 dark:border-white/10">
          <table className={cn(config?.fixed ? "w-full table-fixed" : "min-w-max", "text-left text-sm")}>
            <tbody>
              {sheet.rows.map((row, rowIndex) => {
                const tone = rowTone(row, rowIndex);

                return (
                  <tr key={`${sheet.name}-${rowIndex}`} className={cn("border-t border-slate-200/70 dark:border-white/10", rowClassName(tone))}>
                    {visibleColumns.map((columnIndex, visibleColumnIndex) => (
                      <td
                        key={`${sheet.name}-${rowIndex}-${columnIndex}`}
                        style={config?.widths?.[visibleColumnIndex] ? { width: config.widths[visibleColumnIndex] } : undefined}
                        className={cn(
                          "px-3.5 py-2.5 align-top whitespace-pre-wrap break-words",
                          visibleColumnIndex === 0 ? "font-medium" : "",
                          visibleColumnIndex === 0 && config?.fixed ? "w-[58%]" : "",
                          visibleColumnIndex > 0 && config?.fixed ? "text-right" : "",
                        )}
                      >
                        {formatCellValue(sheet, columnIndex, row[columnIndex] || "")}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SignatoryBlock({
  directors,
  auditors,
  footerNote,
}: {
  directors: V8FinancialModel["settings"]["directors"];
  auditors: V8FinancialModel["settings"]["auditors"];
  footerNote: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200/70 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-slate-900/70">
      <p className="text-xs uppercase tracking-[0.08em] text-slate-500">Configured signatories</p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="font-semibold text-slate-950 dark:text-slate-50">Auditors</p>
          {auditors.map((auditor) => (
            <div key={`${auditor.name}-${auditor.designation}`} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-950/70">
              <p className="font-medium">{auditor.firmName || auditor.name}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{auditor.designation}</p>
              {auditor.membershipNumber ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Membership: {auditor.membershipNumber}</p> : null}
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <p className="font-semibold text-slate-950 dark:text-slate-50">Directors</p>
          {directors.map((director) => (
            <div key={`${director.name}-${director.designation}`} className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-950/70">
              <p className="font-medium">{director.name}</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{director.designation}</p>
            </div>
          ))}
        </div>
      </div>
      {footerNote ? <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">{footerNote}</p> : null}
    </div>
  );
}

export function V8StatementsView({
  model,
  initialSheet,
  balanceSheetRows,
  profitAndLossRows,
  balanceSheetNotes,
  profitAndLossNotes,
}: {
  model: V8FinancialModel;
  initialSheet: V8WorkbookSheet;
  balanceSheetRows: StatementDisplayRow[];
  profitAndLossRows: StatementDisplayRow[];
  balanceSheetNotes: NoteOption[];
  profitAndLossNotes: NoteOption[];
}) {
  const searchParams = useSearchParams();
  const [activeSheet, setActiveSheet] = useState(initialSheet.name);
  const [loadedSheets, setLoadedSheets] = useState<Record<string, V8WorkbookSheet>>({
    [initialSheet.name]: initialSheet,
  });
  const [lineOverrides, setLineOverrides] = useState<
    Record<string, string>
  >({});
  const [draftLineOverrides, setDraftLineOverrides] = useState<
    Record<string, string>
  >({});
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const selectedSheet =
    loadedSheets[activeSheet] ??
    (initialSheet.name === activeSheet ? initialSheet : null);

  const query = searchParams.toString();

  const editableLines = useMemo<EditableStatementLine[]>(
    () => [
      ...balanceSheetRows
        .filter((row) => row.note)
        .map((row) => ({
          statementArea: "balance-sheet" as const,
          particulars: row.particulars,
          defaultNoteNumber: row.note ?? "",
        })),
      ...profitAndLossRows
        .filter((row) => row.note)
        .map((row) => ({
          statementArea: "profit-and-loss" as const,
          particulars: row.particulars,
          defaultNoteNumber: row.note ?? "",
        })),
    ],
    [balanceSheetRows, profitAndLossRows],
  );

  const statementOverrides = useMemo<StatementLineOverride[]>(
    () =>
      editableLines.map((line) => ({
        statementArea: line.statementArea,
        particulars: line.particulars,
        noteNumber:
          lineOverrides[`${line.statementArea}:${line.particulars}`] ??
          line.defaultNoteNumber,
      })),
    [editableLines, lineOverrides],
  );

  const statementOverrideToken = useMemo(
    () => serializeStatementLineOverrides(statementOverrides),
    [statementOverrides],
  );

  const exportQuery = useMemo(() => {
    const params = new URLSearchParams(query);
    if (statementOverrideToken) {
      params.set("statementOverrides", statementOverrideToken);
    } else {
      params.delete("statementOverrides");
    }
    return params.toString();
  }, [query, statementOverrideToken]);

  const loadSheet = (sheetName: string, forceReload = false) => {
    setActiveSheet(sheetName);

    if (!forceReload && loadedSheets[sheetName]) {
      return;
    }

    startTransition(async () => {
      const sheetQuery = new URLSearchParams(query);
      sheetQuery.set("name", sheetName);
      if (statementOverrideToken) {
        sheetQuery.set("statementOverrides", statementOverrideToken);
      } else {
        sheetQuery.delete("statementOverrides");
      }
      const response = await fetch(`/api/statements/sheet?${sheetQuery.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const sheet = (await response.json()) as V8WorkbookSheet;
      setLoadedSheets((current) => ({
        ...current,
        [sheet.name]: sheet,
      }));
    });
  };

  const statementSheetNames = new Set(["BS", "PL", "Cash Flow_FY26", "SOCIE"]);
  const editableSheetSection = useMemo(() => {
    if (activeSheet === "BS") {
      return {
        title: "Balance Sheet",
        statementArea: "balance-sheet" as const,
        rows: editableLines.filter((line) => line.statementArea === "balance-sheet"),
        options: balanceSheetNotes,
      };
    }

    if (activeSheet === "PL") {
      return {
        title: "Profit & Loss",
        statementArea: "profit-and-loss" as const,
        rows: editableLines.filter((line) => line.statementArea === "profit-and-loss"),
        options: profitAndLossNotes,
      };
    }

    return null;
  }, [activeSheet, balanceSheetNotes, editableLines, profitAndLossNotes]);

  useEffect(() => {
    setLoadedSheets((current) => {
      const next = { ...current };
      delete next.BS;
      delete next.PL;
      return next;
    });

    if (activeSheet === "BS" || activeSheet === "PL") {
      loadSheet(activeSheet, true);
    }
  }, [statementOverrideToken]);

  const updateDraftLineOverride = (
    statementArea: StatementOverrideArea,
    particulars: string,
    noteNumber: string,
  ) => {
    setDraftLineOverrides((current) => ({
      ...current,
      [`${statementArea}:${particulars}`]: noteNumber,
    }));
  };

  const openNoteEditor = () => {
    setDraftLineOverrides(lineOverrides);
    setIsNoteEditorOpen(true);
  };

  const closeNoteEditor = () => {
    setDraftLineOverrides(lineOverrides);
    setIsNoteEditorOpen(false);
  };

  const saveNoteOverrides = () => {
    setLineOverrides(draftLineOverrides);
    setIsNoteEditorOpen(false);
  };

  const resetDraftLineOverrides = () => {
    setDraftLineOverrides({});
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Exact workbook preview"
        title="Financial statement viewer"
        description="Browse the active V-8 workbook with controlled sheet navigation, direct export actions, and signatory context for issue-ready reporting."
        meta={
          <>
            <StatusPill label={`${model.sheets.length} workbook tabs`} tone="positive" />
            <StatusPill label={activeSheet} tone="neutral" />
          </>
        }
        action={
          <>
            <PortalButton
              variant="primary"
              href={`/api/exports/excel${exportQuery ? `?${exportQuery}` : ""}`}
              startIcon={<FileDown className="h-4 w-4" />}
            >
              Download Excel
            </PortalButton>
            <PortalButton
              variant="secondary"
              href={`/api/exports/pdf${exportQuery ? `?${exportQuery}` : ""}`}
              startIcon={<Printer className="h-4 w-4" />}
            >
              Download PDF
            </PortalButton>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <MiniStat label="Workbook source" value="Master Template" accent="blue" />
        <MiniStat label="Viewer mode" value="Report preview" accent="indigo" />
        <MiniStat label="Exports" value="Excel + PDF" accent="emerald" />
        <MiniStat label="Loaded sheets" value={`${Object.keys(loadedSheets).length}`} accent="amber" />
      </section>

      <SectionCard
        title="Financial Statements"
        eyebrow="Exact Master Template workbook view"
        action={
          editableSheetSection ? (
            <PortalButton
              type="button"
              variant="secondary"
              onClick={openNoteEditor}
            >
              Change Notes
            </PortalButton>
          ) : null
        }
      >
        <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start">
          <aside className="h-fit overflow-hidden rounded-[1.4rem] border border-slate-200/80 bg-gradient-to-b from-slate-50 to-white shadow-sm dark:border-white/10 dark:from-slate-900/80 dark:to-slate-950/80">
            <div className="border-b border-slate-200/70 px-5 py-4 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-500/12 dark:text-blue-300">
                  <BookOpen className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold text-slate-950 dark:text-slate-50">Workbook navigation</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{model.sheets.length} sheets available</p>
                </div>
              </div>
            </div>
            <nav className="max-h-[min(70vh,36rem)] space-y-2 overflow-y-auto p-4 sm:p-5">
              {model.sheets.map((sheet) => {
                const isActive = activeSheet === sheet.name;

                return (
                  <PortalButton
                    key={sheet.name}
                    variant="tab"
                    active={isActive}
                    type="button"
                    fullWidth
                    onClick={() => loadSheet(sheet.name)}
                    sx={{
                      borderRadius: "0.9rem",
                      justifyContent: "flex-start",
                      textAlign: "left",
                      textTransform: "none",
                      px: 1.75,
                      py: 1.35,
                      minHeight: 44,
                      boxShadow: "none",
                      lineHeight: 1.35,
                    }}
                  >
                    {sheet.name}
                  </PortalButton>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0 space-y-5">
            {isPending ? (
              <div className="rounded-[1.2rem] border border-dashed border-amber-300/80 bg-amber-50/70 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                Loading workbook tab...
              </div>
            ) : null}
            {selectedSheet ? <WorkbookSheetTable sheet={selectedSheet} /> : null}
            {selectedSheet && statementSheetNames.has(selectedSheet.name) ? (
              <SignatoryBlock
                directors={model.settings.directors}
                auditors={model.settings.auditors}
                footerNote={model.settings.footerNote}
              />
            ) : null}
          </div>
        </div>
      </SectionCard>

      {isNoteEditorOpen && editableSheetSection ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-4 py-6">
          <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950">
            <div className="border-b border-slate-200/70 px-5 py-4 dark:border-white/10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    Statement note editor
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-50">
                    {editableSheetSection.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Choose a different note for each line or clear the note to remove that line from statement totals before download.
                  </p>
                </div>
                <PortalButton type="button" variant="text" onClick={closeNoteEditor}>
                  Close
                </PortalButton>
              </div>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Particular</th>
                    <th className="px-4 py-3 font-semibold">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {editableSheetSection.rows.map((line) => {
                    const key = `${line.statementArea}:${line.particulars}`;
                    const currentNoteNumber =
                      draftLineOverrides[key] ?? line.defaultNoteNumber;

                    return (
                      <tr
                        key={key}
                        className="border-t border-slate-200/70 align-top dark:border-white/10"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                          {line.particulars}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={currentNoteNumber}
                            onChange={(event) =>
                              updateDraftLineOverride(
                                line.statementArea,
                                line.particulars,
                                event.target.value,
                              )
                            }
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                          >
                            <option value="">Remove from statement</option>
                            {editableSheetSection.options.map((option) => (
                              <option
                                key={`${editableSheetSection.statementArea}-${option.noteNumber}`}
                                value={option.noteNumber}
                              >
                                {`Note ${option.noteNumber} - ${option.title}`}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200/70 px-5 py-4 dark:border-white/10">
              <PortalButton
                type="button"
                variant="secondary"
                onClick={resetDraftLineOverrides}
              >
                Reset
              </PortalButton>
              <PortalButton type="button" variant="secondary" onClick={closeNoteEditor}>
                Cancel
              </PortalButton>
              <PortalButton type="button" variant="primary" onClick={saveNoteOverrides}>
                Save
              </PortalButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
