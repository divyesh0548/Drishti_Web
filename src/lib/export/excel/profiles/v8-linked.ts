import { buildLinkedStatementWorkbook } from "@/lib/statement-export";

import type { ExcelExportProfile } from "@/lib/export/excel/types";

/**
 * Default / fallback Excel profile.
 * Used when a company has no `excelProfileId` and is not listed on a custom profile.
 */
export const v8LinkedExcelProfile: ExcelExportProfile = {
  id: "v8-linked",
  label: "Shared V-8 linked workbook (fallback)",
  build: (context) =>
    buildLinkedStatementWorkbook({
      companyId: context.companyId,
      versionId: context.versionId,
    }),
  fileName: (context) => {
    const safeName = context.companyName.replace(/[^\w.-]+/g, "_");
    return `${safeName}_${context.financialYear}_V8.xlsx`;
  },
};
