import fs from "node:fs";
import path from "node:path";

import {
  read,
  utils,
  write,
  type CellObject,
  type WorkBook,
  type WorkSheet,
} from "xlsx";
import { getStatementPack, hasStatementValue, type CashFlowRow, type NoteSchedule, type StatementDisplayRow } from "@/lib/statement-pack";
import {
  normalizeStatementLineOverrides,
  serializeStatementLineOverrides,
  type StatementLineOverride,
} from "@/lib/statement-line-overrides";
import { getTrialBalanceSnapshot, type LedgerRow } from "@/lib/trial-balance";
import {
  getCompanySettings,
  getCompanySlug,
  getCompanyVersionPaths,
  getSharedStatementWorkbookPath,
  requireActiveCompany,
  resolveWorkspaceContext,
  type CompanySettings,
} from "@/lib/company-workspace";
import { applyFixedAssetSchedulesToWorkbook } from "@/lib/fixed-assets";

const workbookSheetOrder = [
  "README",
  "BS",
  "PL",
  "Cash Flow_FY26",
  "SOCIE",
  "PPE- note 3",
  "BS Notes 3-18",
  "PL Notes 19-27",
  "Note 28-31",
  "FI -32",
  "Ratios -33",
  "Note - 34-35",
  "Note -36",
  "Note - 40",
] as const;

export type V8WorkbookSheet = {
  name: string;
  rows: string[][];
  columnCount: number;
};

export type V8WorkbookSheetSummary = {
  name: string;
  rowCount: number;
  columnCount: number;
};

export type V8FinancialModel = {
  entityName: string;
  workbookName: string;
  workbookPath: string;
  generatedAt: string;
  sheets: V8WorkbookSheetSummary[];
  settings: CompanySettings;
};

type CachedWorkbook = {
  mtimeMs: number;
  buffer: Buffer;
  model: V8FinancialModel;
  sheetNames: string[];
};

type DerivedWorkbookResult = {
  buffer: Buffer;
  model: V8FinancialModel;
  detailedSheets: V8WorkbookSheet[];
};

type CachedDerivedWorkbook = {
  dependencyStamp: string;
  value: DerivedWorkbookResult;
};

type WorkbookScope = {
  companyId?: number;
  versionId?: string;
  statementLineOverrides?: StatementLineOverride[];
};

const cachedWorkbook: Record<string, CachedWorkbook> = {};
const cachedDerivedWorkbook: Record<string, CachedDerivedWorkbook> = {};

function formatAmount(value?: number) {
  if (value === undefined || Math.abs(value) < 0.000001) {
    return "-";
  }

  return Math.round(value).toLocaleString("en-IN");
}

function getReportingDateLabels(financialYear: string) {
  const match = financialYear.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return {
      current: "31 March 2026",
      previous: "31 March 2025",
    };
  }

  const endYear = Number(`20${match[2]}`) > 1900 ? Number(`20${match[2]}`) : Number(match[1]) + 1;
  const previousYear = endYear - 1;

  return {
    current: `31 March ${endYear}`,
    previous: `31 March ${previousYear}`,
  };
}

function sheetWithWidths(rows: string[][], widths: number[]) {
  const sheet = utils.aoa_to_sheet(rows);
  sheet["!cols"] = widths.map((width) => ({ wch: width }));
  return sheet;
}

function replaceWorkbookSheet(
  workbook: WorkBook,
  oldName: string,
  newName: string,
  sheet: WorkSheet,
) {
  workbook.Sheets[newName] = sheet;

  if (oldName !== newName) {
    delete workbook.Sheets[oldName];
  }

  workbook.SheetNames = workbook.SheetNames.map((sheetName) =>
    sheetName === oldName ? newName : sheetName,
  );

  if (!workbook.SheetNames.includes(newName)) {
    workbook.SheetNames.push(newName);
  }
}

function expandWorkbookRows(workbook: WorkBook) {
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet?.["!rows"]) {
      return;
    }

    sheet["!rows"] = sheet["!rows"].map((row) => {
      if (!row) {
        return row;
      }

      return {
        ...row,
        hidden: false,
        level: 0,
        hpx: row.hpx === 0 ? undefined : row.hpx,
        hpt: row.hpt === 0 ? undefined : row.hpt,
      };
    });

    delete (sheet as WorkSheet & { "!outline"?: unknown })["!outline"];
  });
}

function buildStatementRows(
  companyName: string,
  title: string,
  currentDateLabel: string,
  previousDateLabel: string,
  rows: StatementDisplayRow[],
) {
  return [
    [companyName, "", "", ""],
    [title, "", "", "(₹ in Lakh)"],
    ["", "", "", ""],
    ["Particulars", "Note", "As at", "As at"],
    ["", "", currentDateLabel, previousDateLabel],
    ...rows.map((row) => [
      row.particulars,
      row.note ?? "",
      formatAmount(row.current),
      formatAmount(row.previous),
    ]),
  ];
}

function buildCashFlowRows(
  companyName: string,
  title: string,
  currentDateLabel: string,
  previousDateLabel: string,
  rows: CashFlowRow[],
) {
  return [
    [companyName, "", ""],
    [title, "", "(₹ in Lakh)"],
    ["", "", ""],
    ["Particulars", "For the year ended", "For the year ended"],
    ["", currentDateLabel, previousDateLabel],
    ...rows.filter(hasStatementValue).map((row) => [row.particulars, formatAmount(row.current), formatAmount(row.previous)]),
  ];
}

function buildNoteRows(
  companyName: string,
  heading: string,
  currentDateLabel: string,
  previousDateLabel: string,
  notes: NoteSchedule[],
) {
  const rows: string[][] = [
    [companyName, "", "", ""],
    [heading, "", "", "(₹ in Lakh)"],
    ["", "", "", ""],
    ["Particulars", "For the year ended", "For the year ended", "Ledger Reference"],
    ["", currentDateLabel, previousDateLabel, ""],
  ];

  for (const note of notes) {
    rows.push(["", "", "", ""]);
    rows.push([`Note ${note.noteNumber}`, "", "", ""]);
    rows.push([note.title.toUpperCase(), "", "", ""]);

    if (note.kind === "text") {
      for (const paragraph of note.paragraphs ?? []) {
        rows.push([paragraph, "", "", ""]);
      }
      continue;
    }

    for (const noteRow of note.rows ?? []) {
      rows.push([
        noteRow.particulars,
        formatAmount(noteRow.current),
        formatAmount(noteRow.previous),
        noteRow.ledgerReference ?? "",
      ]);
    }

    rows.push(["Total", formatAmount(note.totalCurrent), formatAmount(note.totalPrevious), ""]);
  }

  return rows;
}

function getFileStamp(filePath: string) {
  try {
    const stats = fs.statSync(filePath);
    return `${filePath}:${stats.mtimeMs}:${stats.size}`;
  } catch {
    return `${filePath}:missing`;
  }
}

function getDerivedWorkbookDependencyStamp(scope: {
  companyId: number;
  versionId: string;
}) {
  const versionPaths = getCompanyVersionPaths(scope.companyId, scope.versionId);
  const companyRoot = path.join(process.cwd(), "data", "companies", getCompanySlug(scope.companyId));

  return [
    getFileStamp(versionPaths.statementWorkbookPath),
    getFileStamp(path.join(versionPaths.versionDirectory, "ratio-ledger-config.json")),
    getFileStamp(path.join(versionPaths.versionDirectory, "fixed-asset-register.json")),
    getFileStamp(path.join(companyRoot, "settings.json")),
    getFileStamp(path.join(companyRoot, "versions", "index.json")),
  ].join("|");
}

async function buildDerivedWorkbook(scope?: WorkbookScope) {
  const resolvedScope = resolveWorkbookScope(scope);
  const overrideSignature = serializeStatementLineOverrides(
    resolvedScope.statementLineOverrides,
  );
  const cacheKey = `${resolvedScope.companyId}:${resolvedScope.versionId}:${overrideSignature}`;
  const context = requireActiveCompany(
    resolveWorkspaceContext({
      companyId: resolvedScope.companyId,
      versionId: resolvedScope.versionId,
    }),
  );
  const pack = await getStatementPack(resolvedScope);
  const snapshot = await getTrialBalanceSnapshot(resolvedScope);
  const ledgerStamp = snapshot.rows
    .map((row) => `${row.glNumber}:${row.currentYear}:${row.previousYear}:${row.groupingKey}:${row.subgroupKey}`)
    .join("|");
  const dependencyStamp = [
    getDerivedWorkbookDependencyStamp({
      companyId: resolvedScope.companyId!,
      versionId: resolvedScope.versionId!,
    }),
    snapshot.lastModified,
    String(snapshot.rowCount),
    snapshot.sourcePath,
    ledgerStamp,
    overrideSignature,
  ].join("|");

  if (cachedDerivedWorkbook[cacheKey]?.dependencyStamp === dependencyStamp) {
    return cachedDerivedWorkbook[cacheKey].value;
  }

  const raw = readWorkbookFile(getTemplateWorkbookPath(), `template:${cacheKey}`);
  const workbook = read(Buffer.from(raw.buffer), { type: "buffer" });
  const companyName = context.company.name;
  const reportingDates = getReportingDateLabels(context.currentVersion.financialYear);
  const bsNotes = pack.notes.filter((note) => note.statementArea === "balance-sheet");
  const plNotes = pack.notes.filter((note) => note.statementArea === "profit-and-loss");

  applyFixedAssetSchedulesToWorkbook(workbook, resolvedScope);

  workbook.Sheets.BS = sheetWithWidths(
    buildStatementRows(companyName, `Balance Sheet as at ${reportingDates.current}`, reportingDates.current, reportingDates.previous, pack.balanceSheet.rows),
    [56, 10, 16, 16],
  );
  workbook.Sheets.PL = sheetWithWidths(
    buildStatementRows(
      companyName,
      `Statement of Profit and Loss for the Year Ended ${reportingDates.current}`,
      reportingDates.current,
      reportingDates.previous,
      pack.profitAndLoss.rows,
    ),
    [56, 10, 16, 16],
  );
  workbook.Sheets["Cash Flow_FY26"] = sheetWithWidths(
    buildCashFlowRows(
      companyName,
      `Statement of Cash Flows for the Year Ended ${reportingDates.current}`,
      reportingDates.current,
      reportingDates.previous,
      pack.cashFlow.rows,
    ),
    [72, 16, 16],
  );
  replaceWorkbookSheet(
    workbook,
    "BS  Notes  4-19",
    "BS Notes 3-18",
    sheetWithWidths(
      buildNoteRows(companyName, `Notes to Financial Statements for the year ended ${reportingDates.current}`, reportingDates.current, reportingDates.previous, bsNotes),
      [64, 16, 16, 18],
    ),
  );
  replaceWorkbookSheet(
    workbook,
    "PL Notes 20-27",
    "PL Notes 19-27",
    sheetWithWidths(
      buildNoteRows(
        companyName,
        `Notes to Financial Statements for the year ended ${reportingDates.current}`,
        reportingDates.current,
        reportingDates.previous,
        plNotes,
      ),
      [64, 16, 16, 18],
    ),
  );
  expandWorkbookRows(workbook);

  const detailedSheets = workbookSheetOrder
    .map((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        return null;
      }

      const rows = extractSheetRows(worksheet);
      const columnCount = rows.reduce((largest, row) => Math.max(largest, row.length), 0);

      return {
        name: sheetName,
        rows,
        columnCount,
      } satisfies V8WorkbookSheet;
    })
    .filter(isPresent);

  const buffer = write(workbook, { type: "buffer", bookType: "xlsx" });

  const model: V8FinancialModel = {
    entityName: companyName,
    workbookName: path.basename(getTemplateWorkbookPath()),
    workbookPath: getTemplateWorkbookPath(),
    generatedAt: raw.model.generatedAt,
    settings: getCompanySettings(resolvedScope.companyId!),
    sheets: detailedSheets.map((sheet) => ({
      name: sheet.name,
      rowCount: sheet.rows.length,
      columnCount: sheet.columnCount,
    })),
  };

  const result = {
    buffer,
    model,
    detailedSheets,
  };

  cachedDerivedWorkbook[cacheKey] = {
    dependencyStamp,
    value: result,
  };

  return result;
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function resolveWorkbookScope(scope?: WorkbookScope) {
  if (scope?.companyId && scope?.versionId) {
    return {
      ...scope,
      statementLineOverrides: normalizeStatementLineOverrides(
        scope.statementLineOverrides,
      ),
    };
  }

  const context = requireActiveCompany(resolveWorkspaceContext());
  return {
    companyId: context.company.id,
    versionId: context.currentVersion.id,
    statementLineOverrides: normalizeStatementLineOverrides(
      scope?.statementLineOverrides,
    ),
  };
}

function getTemplateWorkbookPath() {
  return getSharedStatementWorkbookPath();
}

function getUploadedWorkbookPath(scope?: WorkbookScope) {
  const resolvedScope = resolveWorkbookScope(scope);
  return getCompanyVersionPaths(resolvedScope.companyId!, resolvedScope.versionId!).statementWorkbookPath;
}

function toCellText(cell: CellObject | undefined) {
  if (!cell) {
    return "";
  }

  const value = cell.w ?? cell.v;
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).replace(/\r/g, "").trim();
}

function extractSheetRows(worksheet: WorkSheet): V8WorkbookSheet["rows"] {
  const cells = Object.entries(worksheet)
    .filter(([address]) => !address.startsWith("!"))
    .map(([address, cell]) => {
      const decoded = utils.decode_cell(address);
      const value = toCellText(cell as CellObject);
      return {
        row: decoded.r,
        column: decoded.c,
        value,
      };
    })
    .filter((entry) => entry.value !== "");

  if (cells.length === 0) {
    return [];
  }

  const maxRow = cells.reduce((largest, entry) => Math.max(largest, entry.row), 0);
  const maxColumn = cells.reduce((largest, entry) => Math.max(largest, entry.column), 0);
  const lookup = new Map(cells.map((entry) => [`${entry.row}:${entry.column}`, entry.value]));

  return Array.from({ length: maxRow + 1 }, (_, rowIndex) =>
    Array.from({ length: maxColumn + 1 }, (_, columnIndex) => lookup.get(`${rowIndex}:${columnIndex}`) ?? ""),
  );
}

function readWorkbookFile(workbookPath: string, cacheKey: string) {
  const stats = fs.statSync(workbookPath);

  if (cachedWorkbook[cacheKey]?.mtimeMs === stats.mtimeMs) {
    return cachedWorkbook[cacheKey];
  }

  const buffer = fs.readFileSync(workbookPath);
  const workbook = read(buffer, { type: "buffer" });
  const sheetNames = [...workbook.SheetNames];
  const detailedSheets = workbookSheetOrder
    .map((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        return null;
      }

      const rows = extractSheetRows(worksheet);
      const columnCount = rows.reduce((largest, row) => Math.max(largest, row.length), 0);

      return {
        name: sheetName,
        rows,
        columnCount,
      } satisfies V8WorkbookSheet;
    })
    .filter(isPresent);

  const model: V8FinancialModel = {
    entityName: detailedSheets[1]?.rows[0]?.[0] ?? "V-8 Financial Statements",
    workbookName: path.basename(workbookPath),
    workbookPath,
    generatedAt: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(stats.mtime),
    settings: defaultCompanySettings(),
    sheets: detailedSheets.map((sheet) => ({
      name: sheet.name,
      rowCount: sheet.rows.length,
      columnCount: sheet.columnCount,
    })),
  };

  cachedWorkbook[cacheKey] = {
    mtimeMs: stats.mtimeMs,
    buffer,
    model,
    sheetNames,
  };

  return cachedWorkbook[cacheKey];
}

function hasCustomWorkbookLayout(scope?: WorkbookScope) {
  const resolvedScope = resolveWorkbookScope(scope);
  const { sheetNames } = readWorkbookFile(getUploadedWorkbookPath(resolvedScope), `uploaded:${resolvedScope.companyId}:${resolvedScope.versionId}`);
  const normalized = new Set(sheetNames.map((name) => name.trim().toUpperCase()));

  return normalized.has("SOCE") || normalized.has("CASHFLOW") || !normalized.has("SOCIE") || !normalized.has("CASH FLOW_FY26");
}

function defaultCompanySettings() {
  return {
    reportingCurrency: "INR",
    unitsLabel: "Rs. in lakhs",
    directors: [],
    auditors: [],
    footerNote: "",
  } satisfies CompanySettings;
}

export async function buildV8FinancialModel(scope?: WorkbookScope) {
  return (await buildDerivedWorkbook(scope)).model;
}

export async function getV8WorkbookBuffer(scope?: WorkbookScope) {
  return (await buildDerivedWorkbook(scope)).buffer;
}

export function getUploadedWorkbookBuffer(scope?: WorkbookScope) {
  const resolvedScope = resolveWorkbookScope(scope);
  return readWorkbookFile(getUploadedWorkbookPath(resolvedScope), `uploaded:${resolvedScope.companyId}:${resolvedScope.versionId}`).buffer;
}

export function shouldPreserveUploadedWorkbookLayout(scope?: WorkbookScope) {
  return hasCustomWorkbookLayout(scope);
}

export async function getV8WorkbookSheet(name: string, scope?: WorkbookScope) {
  return (await buildDerivedWorkbook(scope)).detailedSheets.find((sheet) => sheet.name === name) ?? null;
}
