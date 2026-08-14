/**
 * Client-safe Excel profile choices for site-admin company mapping.
 * Keep ids in sync with registered profiles in `registry.ts` / `profiles/custom.ts`.
 * Empty value = shared V-8 fallback. Only one profile can be linked per company.
 */
export const excelProfileSelectOptions = [
  { value: "", label: "Shared V-8 (default)" },
  { value: "xyz-desired-structure", label: "XYZ desired statement workbook" },
  { value: "ltel-desired-structure", label: "LTEL desired statement workbook" },
] as const;

export type ExcelProfileOptionValue = (typeof excelProfileSelectOptions)[number]["value"];

export function isRegisteredExcelProfileId(profileId: string | null | undefined) {
  if (!profileId) {
    return true;
  }

  return excelProfileSelectOptions.some((option) => option.value === profileId && option.value !== "");
}

export function labelForExcelProfileId(profileId: string | null | undefined) {
  const match = excelProfileSelectOptions.find((option) => option.value === (profileId ?? ""));
  return match?.label ?? "Shared V-8 (default)";
}
