export type StatementOverrideArea = "balance-sheet" | "profit-and-loss";

export type StatementLineOverride = {
  statementArea: StatementOverrideArea;
  particulars: string;
  noteNumber: string;
};

function isStatementArea(value: string): value is StatementOverrideArea {
  return value === "balance-sheet" || value === "profit-and-loss";
}

export function normalizeStatementLineOverrides(
  overrides: StatementLineOverride[] | undefined,
) {
  return (overrides ?? []).filter(
    (override) =>
      isStatementArea(override.statementArea) &&
      typeof override.particulars === "string" &&
      override.particulars.trim().length > 0 &&
      typeof override.noteNumber === "string",
  ).map((override) => ({
    statementArea: override.statementArea,
    particulars: override.particulars.trim(),
    noteNumber: override.noteNumber.trim(),
  }));
}

export function serializeStatementLineOverrides(
  overrides: StatementLineOverride[] | undefined,
) {
  const normalized = normalizeStatementLineOverrides(overrides);
  return normalized.length > 0 ? JSON.stringify(normalized) : "";
}

export function parseStatementLineOverrides(
  rawValue: string | null | undefined,
): StatementLineOverride[] {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return normalizeStatementLineOverrides(
      parsed.map((entry) => ({
        statementArea:
          typeof entry?.statementArea === "string" ? entry.statementArea : "",
        particulars:
          typeof entry?.particulars === "string" ? entry.particulars : "",
        noteNumber: typeof entry?.noteNumber === "string" ? entry.noteNumber : "",
      })),
    );
  } catch {
    return [];
  }
}
