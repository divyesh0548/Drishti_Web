import type { ExportScope } from "@/lib/statement-export";
import type { StatementPack } from "@/lib/statement-pack";
import type { TrialBalanceSnapshot } from "@/lib/trial-balance";

export type { ExportScope };

export type ExcelExportContext = {
  scope: ExportScope;
  companyId: number;
  companySlug: string;
  companyName: string;
  versionId: string;
  financialYear: string;
  pack: StatementPack;
  snapshot: TrialBalanceSnapshot;
  excelProfileId?: string;
};

export type ExcelExportResult = {
  buffer: Buffer;
  fileName: string;
  profileId: string;
};

/**
 * A company-specific Excel layout. Register in `registry.ts`.
 * PDF export never uses these profiles — it stays on the common renderer.
 */
export type ExcelExportProfile = {
  /** Stable id stored on company settings as `excelProfileId`. */
  id: string;
  label: string;
  /** When set, these company slugs automatically select this profile. */
  companySlugs?: string[];
  /**
   * When true, apply header/total colors only — skip column autofit and range
   * clamp so the company template's layout stays intact.
   */
  preserveTemplateStyles?: boolean;
  /** Build the company Excel workbook from the shared financial model. */
  build: (context: ExcelExportContext) => Buffer | Promise<Buffer>;
  /** Optional download filename factory. */
  fileName?: (context: ExcelExportContext) => string;
};
