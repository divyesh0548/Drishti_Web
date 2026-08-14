import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx-js-style";

import type { ExcelExportContext, ExcelExportProfile } from "@/lib/export/excel/types";
import { applyXyzPackCellMap } from "@/lib/export/excel/profiles/xyz-pack-map";
import {
  buildDateTextReplacements,
  enableFullCalcOnLoad,
  labelsFromFinancialYear,
  substituteTemplateText,
} from "@/lib/export/excel/template-fill";

const { read, write } = XLSX;
type WorkBook = XLSX.WorkBook;
type WorkSheet = XLSX.WorkSheet;
type CellObject = XLSX.CellObject;

const XYZ_COMPANY_ID = "xyz";
const TEMPLATE_PATH = path.join(process.cwd(), "templates", "excel", "xyz-desired-structure.xlsx");

/**
 * Statement sheets delivered from the XYZ template.
 * TB BVS tabs are kept because note formulas depend on them.
 * Master Grouping / working / tax / draft tabs stay excluded.
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

/** XYZ sample workbook is hardcoded to FY ending 31 March 2026. */
const XYZ_TEMPLATE_BASELINE = {
  currentYearEnd: 2026,
  companyNamePatterns: [
    /BVC Specialities Private Limited/gi,
    /BVC Specialities/gi,
  ],
};

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

/** Input drives template formulas — only patch company name + whole-number rounding. */
function patchInputSheet(workbook: WorkBook, context: ExcelExportContext) {
  const sheet = workbook.Sheets.Input;
  if (!sheet) {
    return;
  }
  setCell(sheet, "B1", context.companyName);
  setCell(sheet, "E2", 0);
}

/**
 * XYZ export: copy desired-structure template, drop non-statement tabs, substitute
 * dates/years in text, fill only mapped pack amounts. Leave other wording intact.
 */
export function buildXyzStatementWorkbook(context: ExcelExportContext): Buffer {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`XYZ Excel template not found at ${TEMPLATE_PATH}`);
  }

  const workbook = read(fs.readFileSync(TEMPLATE_PATH), {
    type: "buffer",
    cellStyles: true,
    cellFormula: true,
  });

  keepOnlySheets(workbook, XYZ_SHEETS_TO_KEEP);

  const missingRequired = XYZ_SHEETS_TO_KEEP.filter((name) => !workbook.Sheets[name]);
  if (missingRequired.length > 0) {
    throw new Error(
      `XYZ template is missing required sheets: ${missingRequired.join(", ")}. Expected at ${TEMPLATE_PATH}`,
    );
  }

  const labels = labelsFromFinancialYear(context.financialYear);
  const dateReplacements = buildDateTextReplacements(XYZ_TEMPLATE_BASELINE, labels);

  // Also cover Input FY labels written as 2025-26 style after substitution.
  substituteTemplateText(workbook, {
    dateReplacements,
    companyName: context.companyName,
    companyNamePatterns: XYZ_TEMPLATE_BASELINE.companyNamePatterns,
  });

  patchInputSheet(workbook, context);
  applyXyzPackCellMap(workbook, context.pack);
  enableFullCalcOnLoad(workbook);

  return Buffer.from(write(workbook, { type: "buffer", bookType: "xlsx", cellStyles: true }));
}

/**
 * XYZ company Excel layout.
 * Selected automatically for company slug `xyz` — no excelProfileId required.
 */
export const xyzExcelProfile: ExcelExportProfile = {
  id: "xyz-desired-structure",
  label: "XYZ desired statement workbook",
  companySlugs: [XYZ_COMPANY_ID],
  preserveTemplateStyles: true,
  build: buildXyzStatementWorkbook,
  fileName: (context) => {
    const safeName = context.companyName.replace(/[^\w.-]+/g, "_");
    return `${safeName}_${context.financialYear}_Financial_Statements.xlsx`;
  },
};
