"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";

import { MiniStat, PageHeader, SectionCard, StatusPill } from "@/components/portal/cards";
import type { V8FinancialModel, V8WorkbookSheet } from "@/lib/v8-financials";
import { cn } from "@/lib/utils";
import { BookOpen, FileDown, Printer, ZoomIn } from "lucide-react";

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
  "BS  Notes  4-19": {
    columns: [0, 1, 2, 3],
    roundedValueColumns: [1, 2],
    widths: ["58%", "14%", "14%", "14%"],
    fixed: true,
  },
  "PL Notes 20-27": {
    columns: [0, 1, 2, 3],
    roundedValueColumns: [1, 2],
    widths: ["58%", "14%", "14%", "14%"],
    fixed: true,
  },
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
    <div className="space-y-4">
      <div className="rounded-[1.75rem] border border-slate-200/70 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-slate-900/70">
        <p className="text-sm uppercase tracking-[0.08em] text-slate-500">{sheet.name}</p>
      </div>

      <div className="overflow-auto rounded-2xl border border-slate-200/70 dark:border-white/10">
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
                        "px-3 py-2 align-top whitespace-pre-wrap break-words",
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
}: {
  model: V8FinancialModel;
  initialSheet: V8WorkbookSheet;
}) {
  const searchParams = useSearchParams();
  const [activeSheet, setActiveSheet] = useState(initialSheet.name);
  const [loadedSheets, setLoadedSheets] = useState<Record<string, V8WorkbookSheet>>({
    [initialSheet.name]: initialSheet,
  });
  const [isPending, startTransition] = useTransition();
  const selectedSheet = loadedSheets[activeSheet] ?? initialSheet;

  const query = searchParams.toString();

  const loadSheet = (sheetName: string) => {
    setActiveSheet(sheetName);

    if (loadedSheets[sheetName]) {
      return;
    }

    startTransition(async () => {
      const sheetQuery = new URLSearchParams(query);
      sheetQuery.set("name", sheetName);
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
            <a href={`/api/exports/excel${query ? `?${query}` : ""}`} className="portal-button-primary inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold">
              <FileDown className="h-4 w-4" />
              Download Excel
            </a>
            <a href={`/api/exports/pdf${query ? `?${query}` : ""}`} className="portal-button-secondary inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold">
              <Printer className="h-4 w-4" />
              Download PDF
            </a>
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
          <div className="flex flex-wrap gap-2">
            <StatusPill label={selectedSheet.name} tone="positive" />
            <StatusPill label={isPending ? "Loading tab" : "Ready"} tone={isPending ? "warning" : "neutral"} />
          </div>
        }
      >
        <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="rounded-[1.4rem] border border-slate-200/70 bg-slate-50/75 p-4 dark:border-white/10 dark:bg-slate-900/60">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                <p className="font-semibold text-slate-950 dark:text-slate-50">Workbook navigation</p>
              </div>
              <div className="mt-4 space-y-2">
                {model.sheets.map((sheet) => (
                  <button
                    key={sheet.name}
                    type="button"
                    onClick={() => loadSheet(sheet.name)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-[1rem] px-4 py-3 text-left text-sm font-medium transition",
                      activeSheet === sheet.name
                        ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/12 dark:text-blue-300 dark:ring-blue-500/20"
                        : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-slate-900",
                    )}
                  >
                    <span>{sheet.name}</span>
                    {activeSheet === sheet.name ? <ZoomIn className="h-4 w-4" /> : null}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {isPending ? <p className="text-sm text-slate-500 dark:text-slate-400">Loading workbook tab...</p> : null}
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
    </div>
  );
}
