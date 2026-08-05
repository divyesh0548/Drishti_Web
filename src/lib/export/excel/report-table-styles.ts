import XLSX from "xlsx-js-style";

const { read, utils, write } = XLSX;
type WorkBook = XLSX.WorkBook;
type WorkSheet = XLSX.WorkSheet;
type CellObject = XLSX.CellObject;

/**
 * Global Excel report table color config.
 * Applied on every statement workbook export (all company profiles).
 */
export const REPORT_TABLE_COLOR_CONFIG = {
  header: {
    fill: {
      patternType: "solid" as const,
      fgColor: { rgb: "FF1E3A8A" },
    },
    font: {
      bold: true,
      color: { rgb: "FFFFFFFF" },
    },
  },
  total: {
    fill: {
      patternType: "solid" as const,
      fgColor: { rgb: "FFDBEAFE" },
    },
    font: {
      bold: true,
      color: { rgb: "FF0F172A" },
    },
  },
} as const;

const DEFAULT_STATEMENT_SHEETS = [
  "BS",
  "PL",
  "Cash Flow_FY26",
  "SOCIE",
  "BS  Notes  4-19",
  "PL Notes 20-27",
  "PPE- note 3",
  "Trial Balance",
] as const;

function cellText(sheet: WorkSheet, row: number, col: number) {
  const cell = sheet[utils.encode_cell({ r: row, c: col })] as CellObject | undefined;
  if (cell?.v === undefined || cell.v === null) {
    return "";
  }
  return String(cell.v).replace(/\s+/g, " ").trim();
}

function isHeaderRow(texts: string[]) {
  const joined = texts.join(" ").toLowerCase();
  return (
    joined.includes("particulars") ||
    (joined.includes("note") && joined.includes("as at")) ||
    (joined.includes("note") && joined.includes("year ended")) ||
    (joined.includes("particulars") && joined.includes("year ended")) ||
    (joined.includes("financial statement item") && joined.includes("gl number"))
  );
}

/** Date line under "As at" / "Year Ended" column headers (e.g. "31 March 2026"). */
function isHeaderDateContinuationRow(sheet: WorkSheet, row: number, maxCol: number) {
  const label = [0, 1].map((col) => cellText(sheet, row, col)).join(" ").trim();
  if (label) {
    return false;
  }

  let dateLike = 0;
  for (let col = 2; col <= Math.min(maxCol, 8); col += 1) {
    const address = utils.encode_cell({ r: row, c: col });
    const cell = sheet[address] as CellObject | undefined;
    if (!cell) {
      continue;
    }

    // Cash Flow / PL often store the date as a formula (=BS!D5) with no cached value.
    if (cell.f) {
      dateLike += 1;
      continue;
    }

    const text = cellText(sheet, row, col).toLowerCase();
    if (!text) {
      continue;
    }
    if (
      /\b(march|april|january|february|may|june|july|august|september|october|november|december)\b/.test(
        text,
      ) ||
      /\b20\d{2}\b/.test(text) ||
      /\d{1,2}[./-]\d{1,2}[./-]20\d{2}/.test(text)
    ) {
      dateLike += 1;
    }
  }
  return dateLike >= 1;
}

function isTotalRow(texts: string[]) {
  return texts.some((text) => {
    const normalized = text.toLowerCase();
    return (
      normalized === "total" ||
      normalized.startsWith("total ") ||
      normalized.includes("total non current") ||
      normalized.includes("total current") ||
      normalized.includes("total assets") ||
      normalized.includes("total equity") ||
      normalized.includes("total liabilities") ||
      normalized.includes("total income") ||
      normalized.includes("total expense") ||
      normalized.includes("total tax") ||
      normalized.includes("total comprehensive") ||
      normalized.includes("total shareholders") ||
      normalized.includes("net cash flow") ||
      normalized.includes("net increase") ||
      normalized.includes("(loss) for the year") ||
      normalized.includes("profit after tax") ||
      normalized.includes("profit before tax") ||
      normalized.includes("(loss) before tax")
    );
  });
}

type ReportFill = {
  patternType: "solid";
  fgColor: { rgb: string };
};

type ReportFont = {
  bold: boolean;
  color: { rgb: string };
};

/** Default Excel row height is ~15pt; two rows ≈ 30pt. */
const TOTAL_ROW_HEIGHT_PT = 30;
const HEADER_ROW_HEIGHT_PT = 30;

function setRowHeight(sheet: WorkSheet, row: number, heightPt: number) {
  const rows = (sheet["!rows"] ??= []);
  // Only set hpt — pairing hpx confuses SheetJS round-trips into taller rows.
  rows[row] = { hpt: heightPt };
}

function applyRowFill(
  sheet: WorkSheet,
  row: number,
  maxCol: number,
  fill: ReportFill,
  font: ReportFont,
  options: { wrapText?: boolean; rowHeightPt?: number } = {},
) {
  let lastUsedCol = 0;
  for (let col = 0; col <= maxCol; col += 1) {
    const cell = sheet[utils.encode_cell({ r: row, c: col })] as CellObject | undefined;
    if (
      cell &&
      (Boolean(cell.f) || (cell.v !== undefined && cell.v !== null && cell.v !== ""))
    ) {
      lastUsedCol = col;
    }
  }

  const styleThroughCol = Math.max(lastUsedCol, Math.min(maxCol, 5));
  const wrapText = options.wrapText ?? false;

  for (let col = 0; col <= styleThroughCol; col += 1) {
    const address = utils.encode_cell({ r: row, c: col });
    const existing = (sheet[address] ?? { t: "s", v: " " }) as CellObject;
    const hasFormula = Boolean(existing.f);
    const hasValue = existing.v !== undefined && existing.v !== null && existing.v !== "";
    const value = hasValue ? existing.v : hasFormula ? existing.v : " ";
    const next: CellObject = {
      ...existing,
      t: hasFormula
        ? existing.t || "n"
        : typeof value === "number"
          ? "n"
          : "s",
      s: {
        ...(typeof existing.s === "object" && existing.s ? existing.s : {}),
        fill,
        font,
        alignment: { vertical: "center", wrapText },
      },
    };
    if (!hasFormula) {
      next.v = value;
    }
    sheet[address] = next;
  }

  if (options.rowHeightPt !== undefined) {
    setRowHeight(sheet, row, options.rowHeightPt);
  }
}

export function styleStatementSheet(sheet: WorkSheet | undefined) {
  if (!sheet?.["!ref"]) {
    return;
  }

  const range = utils.decode_range(sheet["!ref"]);
  const headerStyleCols = Math.min(range.e.c, 12);

  for (let row = range.s.r; row <= range.e.r; row += 1) {
    const texts = [0, 1, 2].map((col) => cellText(sheet, row, col)).filter(Boolean);

    if (isHeaderRow(texts)) {
      applyRowFill(
        sheet,
        row,
        headerStyleCols,
        REPORT_TABLE_COLOR_CONFIG.header.fill,
        REPORT_TABLE_COLOR_CONFIG.header.font,
        { wrapText: true, rowHeightPt: HEADER_ROW_HEIGHT_PT },
      );

      const dateRow = row + 1;
      if (dateRow <= range.e.r && isHeaderDateContinuationRow(sheet, dateRow, headerStyleCols)) {
        applyRowFill(
          sheet,
          dateRow,
          headerStyleCols,
          REPORT_TABLE_COLOR_CONFIG.header.fill,
          REPORT_TABLE_COLOR_CONFIG.header.font,
          { wrapText: false, rowHeightPt: HEADER_ROW_HEIGHT_PT },
        );
      }
      continue;
    }

    if (texts.length === 0) {
      continue;
    }

    if (isTotalRow(texts)) {
      applyRowFill(
        sheet,
        row,
        headerStyleCols,
        REPORT_TABLE_COLOR_CONFIG.total.fill,
        REPORT_TABLE_COLOR_CONFIG.total.font,
        // Cap at ~2 default rows — avoid wrapText blowing total rows tall.
        { wrapText: false, rowHeightPt: TOTAL_ROW_HEIGHT_PT },
      );
    }
  }
}

/**
 * Apply global header/total colors to known statement sheets on a workbook.
 */
export function applyReportTableStyles(
  workbook: WorkBook,
  sheetNames: readonly string[] = DEFAULT_STATEMENT_SHEETS,
) {
  sheetNames.forEach((name) => {
    if (workbook.Sheets[name]) {
      styleStatementSheet(workbook.Sheets[name]);
    }
  });

  // Also style any other sheet whose name looks like a statement/notes tab.
  workbook.SheetNames.forEach((name) => {
    if (sheetNames.includes(name as (typeof DEFAULT_STATEMENT_SHEETS)[number])) {
      return;
    }
    if (/^(bs|pl|socie|cash flow|ppe|notes?)/i.test(name.trim())) {
      styleStatementSheet(workbook.Sheets[name]);
    }
  });
}

/**
 * Re-open a generated workbook buffer, apply global table colors, and return a new buffer.
 * Called once for every Excel report export (all profiles).
 */
export function applyReportTableStylesToWorkbookBuffer(buffer: Buffer): Buffer {
  const workbook = read(buffer, {
    type: "buffer",
    cellStyles: true,
    cellFormula: true,
  });

  applyReportTableStyles(workbook);
  clampWorkbookUsedRanges(workbook);

  return Buffer.from(
    write(workbook, {
      type: "buffer",
      bookType: "xlsx",
      cellStyles: true,
    }),
  );
}

/** Prevent SheetJS style round-trips from restoring absurd used-ranges (e.g. col XFA). */
function clampWorkbookUsedRanges(workbook: WorkBook, maxColExclusive = 40) {
  workbook.SheetNames.forEach((name) => {
    const sheet = workbook.Sheets[name];
    if (!sheet) {
      return;
    }

    let maxRow = 0;
    let maxCol = 0;
    Object.keys(sheet)
      .filter((key) => !key.startsWith("!"))
      .forEach((address) => {
        const decoded = utils.decode_cell(address);
        if (decoded.c >= maxColExclusive) {
          delete sheet[address];
          return;
        }
        maxRow = Math.max(maxRow, decoded.r);
        maxCol = Math.max(maxCol, decoded.c);
      });

    if (Array.isArray(sheet["!cols"])) {
      sheet["!cols"] = sheet["!cols"].slice(0, maxColExclusive);
    }

    sheet["!ref"] = utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(maxRow, 1), c: Math.max(maxCol, 1) },
    });
  });
}
