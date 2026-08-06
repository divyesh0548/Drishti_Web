import type { CellObject, WorkBook, WorkSheet } from "xlsx";

export type FinancialYearLabels = {
  /** e.g. March 31, 2026 */
  currentEndLong: string;
  /** e.g. March 31, 2025 */
  previousEndLong: string;
  /** e.g. 31 March 2026 */
  currentEndAlt: string;
  /** e.g. 31 March 2025 */
  previousEndAlt: string;
  /** e.g. 01 April 2025 / 1 April 2025 */
  currentStartLong: string;
  previousStartLong: string;
  currentStartAlt: string;
  previousStartAlt: string;
  currentFy: string;
  previousFy: string;
  currentYearEnd: number;
  previousYearEnd: number;
  currentYearStart: number;
  previousYearStart: number;
};

/**
 * Derive period labels from portal financialYear (e.g. "2025-26").
 * Template baselines are assumed to be FY ending March of (startYear+1).
 */
export function labelsFromFinancialYear(financialYear: string): FinancialYearLabels {
  const match = financialYear.match(/^(\d{4})-(\d{2})$/);
  const startYear = match ? Number(match[1]) : 2025;
  const currentYearEnd = startYear + 1;
  const previousYearEnd = currentYearEnd - 1;
  const previousYearStart = startYear - 1;

  return {
    currentEndLong: `March 31, ${currentYearEnd}`,
    previousEndLong: `March 31, ${previousYearEnd}`,
    currentEndAlt: `31 March ${currentYearEnd}`,
    previousEndAlt: `31 March ${previousYearEnd}`,
    currentStartLong: `01 April ${startYear}`,
    previousStartLong: `01 April ${previousYearStart}`,
    currentStartAlt: `1 April ${startYear}`,
    previousStartAlt: `1 April ${previousYearStart}`,
    currentFy: `${startYear}-${String(currentYearEnd).slice(-2)}`,
    previousFy: `${previousYearStart}-${String(previousYearEnd).slice(-2)}`,
    currentYearEnd,
    previousYearEnd,
    currentYearStart: startYear,
    previousYearStart,
  };
}

export type TemplateDateBaseline = {
  /** Template current year-end (e.g. 2026 for LTEL/XYZ samples). */
  currentYearEnd: number;
  companyNamePatterns?: RegExp[];
};

/**
 * Build ordered string replacements from a template's hardcoded FY into the company FY.
 * Longer phrases first so years inside dates are not double-replaced incorrectly.
 */
export function buildDateTextReplacements(
  baseline: TemplateDateBaseline,
  labels: FinancialYearLabels,
): Array<{ from: string; to: string }> {
  const bEnd = baseline.currentYearEnd;
  const bStart = bEnd - 1;
  const bPrevEnd = bEnd - 1;
  const bPrevStart = bEnd - 2;
  const bFy = `${bStart}-${String(bEnd).slice(-2)}`;
  const bPrevFy = `${bPrevStart}-${String(bPrevEnd).slice(-2)}`;

  const pairs: Array<{ from: string; to: string }> = [
    { from: `March 31, ${bEnd}`, to: labels.currentEndLong },
    { from: `March 31, ${bPrevEnd}`, to: labels.previousEndLong },
    { from: `March 31 ${bEnd}`, to: labels.currentEndLong.replace(",", "") },
    { from: `March 31 ${bPrevEnd}`, to: labels.previousEndLong.replace(",", "") },
    { from: `31 March, ${bEnd}`, to: `31 March, ${labels.currentYearEnd}` },
    { from: `31 March, ${bPrevEnd}`, to: `31 March, ${labels.previousYearEnd}` },
    { from: `31 March ${bEnd}`, to: labels.currentEndAlt },
    { from: `31 March ${bPrevEnd}`, to: labels.previousEndAlt },
    { from: `01 April ${bStart}`, to: labels.currentStartLong },
    { from: `01 April ${bPrevStart}`, to: labels.previousStartLong },
    { from: `1 April ${bStart}`, to: labels.currentStartAlt },
    { from: `1 April ${bPrevStart}`, to: labels.previousStartAlt },
    { from: `April 01, ${bStart}`, to: `April 01, ${labels.currentYearStart}` },
    { from: `April 01, ${bPrevStart}`, to: `April 01, ${labels.previousYearStart}` },
    { from: `April 1, ${bStart}`, to: `April 1, ${labels.currentYearStart}` },
    { from: `April 1, ${bPrevStart}`, to: `April 1, ${labels.previousYearStart}` },
    { from: bFy, to: labels.currentFy },
    { from: bPrevFy, to: labels.previousFy },
  ];

  // Deduplicate identical from→to no-ops when company FY matches template FY.
  return pairs.filter((pair) => pair.from !== pair.to);
}

function replaceAllLiteral(haystack: string, needle: string, replacement: string) {
  if (!needle || haystack.indexOf(needle) === -1) {
    return haystack;
  }
  return haystack.split(needle).join(replacement);
}

/**
 * Walk every string cell: substitute date/year phrases and optional company-name patterns.
 * Leaves formulas and numeric cells untouched.
 */
export function substituteTemplateText(
  workbook: WorkBook,
  options: {
    dateReplacements: Array<{ from: string; to: string }>;
    companyName?: string;
    companyNamePatterns?: RegExp[];
  },
) {
  const { dateReplacements, companyName, companyNamePatterns = [] } = options;

  workbook.SheetNames.forEach((name) => {
    const sheet = workbook.Sheets[name] as WorkSheet | undefined;
    if (!sheet) {
      return;
    }

    Object.keys(sheet)
      .filter((key) => !key.startsWith("!"))
      .forEach((address) => {
        const cell = sheet[address] as CellObject | undefined;
        if (!cell || cell.f || typeof cell.v !== "string") {
          return;
        }

        let next = cell.v;
        for (const { from, to } of dateReplacements) {
          next = replaceAllLiteral(next, from, to);
        }

        if (companyName) {
          for (const pattern of companyNamePatterns) {
            next = next.replace(pattern, companyName);
          }
        }

        if (next !== cell.v) {
          cell.v = next;
          delete cell.w;
        }
      });
  });
}

export function enableFullCalcOnLoad(workbook: WorkBook) {
  const workbookWithCalc = workbook as WorkBook & {
    Workbook?: {
      CalcPr?: {
        calcId: string;
        fullCalcOnLoad: boolean;
        forceFullCalc: boolean;
      };
    };
  };

  workbookWithCalc.Workbook = workbookWithCalc.Workbook ?? {};
  workbookWithCalc.Workbook.CalcPr = {
    calcId: "0",
    fullCalcOnLoad: true,
    forceFullCalc: true,
  };
}
