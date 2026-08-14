import type { ExcelExportProfile } from "@/lib/export/excel/types";
import { ltelExcelProfile } from "@/lib/export/excel/profiles/ltel";
import { xyzExcelProfile } from "@/lib/export/excel/profiles/xyz";

/**
 * Company-specific Excel profiles.
 * Selected by companies.excelProfileId when mapped in Administration.
 * Slug match is only a fallback when no profile is mapped.
 */
export const customExcelProfiles: ExcelExportProfile[] = [xyzExcelProfile, ltelExcelProfile];
