import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx-js-style";

import type { ExcelExportContext, ExcelExportProfile } from "@/lib/export/excel/types";
import { applyLtelPackCellMap } from "@/lib/export/excel/profiles/ltel-pack-map";
import { getCompanySettings } from "@/lib/company-workspace";

const { read, utils, write } = XLSX;
type WorkBook = XLSX.WorkBook;
type WorkSheet = XLSX.WorkSheet;
type CellObject = XLSX.CellObject;

const LTEL_COMPANY_ID = "ltel";
const TEMPLATE_PATH = path.join(process.cwd(), "templates", "excel", "ltel-desired-structure.xlsx");

/**
 * Deliver the full LTEL desired statement workbook (all template tabs).
 * Sheet names with leading spaces (e.g. " 2") are intentional template names.
 */
const LTEL_SHEETS_TO_KEEP = [
  "BS",
  "PL",
  "SOCE",
  "CashFlow",
  " 2",
  "3 CWIP",
  " 4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "15a",
  "16",
  "17",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27 Ratios",
  "Note 28 to 43",
] as const;

function formatFinancialYearLabels(financialYear: string) {
  const match = financialYear.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return {
      current: "March 31, 2026",
      previous: "March 31, 2025",
      currentStart: "01 April 2025",
      previousStart: "01 April 2024",
      currentFy: financialYear || "2025-26",
      previousFy: "2024-25",
    };
  }

  const startYear = Number(match[1]);
  const currentYearEnd = startYear + 1;
  const previousYearEnd = currentYearEnd - 1;
  const previousStartYear = startYear - 1;

  return {
    current: `March 31, ${currentYearEnd}`,
    previous: `March 31, ${previousYearEnd}`,
    currentStart: `01 April ${startYear}`,
    previousStart: `01 April ${previousStartYear}`,
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
    BS: 10,
    PL: 10,
    SOCE: 14,
    CashFlow: 8,
    " 2": 14,
    "3 CWIP": 10,
    " 4": 14,
    "27 Ratios": 14,
    "Note 28 to 43": 12,
  };

  workbook.SheetNames.forEach((name) => {
    compactSheet(workbook.Sheets[name], limits[name] ?? 8);
  });
}

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

function keepOnlySheets(workbook: WorkBook, sheetNames: readonly string[]) {
  const keepOrder = sheetNames.filter((name) => Boolean(workbook.Sheets[name]));
  const keepSet = new Set(keepOrder);

  workbook.SheetNames.forEach((name) => {
    if (!keepSet.has(name)) {
      delete workbook.Sheets[name];
    }
  });

  workbook.SheetNames = [...keepOrder];

  const workbookMeta = workbook as WorkBook & {
    Workbook?: {
      Names?: Array<{ Name?: string; Ref?: string; Sheet?: number }>;
      Sheets?: Array<{ name?: string; Hidden?: number }>;
    };
  };

  workbookMeta.Workbook = workbookMeta.Workbook ?? {};
  workbookMeta.Workbook.Names = [];
  workbookMeta.Workbook.Sheets = keepOrder.map((name) => ({ name, Hidden: 0 as const }));
}

function updateTitlesAndUnits(
  workbook: WorkBook,
  context: ExcelExportContext,
  dates: ReturnType<typeof formatFinancialYearLabels>,
) {
  const settings = getCompanySettings(context.companyId);
  const units = settings.unitsLabel || "(Rs. in lakhs)";

  const bs = workbook.Sheets.BS;
  if (bs) {
    setCell(bs, "A1", context.companyName);
    setCell(bs, "A2", `Balance sheet as at ${dates.current}`);
    setCell(bs, "H4", units);
    setCell(bs, "E5", `As at ${dates.current}`);
    setCell(bs, "G5", `As at ${dates.previous}`);
  }

  const pl = workbook.Sheets.PL;
  if (pl) {
    setCell(pl, "A1", context.companyName);
    setCell(pl, "A2", `Statement of profit and loss for the year ended ${dates.current}`);
    setCell(pl, "D4", `Year ended \n${dates.current}`);
    setCell(pl, "F4", `Year ended \n${dates.previous}`);
  }

  const cashFlow = workbook.Sheets.CashFlow;
  if (cashFlow) {
    setCell(cashFlow, "B1", context.companyName);
    setCell(cashFlow, "B2", `Cash Flow Statement for the year ended ${dates.current}`);
    setCell(cashFlow, "D3", units);
    setCell(cashFlow, "C4", `Year ended ${dates.current}`);
    setCell(cashFlow, "D4", `Year ended ${dates.previous}`);
  }

  const soce = workbook.Sheets.SOCE;
  if (soce) {
    setCell(soce, "A1", context.companyName);
    setCell(soce, "A2", `Statement of changes in equity for the year ended ${dates.current}`);
  }

  // Note sheets: company name on A1 when present.
  workbook.SheetNames.forEach((name) => {
    if (["BS", "PL", "SOCE", "CashFlow"].includes(name)) {
      return;
    }
    const sheet = workbook.Sheets[name];
    if (!sheet) {
      return;
    }
    const a1 = sheet.A1 as CellObject | undefined;
    if (a1 && typeof a1.v === "string" && /electrolysers|limited|l&t/i.test(a1.v)) {
      setCell(sheet, "A1", context.companyName);
    }
  });
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

  setCell(sheet, "E53", "For and on behalf of the Board of Directors of");
  setCell(sheet, "E54", context.companyName);

  if (auditor) {
    setCell(sheet, "A54", auditor.firmName || auditor.name);
    setCell(sheet, "A55", auditor.designation || "Chartered Accountants");
    if (auditor.membershipNumber) {
      setCell(sheet, "A56", auditor.membershipNumber.startsWith("Firm")
        ? auditor.membershipNumber
        : `Firm's registration no. / ${auditor.membershipNumber}`);
    }
    setCell(sheet, "A60", auditor.name);
    setCell(sheet, "A61", "Partner");
  }

  if (directorA) {
    setCell(sheet, "E60", directorA.name);
    setCell(sheet, "E61", directorA.designation || "Director");
  }
  if (directorB) {
    setCell(sheet, "G60", directorB.name);
    setCell(sheet, "G61", directorB.designation || "Director");
  }
}

function roundNumericCells(workbook: WorkBook) {
  const twoDecimalSheets = new Set(["27 Ratios"]);

  workbook.SheetNames.forEach((name) => {
    const sheet = workbook.Sheets[name];
    if (!sheet) {
      return;
    }

    const decimals = twoDecimalSheets.has(name) ? 2 : 0;
    const numberFormat = decimals === 0 ? "#,##0;(#,##0);-" : "#,##0.00;(#,##0.00);-";
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
  });
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

export function buildLtelStatementWorkbook(context: ExcelExportContext): Buffer {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`LTEL Excel template not found at ${TEMPLATE_PATH}`);
  }

  const workbook = read(fs.readFileSync(TEMPLATE_PATH), {
    type: "buffer",
    cellStyles: false,
    cellFormula: true,
  });

  const dates = formatFinancialYearLabels(context.financialYear);

  keepOnlySheets(workbook, LTEL_SHEETS_TO_KEEP);

  const missingRequired = LTEL_SHEETS_TO_KEEP.filter((name) => !workbook.Sheets[name]);
  if (missingRequired.length > 0) {
    throw new Error(
      `LTEL template is missing required sheets: ${missingRequired.join(", ")}. Expected at ${TEMPLATE_PATH}`,
    );
  }

  updateTitlesAndUnits(workbook, context, dates);
  updateSignatories(workbook, context);
  applyLtelPackCellMap(workbook, context.pack);

  compactWorkbook(workbook);
  stripCellComments(workbook);
  roundNumericCells(workbook);
  enableFullCalcOnLoad(workbook);

  return Buffer.from(write(workbook, { type: "buffer", bookType: "xlsx", cellStyles: true }));
}

/**
 * LTEL company Excel layout.
 * Selected automatically for company id `ltel` — no excelProfileId required.
 */
export const ltelExcelProfile: ExcelExportProfile = {
  id: "ltel-desired-structure",
  label: "LTEL desired statement workbook",
  companyIds: [LTEL_COMPANY_ID],
  build: buildLtelStatementWorkbook,
  fileName: (context) => {
    const safeName = context.companyName.replace(/[^\w.-]+/g, "_");
    return `${safeName}_${context.financialYear}_Financial_Statements.xlsx`;
  },
};
