import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx-js-style";

import type { ExcelExportContext, ExcelExportProfile } from "@/lib/export/excel/types";
import { applyLtelPackCellMap } from "@/lib/export/excel/profiles/ltel-pack-map";
import {
  buildDateTextReplacements,
  enableFullCalcOnLoad,
  labelsFromFinancialYear,
  substituteTemplateText,
} from "@/lib/export/excel/template-fill";

const { read, write } = XLSX;

const LTEL_COMPANY_ID = "ltel";
const TEMPLATE_PATH = path.join(process.cwd(), "templates", "excel", "ltel-desired-structure.xlsx");

/** LTEL sample workbook is hardcoded to FY ending March 31, 2026. */
const LTEL_TEMPLATE_BASELINE = {
  currentYearEnd: 2026,
  companyNamePatterns: [
    /L&T ELECTROLYSERS LIMITED/gi,
    /L&T Electrolysers Limited/gi,
  ],
};

/**
 * LTEL export: copy the desired-structure template, substitute dates/years (and
 * company name) in text, then fill only mapped StatementPack numeric values.
 * Layout, wording, formulas, and formatting stay from the base file.
 */
export function buildLtelStatementWorkbook(context: ExcelExportContext): Buffer {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`LTEL Excel template not found at ${TEMPLATE_PATH}`);
  }

  const workbook = read(fs.readFileSync(TEMPLATE_PATH), {
    type: "buffer",
    cellStyles: true,
    cellFormula: true,
  });

  const labels = labelsFromFinancialYear(context.financialYear);
  const dateReplacements = buildDateTextReplacements(LTEL_TEMPLATE_BASELINE, labels);

  substituteTemplateText(workbook, {
    dateReplacements,
    companyName: context.companyName,
    companyNamePatterns: LTEL_TEMPLATE_BASELINE.companyNamePatterns,
  });

  applyLtelPackCellMap(workbook, context.pack);
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
  preserveTemplateStyles: true,
  build: buildLtelStatementWorkbook,
  fileName: (context) => {
    const safeName = context.companyName.replace(/[^\w.-]+/g, "_");
    return `${safeName}_${context.financialYear}_Financial_Statements.xlsx`;
  },
};
