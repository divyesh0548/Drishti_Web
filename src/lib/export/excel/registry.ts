import { customExcelProfiles } from "@/lib/export/excel/profiles/custom";
import { v8LinkedExcelProfile } from "@/lib/export/excel/profiles/v8-linked";
import type { ExcelExportProfile } from "@/lib/export/excel/types";

const DEFAULT_PROFILE_ID = v8LinkedExcelProfile.id;

const registeredProfiles: ExcelExportProfile[] = [v8LinkedExcelProfile, ...customExcelProfiles];

export function listExcelExportProfiles() {
  return registeredProfiles.map((profile) => ({
    id: profile.id,
    label: profile.label,
    companySlugs: profile.companySlugs ?? [],
  }));
}

/**
 * Resolve Excel layout for a company.
 * Priority:
 * 1. companies.excelProfileId (site-admin mapping — source of truth)
 * 2. profile.companySlugs match only when no profile is mapped (legacy xyz / ltel)
 * 3. shared V-8 linked fallback
 */
export function resolveExcelExportProfile(input: {
  companySlug?: string;
  excelProfileId?: string;
}): ExcelExportProfile {
  const requestedId = input.excelProfileId?.trim();

  if (requestedId) {
    return registeredProfiles.find((profile) => profile.id === requestedId) ?? v8LinkedExcelProfile;
  }

  if (input.companySlug) {
    const byCompany = registeredProfiles.find((profile) => profile.companySlugs?.includes(input.companySlug!));
    if (byCompany) {
      return byCompany;
    }
  }

  return registeredProfiles.find((profile) => profile.id === DEFAULT_PROFILE_ID) ?? v8LinkedExcelProfile;
}
