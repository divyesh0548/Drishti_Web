import { customExcelProfiles } from "@/lib/export/excel/profiles/custom";
import { v8LinkedExcelProfile } from "@/lib/export/excel/profiles/v8-linked";
import type { ExcelExportProfile } from "@/lib/export/excel/types";

const DEFAULT_PROFILE_ID = v8LinkedExcelProfile.id;

const registeredProfiles: ExcelExportProfile[] = [v8LinkedExcelProfile, ...customExcelProfiles];

export function listExcelExportProfiles() {
  return registeredProfiles.map((profile) => ({
    id: profile.id,
    label: profile.label,
    companyIds: profile.companyIds ?? [],
  }));
}

/**
 * Resolve Excel layout for a company.
 * Priority:
 * 1. optional settings.excelProfileId (advanced override)
 * 2. profile.companyIds match  ← default / recommended
 * 3. shared V-8 linked fallback
 */
export function resolveExcelExportProfile(input: {
  companyId?: string;
  excelProfileId?: string;
}): ExcelExportProfile {
  const requestedId = input.excelProfileId?.trim();

  if (requestedId) {
    const byId = registeredProfiles.find((profile) => profile.id === requestedId);
    if (byId) {
      return byId;
    }
  }

  if (input.companyId) {
    const byCompany = registeredProfiles.find((profile) => profile.companyIds?.includes(input.companyId!));
    if (byCompany) {
      return byCompany;
    }
  }

  return registeredProfiles.find((profile) => profile.id === DEFAULT_PROFILE_ID) ?? v8LinkedExcelProfile;
}
