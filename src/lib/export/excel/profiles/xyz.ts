import fs from "node:fs";
import path from "node:path";
import { read, utils, write, type CellObject, type WorkBook, type WorkSheet } from "xlsx";

import type { ExcelExportContext, ExcelExportProfile } from "@/lib/export/excel/types";
import { getCompanySettings } from "@/lib/company-workspace";
import type { LedgerRow } from "@/lib/trial-balance";

const XYZ_COMPANY_ID = "xyz";
const TEMPLATE_PATH = path.join(process.cwd(), "templates", "excel", "xyz-desired-structure.xlsx");

const CURRENT_TB_SHEET = "TB BVS 31.03.26";
const PREVIOUS_TB_SHEET = "TB BVS 31.3.25";

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
    v: value,
    t: typeof value === "number" ? "n" : "s",
  };
  delete next.f;
  delete next.w;
  sheet[address] = next;
}

function clearFormulaKeepValue(sheet: WorkSheet, address: string, value: number) {
  setCell(sheet, address, value);
}

function splitDebitCredit(amount: number) {
  if (amount >= 0) {
    return { debit: amount, credit: 0 };
  }

  return { debit: 0, credit: amount };
}

function ledgerByGl(rows: LedgerRow[]) {
  const map = new Map<string, LedgerRow>();
  rows.forEach((row) => {
    const key = String(row.glNumber ?? "").trim();
    if (key) {
      map.set(key, row);
    }
  });
  return map;
}

function ensureSheetRange(sheet: WorkSheet, row: number, col: number) {
  const current = sheet["!ref"] ?? "A1";
  const range = utils.decode_range(current);
  range.e.r = Math.max(range.e.r, row);
  range.e.c = Math.max(range.e.c, col);
  sheet["!ref"] = utils.encode_range(range);
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

  sheet["!ref"] = utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(maxRow, 1), c: Math.max(maxCol, 1) },
  });
}

function compactWorkbook(workbook: WorkBook) {
  const limits: Record<string, number> = {
    [CURRENT_TB_SHEET]: 16,
    [PREVIOUS_TB_SHEET]: 16,
    "TB BVS 31.3.23": 26,
    "TB BVS 31.3.22": 22,
    "BS  Notes  4-19": 20,
    "PL Notes 20-27": 22,
    "IT Computation_FY24": 30,
    "PPE- note 3": 14,
  };

  workbook.SheetNames.forEach((name) => {
    compactSheet(workbook.Sheets[name], limits[name] ?? 24);
  });
}

function accountClassLabel(row: LedgerRow) {
  if (row.accountClass === "equity-liability") {
    return row.derivedBucket.includes("equity") ? "Equity" : "Liabilities";
  }
  if (row.accountClass === "asset") {
    return "Assets";
  }
  if (row.accountClass === "income") {
    return "Income";
  }
  if (row.accountClass === "expense") {
    return "Expenses";
  }
  return "Other";
}

function fillTrialBalanceSheet(sheet: WorkSheet | undefined, rows: LedgerRow[], year: "current" | "previous", title: string, companyName: string) {
  if (!sheet) {
    return;
  }

  setCell(sheet, "A3", companyName);
  setCell(sheet, "A4", title);

  const byGl = ledgerByGl(rows);
  const usedGls = new Set<string>();
  const range = utils.decode_range(sheet["!ref"] ?? "A1");
  let lastDataRow = 6;

  for (let rowIndex = 6; rowIndex <= range.e.r; rowIndex += 1) {
    const codeCell = sheet[utils.encode_cell({ r: rowIndex, c: 1 })] as CellObject | undefined;
    const code = codeCell?.v !== undefined && codeCell?.v !== null ? String(codeCell.v).trim() : "";

    if (!code) {
      continue;
    }

    lastDataRow = rowIndex;
    usedGls.add(code);
    const ledger = byGl.get(code);
    const amount = ledger ? (year === "current" ? ledger.currentYear : ledger.previousYear) : 0;
    const { debit, credit } = splitDebitCredit(amount);
    const total = debit + credit;

    clearFormulaKeepValue(sheet, utils.encode_cell({ r: rowIndex, c: 6 }), debit);
    clearFormulaKeepValue(sheet, utils.encode_cell({ r: rowIndex, c: 7 }), credit);
    clearFormulaKeepValue(sheet, utils.encode_cell({ r: rowIndex, c: 8 }), total);

    if (ledger?.glDescription) {
      setCell(sheet, utils.encode_cell({ r: rowIndex, c: 5 }), ledger.glDescription);
    }
    if (ledger?.noteNumber) {
      setCell(sheet, utils.encode_cell({ r: rowIndex, c: 2 }), ledger.noteNumber);
    }
    if (ledger?.derivedLabel || ledger?.noteTitle) {
      setCell(sheet, utils.encode_cell({ r: rowIndex, c: 3 }), ledger.derivedLabel || ledger.noteTitle);
    }
  }

  // Append portal ledgers that are missing from the template structure.
  rows
    .filter((row) => row.glNumber && !usedGls.has(String(row.glNumber).trim()) && row.accountClass !== "opening-balance")
    .forEach((row) => {
      lastDataRow += 1;
      const amount = year === "current" ? row.currentYear : row.previousYear;
      const { debit, credit } = splitDebitCredit(amount);
      const values: Array<string | number> = [
        accountClassLabel(row),
        row.glNumber,
        row.noteNumber || "",
        row.derivedLabel || row.noteTitle || "",
        row.subgroupLabel || row.derivedLabel || "",
        row.glDescription,
        debit,
        credit,
        debit + credit,
      ];

      values.forEach((value, columnIndex) => {
        setCell(sheet, utils.encode_cell({ r: lastDataRow, c: columnIndex }), value);
      });
      ensureSheetRange(sheet, lastDataRow, 8);
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

function updateMasterGrouping(workbook: WorkBook, rows: LedgerRow[]) {
  const sheet = workbook.Sheets["Master Grouping"];
  if (!sheet) {
    return;
  }

  const byGl = ledgerByGl(rows);
  const range = utils.decode_range(sheet["!ref"] ?? "A1");

  for (let rowIndex = 1; rowIndex <= range.e.r; rowIndex += 1) {
    const codeCell = sheet[utils.encode_cell({ r: rowIndex, c: 0 })] as CellObject | undefined;
    const code = codeCell?.v !== undefined && codeCell?.v !== null ? String(codeCell.v).trim() : "";
    if (!code) {
      continue;
    }

    const ledger = byGl.get(code);
    if (!ledger) {
      continue;
    }

    if (ledger.derivedLabel || ledger.noteTitle) {
      setCell(sheet, utils.encode_cell({ r: rowIndex, c: 1 }), ledger.derivedLabel || ledger.noteTitle);
    }
    if (ledger.subgroupLabel) {
      setCell(sheet, utils.encode_cell({ r: rowIndex, c: 2 }), ledger.subgroupLabel);
    }
  }
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
    // Avoid SheetJS style round-trip bloat (template rewrite jumps ~1MB → ~20MB).
    cellStyles: false,
    cellFormula: true,
  });

  const dates = formatFinancialYearLabels(context.financialYear);
  const rows = context.snapshot.rows;

  updateInputSheet(workbook, context, dates);
  updateStatementTitles(workbook, dates, context.companyName);
  updateSignatories(workbook, context);
  updateMasterGrouping(workbook, rows);

  fillTrialBalanceSheet(
    workbook.Sheets[CURRENT_TB_SHEET],
    rows,
    "current",
    `Trial Balance as on ${dates.current}`,
    context.companyName,
  );
  fillTrialBalanceSheet(
    workbook.Sheets[PREVIOUS_TB_SHEET],
    rows,
    "previous",
    `Trial Balance as on ${dates.previous}`,
    context.companyName,
  );

  compactWorkbook(workbook);

  enableFullCalcOnLoad(workbook);

  return Buffer.from(write(workbook, { type: "buffer", bookType: "xlsx", cellStyles: false }));
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
