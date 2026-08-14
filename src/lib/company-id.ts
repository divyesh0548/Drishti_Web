export type CompanyId = number;

const LEGACY_SLUG_IDS: Record<string, number> = {
  xyz: 1,
  abc: 2,
  ltel: 3,
};

export function parseCompanyId(value: unknown): CompanyId | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const asNumber = Number(trimmed);
    if (Number.isInteger(asNumber) && asNumber > 0) {
      return asNumber;
    }

    return LEGACY_SLUG_IDS[trimmed];
  }

  return undefined;
}

export function companyIdToParam(companyId: CompanyId) {
  return String(companyId);
}

export function nextCompanyId(existingIds: Iterable<number>) {
  let maxId = 0;
  for (const id of existingIds) {
    if (id > maxId) {
      maxId = id;
    }
  }
  return maxId + 1;
}

export function legacyCompanyIdForSlug(slug: string) {
  return LEGACY_SLUG_IDS[slug];
}
