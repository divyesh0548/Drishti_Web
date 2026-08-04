import type { ExcelExportProfile } from "@/lib/export/excel/types";
import { xyzExcelProfile } from "@/lib/export/excel/profiles/xyz";

/**
 * Company-specific Excel profiles.
 * Match by `companyIds` (preferred). `excelProfileId` in settings is optional.
 * Companies with no matching profile use the shared V-8 fallback.
 */
export const customExcelProfiles: ExcelExportProfile[] = [xyzExcelProfile];
