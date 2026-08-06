import { resolveWorkspaceContext } from "@/lib/company-workspace";
import { resolveExcelExportProfile } from "@/lib/export/excel/registry";
import { applyReportTableStylesToWorkbookBuffer } from "@/lib/export/excel/report-table-styles";
import type { ExcelExportContext, ExcelExportResult, ExportScope } from "@/lib/export/excel/types";
import { getStatementPack } from "@/lib/statement-pack";
import { getTrialBalanceSnapshot } from "@/lib/trial-balance";

export type { ExcelExportContext, ExcelExportProfile, ExcelExportResult, ExportScope } from "@/lib/export/excel/types";
export { listExcelExportProfiles, resolveExcelExportProfile } from "@/lib/export/excel/registry";
export { REPORT_TABLE_COLOR_CONFIG, applyReportTableStyles } from "@/lib/export/excel/report-table-styles";

function buildExportContext(scope: ExportScope = {}): ExcelExportContext {
  const workspace = resolveWorkspaceContext({
    companyId: scope.companyId,
    versionId: scope.versionId,
  });
  const pack = getStatementPack({
    companyId: workspace.company.id,
    versionId: workspace.currentVersion.id,
  });
  const snapshot = getTrialBalanceSnapshot({
    companyId: workspace.company.id,
    versionId: workspace.currentVersion.id,
  });

  return {
    scope: {
      companyId: workspace.company.id,
      versionId: workspace.currentVersion.id,
    },
    companyId: workspace.company.id,
    companyName: workspace.company.name,
    versionId: workspace.currentVersion.id,
    financialYear: workspace.currentVersion.financialYear,
    pack,
    snapshot,
    excelProfileId: workspace.settings.excelProfileId,
  };
}

/**
 * Build the Excel statement workbook for a company/version.
 * Uses a company-specific profile when registered; otherwise the shared V-8 fallback.
 * Header/total background colors are applied for every company.
 * Template-copy profiles keep base layout (colors only; no column autofit/clamp).
 * PDF export stays on the common renderer.
 */
export function buildStatementWorkbook(scope?: ExportScope): Buffer {
  return buildStatementWorkbookExport(scope).buffer;
}

export function buildStatementWorkbookExport(scope?: ExportScope): ExcelExportResult {
  const context = buildExportContext(scope);
  const profile = resolveExcelExportProfile({
    companyId: context.companyId,
    excelProfileId: context.excelProfileId,
  });
  const rawBuffer = profile.build(context);
  const buffer = applyReportTableStylesToWorkbookBuffer(rawBuffer, {
    colorsOnly: Boolean(profile.preserveTemplateStyles),
  });
  const fileName =
    profile.fileName?.(context) ??
    `${context.companyName.replace(/[^\w.-]+/g, "_")}_${context.financialYear}_Statements.xlsx`;

  return {
    buffer,
    fileName,
    profileId: profile.id,
  };
}
