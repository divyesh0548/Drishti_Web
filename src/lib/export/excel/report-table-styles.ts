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
  "CashFlow",
  "SOCIE",
  "SOCE",
  "BS  Notes  4-19",
  "PL Notes 20-27",
  "PPE- note 3",
  "Note 28-31",
  "FI -32",
  "Ratios -33",
  "Note - 34-35",
  "Note -36",
  "Note - 40",
  "27 Ratios",
  "Note 28 to 43",
  "Trial Balance",
] as const;

function cellText(sheet: WorkSheet, row: number, col: number) {
  const cell = sheet[utils.encode_cell({ r: row, c: col })] as CellObject | undefined;
  if (cell?.v === undefined || cell.v === null) {
    return "";
  }
  return String(cell.v).replace(/\s+/g, " ").trim();
}

function rowTexts(sheet: WorkSheet, row: number, maxCol: number) {
  const texts: string[] = [];
  for (let col = 0; col <= Math.min(maxCol, 12); col += 1) {
    const text = cellText(sheet, row, col);
    if (text) {
      texts.push(text);
    }
  }
  return texts;
}

function isHeaderRow(texts: string[]) {
  const joined = texts.join(" ").toLowerCase();
  return (
    joined.includes("particulars") ||
    (joined.includes("note") && joined.includes("as at")) ||
    (joined.includes("note") && joined.includes("year ended")) ||
    (joined.includes("particulars") && joined.includes("year ended")) ||
    (joined.includes("financial statement item") && joined.includes("gl number")) ||
    (joined.includes("as at") && texts.length >= 2) ||
    (joined.includes("carrying amount") && joined.includes("fair value")) ||
    (joined.includes("numerator") && joined.includes("denominator")) ||
    (joined.includes("name") && joined.includes("description of relationship")) ||
    (joined === "name description of relationship")
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

/** Default Excel column ≈ 10 character units; cap at 2 standard cells for all companies. */
const STANDARD_COL_WIDTH_CHARS = 10;
const MAX_COL_WIDTH_CHARS = STANDARD_COL_WIDTH_CHARS * 2;
const MIN_COL_WIDTH_CHARS = 8;
const WRAPPED_ROW_LINE_HEIGHT_PT = 15;
const MAX_WRAPPED_ROW_HEIGHT_PT = WRAPPED_ROW_LINE_HEIGHT_PT * 5;

function cellDisplayText(cell: CellObject | undefined) {
  if (!cell) {
    return "";
  }
  if (cell.w) {
    return String(cell.w).trim();
  }
  if (cell.v === undefined || cell.v === null) {
    return "";
  }
  return String(cell.v).replace(/\s+/g, " ").trim();
}

function approxTextWidthChars(text: string) {
  if (!text) {
    return 0;
  }
  // Treat full-width-ish content modestly; Excel width is character-based.
  return Math.min(text.length, MAX_COL_WIDTH_CHARS * 4);
}

/**
 * Expand columns to fit content up to 2 standard cell widths.
 * Longer text wraps inside the cell instead of growing the column further.
 */
export function autoFitSheetColumns(sheet: WorkSheet | undefined) {
  if (!sheet?.["!ref"]) {
    return;
  }

  const range = utils.decode_range(sheet["!ref"]);
  const colWidths: number[] = [];
  const wrapRows = new Map<number, number>();

  for (let col = range.s.c; col <= range.e.c; col += 1) {
    let widest = MIN_COL_WIDTH_CHARS;

    for (let row = range.s.r; row <= range.e.r; row += 1) {
      const address = utils.encode_cell({ r: row, c: col });
      const cell = sheet[address] as CellObject | undefined;
      const text = cellDisplayText(cell);
      if (!text) {
        continue;
      }

      const chars = approxTextWidthChars(text);
      const fitted = Math.min(chars + 2, MAX_COL_WIDTH_CHARS);
      widest = Math.max(widest, fitted);

      if (chars > MAX_COL_WIDTH_CHARS) {
        const existing = (typeof cell?.s === "object" && cell.s ? cell.s : {}) as {
          alignment?: { wrapText?: boolean; vertical?: string; horizontal?: string };
          [key: string]: unknown;
        };
        const next: CellObject = {
          ...cell!,
          s: {
            ...existing,
            alignment: {
              ...(existing.alignment ?? {}),
              wrapText: true,
              vertical: "center",
            },
          },
        };
        sheet[address] = next;

        const lines = Math.min(
          Math.ceil(chars / MAX_COL_WIDTH_CHARS),
          Math.floor(MAX_WRAPPED_ROW_HEIGHT_PT / WRAPPED_ROW_LINE_HEIGHT_PT),
        );
        wrapRows.set(row, Math.max(wrapRows.get(row) ?? 0, lines));
      }
    }

    colWidths[col] = Math.min(Math.max(widest, MIN_COL_WIDTH_CHARS), MAX_COL_WIDTH_CHARS);
  }

  const cols = (sheet["!cols"] ??= []);
  for (let col = range.s.c; col <= range.e.c; col += 1) {
    const nextWidth = colWidths[col] ?? MIN_COL_WIDTH_CHARS;
    const existing = cols[col] ?? {};
    const existingWidth =
      typeof existing.wch === "number"
        ? existing.wch
        : typeof existing.width === "number"
          ? existing.width
          : MIN_COL_WIDTH_CHARS;
    cols[col] = {
      ...existing,
      wch: Math.min(Math.max(existingWidth, nextWidth), MAX_COL_WIDTH_CHARS),
    };
  }

  wrapRows.forEach((lines, row) => {
    const heightPt = Math.min(
      Math.max(lines, 2) * WRAPPED_ROW_LINE_HEIGHT_PT,
      MAX_WRAPPED_ROW_HEIGHT_PT,
    );
    const rows = (sheet["!rows"] ??= []);
    const existingHeight = typeof rows[row]?.hpt === "number" ? rows[row]!.hpt! : 0;
    if (heightPt > existingHeight) {
      setRowHeight(sheet, row, heightPt);
    }
  });
}

/** Default Excel row height is ~15pt; two rows ≈ 30pt. */
const TOTAL_ROW_HEIGHT_PT = 30;
/** Each row in a 2-row header band — keep identical so fill height matches across columns. */
const HEADER_ROW_HEIGHT_PT = 30;

function setRowHeight(sheet: WorkSheet, row: number, heightPt: number) {
  const rows = (sheet["!rows"] ??= []);
  // Only set hpt — pairing hpx confuses SheetJS round-trips into taller rows.
  rows[row] = { hpt: heightPt };
}

function lastContentCol(sheet: WorkSheet, row: number, maxCol: number) {
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
  return lastUsedCol;
}

function applyRowFill(
  sheet: WorkSheet,
  row: number,
  maxCol: number,
  fill: ReportFill,
  font: ReportFont,
  options: {
    wrapText?: boolean;
    rowHeightPt?: number;
    /** When set, paint every column through this index (uniform header band). */
    forceThroughCol?: number;
  } = {},
) {
  const lastUsedCol = lastContentCol(sheet, row, maxCol);
  const styleThroughCol =
    options.forceThroughCol !== undefined
      ? options.forceThroughCol
      : Math.max(lastUsedCol, Math.min(maxCol, 5));
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
        alignment: { vertical: "center", horizontal: "center", wrapText },
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

type MergeRange = { s: { r: number; c: number }; e: { r: number; c: number } };

function mergesOverlappingRows(sheet: WorkSheet, startRow: number, endRow: number) {
  return ((sheet["!merges"] ?? []) as MergeRange[]).filter(
    (merge) => merge.s.r <= endRow && merge.e.r >= startRow,
  );
}

function unmergeRows(sheet: WorkSheet, startRow: number, endRow: number) {
  const merges = (sheet["!merges"] ?? []) as MergeRange[];
  sheet["!merges"] = merges.filter((merge) => merge.e.r < startRow || merge.s.r > endRow);
}

/**
 * Paint a uniform header band so every column has the same fill height.
 * Template merges (Particulars / Note spanning 2 rows) are restored after fill
 * so date columns no longer look taller than the label columns.
 */
function styleHeaderBand(
  sheet: WorkSheet,
  headerRow: number,
  maxCol: number,
  includeDateRow: boolean,
) {
  const bandRows = includeDateRow ? [headerRow, headerRow + 1] : [headerRow];
  const endRow = bandRows[bandRows.length - 1]!;
  const retainedMerges = mergesOverlappingRows(sheet, headerRow, endRow);

  unmergeRows(sheet, headerRow, endRow);

  let bandMaxCol = 0;
  for (const row of bandRows) {
    bandMaxCol = Math.max(bandMaxCol, lastContentCol(sheet, row, maxCol));
  }
  bandMaxCol = Math.max(bandMaxCol, Math.min(maxCol, 5));

  for (const row of bandRows) {
    applyRowFill(
      sheet,
      row,
      maxCol,
      REPORT_TABLE_COLOR_CONFIG.header.fill,
      REPORT_TABLE_COLOR_CONFIG.header.font,
      {
        // Keep band height stable across short and long header labels.
        wrapText: false,
        rowHeightPt: HEADER_ROW_HEIGHT_PT,
        forceThroughCol: bandMaxCol,
      },
    );
  }

  // Restore original header merges (e.g. Particulars A4:B5, Note C4:C5).
  if (retainedMerges.length > 0) {
    sheet["!merges"] = [...((sheet["!merges"] ?? []) as MergeRange[]), ...retainedMerges];
  }
}

export function styleStatementSheet(sheet: WorkSheet | undefined) {
  if (!sheet?.["!ref"]) {
    return;
  }

  const range = utils.decode_range(sheet["!ref"]);
  const headerStyleCols = Math.min(range.e.c, 12);

  for (let row = range.s.r; row <= range.e.r; row += 1) {
    const texts = rowTexts(sheet, row, headerStyleCols);
    const labelTexts = [0, 1, 2].map((col) => cellText(sheet, row, col)).filter(Boolean);

    if (isHeaderRow(texts)) {
      const dateRow = row + 1;
      const includeDateRow =
        dateRow <= range.e.r && isHeaderDateContinuationRow(sheet, dateRow, headerStyleCols);
      styleHeaderBand(sheet, row, headerStyleCols, includeDateRow);
      continue;
    }

    if (labelTexts.length === 0) {
      continue;
    }

    if (isTotalRow(labelTexts)) {
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

  autoFitSheetColumns(sheet);
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
    if (
      /^(bs|pl|socie?|cash\s*flow|ppe|notes?|fi|ratios)/i.test(name.trim()) ||
      /^\d/.test(name.trim())
    ) {
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
  // Autofit any remaining kept sheets (e.g. Input / TB) that skip color styling.
  workbook.SheetNames.forEach((name) => {
    if (DEFAULT_STATEMENT_SHEETS.includes(name as (typeof DEFAULT_STATEMENT_SHEETS)[number])) {
      return;
    }
    if (
      /^(bs|pl|socie?|cash\s*flow|ppe|notes?|fi|ratios)/i.test(name.trim()) ||
      /^\d/.test(name.trim())
    ) {
      return;
    }
    autoFitSheetColumns(workbook.Sheets[name]);
  });
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
