import { requireActiveCompany, resolveWorkspaceContext } from "@/lib/company-workspace";
import { resolveExcelExportProfile } from "@/lib/export/excel/registry";
import { applyReportTableStylesToWorkbookBuffer } from "@/lib/export/excel/report-table-styles";
import type { ExcelExportContext, ExcelExportResult, ExportScope } from "@/lib/export/excel/types";
import { prisma } from "@/lib/prisma";
import { getStatementPack } from "@/lib/statement-pack";
import { getTrialBalanceSnapshot } from "@/lib/trial-balance";

export type { ExcelExportContext, ExcelExportProfile, ExcelExportResult, ExportScope } from "@/lib/export/excel/types";
export { listExcelExportProfiles, resolveExcelExportProfile } from "@/lib/export/excel/registry";
export { REPORT_TABLE_COLOR_CONFIG, applyReportTableStyles } from "@/lib/export/excel/report-table-styles";

async function buildExportContext(scope: ExportScope = {}): Promise<ExcelExportContext> {
  const workspace = requireActiveCompany(
    resolveWorkspaceContext({
      companyId: scope.companyId,
      versionId: scope.versionId,
    }),
  );
  const [pack, snapshot, companyRow] = await Promise.all([
    getStatementPack({
      companyId: workspace.company.id,
      versionId: workspace.currentVersion.id,
      statementLineOverrides: scope.statementLineOverrides,
    }),
    getTrialBalanceSnapshot({
      companyId: workspace.company.id,
      versionId: workspace.currentVersion.id,
    }),
    prisma.company.findUnique({
      where: { id: workspace.company.id },
      select: { excelProfileId: true },
    }),
  ]);

  return {
    scope: {
      companyId: workspace.company.id,
      versionId: workspace.currentVersion.id,
      statementLineOverrides: scope.statementLineOverrides,
    },
    companyId: workspace.company.id,
    companySlug: workspace.company.slug,
    companyName: workspace.company.name,
    versionId: workspace.currentVersion.id,
    financialYear: workspace.currentVersion.financialYear,
    pack,
    snapshot,
    excelProfileId: (companyRow ? companyRow.excelProfileId : workspace.company.excelProfileId ?? workspace.settings.excelProfileId) ?? undefined,
  };
}

/**
 * Build the Excel statement workbook for a company/version.
 * Uses the site-admin mapped Excel structure profile when set; otherwise the shared V-8 fallback.
 * Header/total background colors are applied for every company.
 * Template-copy profiles keep base layout (colors only; no column autofit/clamp).
 * PDF export stays on the common renderer.
 */
export async function buildStatementWorkbook(scope?: ExportScope): Promise<Buffer> {
  return (await buildStatementWorkbookExport(scope)).buffer;
}

export async function buildStatementWorkbookExport(scope?: ExportScope): Promise<ExcelExportResult> {
  const context = await buildExportContext(scope);
  const profile = resolveExcelExportProfile({
    companySlug: context.excelProfileId ? undefined : context.companySlug,
    excelProfileId: context.excelProfileId,
  });
  const rawBuffer = await profile.build(context);
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
