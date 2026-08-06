import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx-js-style";

import type { ExcelExportContext, ExcelExportProfile } from "@/lib/export/excel/types";
import { applyXyzPackCellMap } from "@/lib/export/excel/profiles/xyz-pack-map";
import { getCompanySettings } from "@/lib/company-workspace";

const { read, utils, write } = XLSX;
type WorkBook = XLSX.WorkBook;
type WorkSheet = XLSX.WorkSheet;
type CellObject = XLSX.CellObject;

const XYZ_COMPANY_ID = "xyz";
const TEMPLATE_PATH = path.join(process.cwd(), "templates", "excel", "xyz-desired-structure.xlsx");

/**
 * Only these sheets are delivered in the XYZ statement workbook.
 * TB BVS source sheets are retained because statement and note formulas
 * depend on them. Master Grouping and other working / tax / draft tabs
 * remain excluded.
 */
const XYZ_SHEETS_TO_KEEP = [
  "Input",
  "TB BVS 31.03.26",
  "TB BVS 31.3.25",
  "TB BVS 31.3.23",
  "TB BVS 31.3.22",
  "BS",
  "PL",
  "Cash Flow_FY26",
  "SOCIE",
  "PPE- note 3",
  "BS  Notes  4-19",
  "PL Notes 20-27",
  "Note 28-31",
  "FI -32",
  "Ratios -33",
  "Note - 34-35",
  "Note -36",
  "Note - 40",
] as const;

function formatFinancialYearLabels(financialYear: string) {
  const match = financialYear.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return {
      current: "31 March 2026",
      previous: "31 March 2025",
      currentStart: "1 April 2025",
      previousStart: "1 April 2024",
      currentFy: financialYear || "2025-26",
      previousFy: "2024-25",
    };
  }

  const startYear = Number(match[1]);
  const currentYearEnd = startYear + 1;
  const previousYearEnd = currentYearEnd - 1;
  const previousStartYear = startYear - 1;

  return {
    current: `31 March ${currentYearEnd}`,
    previous: `31 March ${previousYearEnd}`,
    currentStart: `1 April ${startYear}`,
    previousStart: `1 April ${previousStartYear}`,
    currentFy: `${startYear}-${String(currentYearEnd).slice(-2)}`,
    previousFy: `${previousStartYear}-${String(previousYearEnd).slice(-2)}`,
  };
}

function setCell(sheet: WorkSheet, address: string, value: string | number) {
  const existing = (sheet[address] ?? {}) as CellObject;
  const next: CellObject = {
    ...existing,
    v: typeof value === "number" ? Math.round(value) : value,
    t: typeof value === "number" ? "n" : "s",
  };
  delete next.f;
  delete next.w;
  sheet[address] = next;
}

/** Collapse absurd sparse ranges and drop empty cells created by broken Excel used-ranges. */
function compactSheet(sheet: WorkSheet | undefined, maxColExclusive = 20) {
  if (!sheet) {
    return;
  }

  const addresses = Object.keys(sheet).filter((key) => !key.startsWith("!"));
  let maxRow = 0;
  let maxCol = 0;

  for (const address of addresses) {
    const decoded = utils.decode_cell(address);
    const cell = sheet[address] as CellObject | undefined;
    const empty =
      !cell ||
      (!cell.f &&
        (cell.t === "z" || cell.v === undefined || cell.v === null || cell.v === ""));

    if (decoded.c >= maxColExclusive || empty) {
      delete sheet[address];
      continue;
    }

    maxRow = Math.max(maxRow, decoded.r);
    maxCol = Math.max(maxCol, decoded.c);
  }

  if (Array.isArray(sheet["!merges"])) {
    sheet["!merges"] = sheet["!merges"].filter(
      (range) => range.e.c < maxColExclusive && range.s.c < maxColExclusive,
    );
    for (const range of sheet["!merges"]) {
      maxRow = Math.max(maxRow, range.e.r);
      maxCol = Math.max(maxCol, Math.min(range.e.c, maxColExclusive - 1));
    }
  }

  if (Array.isArray(sheet["!cols"])) {
    sheet["!cols"] = sheet["!cols"].slice(0, maxColExclusive);
  }

  sheet["!ref"] = utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(maxRow, 1), c: Math.max(maxCol, 1) },
  });
}

function compactWorkbook(workbook: WorkBook) {
  const limits: Record<string, number> = {
    Input: 12,
    BS: 8,
    PL: 8,
    "Cash Flow_FY26": 8,
    SOCIE: 12,
    "TB BVS 31.03.26": 32,
    "TB BVS 31.3.25": 20,
    "TB BVS 31.3.23": 18,
    "TB BVS 31.3.22": 16,
    "BS  Notes  4-19": 20,
    "PL Notes 20-27": 22,
    "PPE- note 3": 14,
    "Note 28-31": 20,
    "FI -32": 24,
    "Ratios -33": 20,
    "Note - 34-35": 20,
    "Note -36": 20,
    "Note - 40": 20,
  };

  workbook.SheetNames.forEach((name) => {
    compactSheet(workbook.Sheets[name], limits[name] ?? 24);
  });
}

/** Drop template review comments (e.g. duplicated author + "R/Off" on PL Notes). */
function stripCellComments(workbook: WorkBook) {
  workbook.SheetNames.forEach((name) => {
    const sheet = workbook.Sheets[name];
    if (!sheet) {
      return;
    }

    delete (sheet as WorkSheet & { "!comments"?: unknown })["!comments"];

    Object.keys(sheet)
      .filter((key) => !key.startsWith("!"))
      .forEach((address) => {
        const cell = sheet[address] as CellObject & { c?: unknown };
        if (cell && "c" in cell) {
          delete cell.c;
        }
      });
  });
}

function updateInputSheet(workbook: WorkBook, context: ExcelExportContext, dates: ReturnType<typeof formatFinancialYearLabels>) {
  const sheet = workbook.Sheets.Input;
  if (!sheet) {
    return;
  }

  setCell(sheet, "B1", context.companyName);
  setCell(sheet, "C4", dates.current);
  setCell(sheet, "D4", dates.currentStart);
  setCell(sheet, "C5", dates.previous);
  setCell(sheet, "D5", dates.previousStart);
  setCell(sheet, "H4", dates.currentFy);
  setCell(sheet, "H5", dates.previousFy);
  // Force whole-number presentation (no decimals).
  setCell(sheet, "E2", 0);
}

function updateStatementTitles(workbook: WorkBook, dates: ReturnType<typeof formatFinancialYearLabels>, companyName: string) {
  const bs = workbook.Sheets.BS;
  if (bs) {
    setCell(bs, "A2", `Balance Sheet as at ${dates.current}`);
    setCell(bs, "D5", dates.current);
    setCell(bs, "E5", dates.previous);
  }

  const pl = workbook.Sheets.PL;
  if (pl) {
    setCell(pl, "A2", `Statement of Profit and Loss for the Year Ended ${dates.current}`);
  }

  const cashFlow = workbook.Sheets["Cash Flow_FY26"];
  if (cashFlow) {
    setCell(cashFlow, "A2", `Statement of Cash Flows for the Year Ended ${dates.current}`);
  }

  const socie = workbook.Sheets.SOCIE;
  if (socie) {
    setCell(socie, "A1", companyName);
  }
}

function updateSignatories(workbook: WorkBook, context: ExcelExportContext) {
  const settings = getCompanySettings(context.companyId);
  const sheet = workbook.Sheets.BS;
  if (!sheet) {
    return;
  }

  const auditor = settings.auditors[0];
  const directorA = settings.directors[0];
  const directorB = settings.directors[1];

  if (auditor) {
    setCell(sheet, "A66", auditor.firmName ? `For ${auditor.firmName}` : `For ${auditor.name}`);
    setCell(sheet, "A67", auditor.designation || "Chartered Accountants");
    if (auditor.membershipNumber) {
      setCell(sheet, "A68", auditor.membershipNumber);
    }
    setCell(sheet, "A71", auditor.name);
    setCell(sheet, "A72", "Partner");
  }

  setCell(sheet, "D66", "For and on behalf of Board of");
  setCell(sheet, "D67", context.companyName);

  if (directorA) {
    setCell(sheet, "D71", directorA.name);
    setCell(sheet, "D72", directorA.designation || "Director");
  }
  if (directorB) {
    setCell(sheet, "E71", directorB.name);
    setCell(sheet, "E72", directorB.designation || "Director");
  }
}

function keepOnlySheets(workbook: WorkBook, sheetNames: readonly string[]) {
  const keepOrder = sheetNames.filter((name) => Boolean(workbook.Sheets[name]));
  const keepSet = new Set(keepOrder);

  workbook.SheetNames.forEach((name) => {
    if (!keepSet.has(name)) {
      delete workbook.Sheets[name];
    }
  });

  workbook.SheetNames = [...keepOrder];

  // Drop defined names that pointed at removed working sheets (avoids Excel repair drops).
  const workbookMeta = workbook as WorkBook & {
    Workbook?: {
      Names?: Array<{ Name?: string; Ref?: string; Sheet?: number }>;
      Sheets?: Array<{ name?: string; Hidden?: number }>;
      CalcPr?: {
        calcId: string;
        fullCalcOnLoad: boolean;
        forceFullCalc: boolean;
      };
    };
  };

  workbookMeta.Workbook = workbookMeta.Workbook ?? {};
  // Clear defined names — many point at removed working/TB sheets by index and
  // cause Excel repair warnings that can hide or drop legitimate note sheets.
  workbookMeta.Workbook.Names = [];

  // Force remaining tabs visible in a stable order (template hides Input / many workings).
  workbookMeta.Workbook.Sheets = keepOrder.map((name) => ({ name, Hidden: 0 as const }));
}

function roundNumericCells(workbook: WorkBook) {
  const wholeNumberSheets = [
    "BS",
    "PL",
    "Cash Flow_FY26",
    "SOCIE",
    "BS  Notes  4-19",
    "PL Notes 20-27",
    "PPE- note 3",
    "Note 28-31",
    "FI -32",
    "Note - 34-35",
    "Note -36",
    "Note - 40",
    "Input",
  ];
  const twoDecimalSheets = ["Ratios -33"];

  const roundSheet = (name: string, decimals: number, numberFormat: string) => {
    const sheet = workbook.Sheets[name];
    if (!sheet) {
      return;
    }

    const factor = 10 ** decimals;
    Object.keys(sheet)
      .filter((key) => !key.startsWith("!"))
      .forEach((address) => {
        const cell = sheet[address] as CellObject | undefined;
        if (!cell || typeof cell.v !== "number" || Number.isNaN(cell.v)) {
          return;
        }
        cell.v = Math.round(cell.v * factor) / factor;
        cell.t = "n";
        cell.z = numberFormat;
        delete cell.w;
      });
  };

  wholeNumberSheets.forEach((name) => roundSheet(name, 0, "#,##0;(#,##0);-"));
  twoDecimalSheets.forEach((name) => roundSheet(name, 2, "#,##0.00;(#,##0.00);-"));
}

function enableFullCalcOnLoad(workbook: WorkBook) {
  const workbookWithCalc = workbook as WorkBook & {
    Workbook?: {
      CalcPr?: {
        calcId: string;
        fullCalcOnLoad: boolean;
        forceFullCalc: boolean;
      };
    };
  };

  workbookWithCalc.Workbook = workbookWithCalc.Workbook ?? {};
  workbookWithCalc.Workbook.CalcPr = {
    calcId: "0",
    fullCalcOnLoad: true,
    forceFullCalc: true,
  };
}

export function buildXyzStatementWorkbook(context: ExcelExportContext): Buffer {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`XYZ Excel template not found at ${TEMPLATE_PATH}`);
  }

  const workbook = read(fs.readFileSync(TEMPLATE_PATH), {
    type: "buffer",
    // Keep template styles off on read to avoid SheetJS sparse-style bloat.
    cellStyles: false,
    cellFormula: true,
  });

  const dates = formatFinancialYearLabels(context.financialYear);

  // Keep statement sheets first so PPE / BS Notes cannot be lost among working tabs.
  keepOnlySheets(workbook, XYZ_SHEETS_TO_KEEP);

  const missingRequired = XYZ_SHEETS_TO_KEEP.filter((name) => !workbook.Sheets[name]);
  if (missingRequired.length > 0) {
    throw new Error(
      `XYZ template is missing required sheets: ${missingRequired.join(", ")}. Expected at ${TEMPLATE_PATH}`,
    );
  }

  updateInputSheet(workbook, context, dates);
  updateStatementTitles(workbook, dates, context.companyName);
  updateSignatories(workbook, context);

  // Option B: push StatementPack totals into mapped XYZ BS/PL/Notes/PPE/Cash Flow cells.
  applyXyzPackCellMap(workbook, context.pack);

  compactWorkbook(workbook);
  stripCellComments(workbook);
  roundNumericCells(workbook);
  enableFullCalcOnLoad(workbook);

  return Buffer.from(write(workbook, { type: "buffer", bookType: "xlsx", cellStyles: true }));
}

/**
 * XYZ company Excel layout.
 * Selected automatically for company id `xyz` — no excelProfileId required.
 */
export const xyzExcelProfile: ExcelExportProfile = {
  id: "xyz-desired-structure",
  label: "XYZ desired statement workbook",
  companyIds: [XYZ_COMPANY_ID],
  build: buildXyzStatementWorkbook,
  fileName: (context) => {
    const safeName = context.companyName.replace(/[^\w.-]+/g, "_");
    return `${safeName}_${context.financialYear}_Financial_Statements.xlsx`;
  },
};
