import PDFDocument from "pdfkit";
import { read, utils, write, type CellObject, type WorkSheet } from "xlsx";

import {
  buildV8FinancialModel,
  getUploadedWorkbookBuffer,
  getV8WorkbookBuffer,
  getV8WorkbookSheet,
  type V8WorkbookSheet,
} from "@/lib/v8-financials";
import { resolveWorkspaceContext, type CompanySettings } from "@/lib/company-workspace";
import { applyFixedAssetSchedulesToWorkbook, hasFixedAssetUpload, readFixedAssetStore, sumFixedAssetLines } from "@/lib/fixed-assets";
import { buildKeyRatioTable } from "@/lib/key-ratios";
import { getStatementPack, type NoteSchedule, type StatementDisplayRow } from "@/lib/statement-pack";
import { getTrialBalanceSnapshot, type LedgerRow } from "@/lib/trial-balance";

const brandBlue = "#0f6cbd";
const brandGreen = "#7bc67e";
const borderColor = "#cbd5e1";
const currentYearFill = "#eef5ff";
const currentYearHeaderFill = "#0f6cbd";
const textColor = "#111827";
const mutedTextColor = "#475569";
const pageMargin = 42;

type StatementSheetName = "BS" | "PL" | "SOCIE" | "Cash Flow_FY26";

type ExportScope = {
  companyId?: string;
  versionId?: string;
};

type FooterPerson = {
  name: string;
  role?: string;
  meta?: string;
};

type FooterDetails = {
  footerBlockStartRow?: number;
  notes: string[];
  reportLine?: string;
  auditorFirm?: string;
  auditorDesignation?: string;
  auditorRegistration?: string;
  partner?: FooterPerson;
  boardTitle?: string;
  companyLine?: string;
  companyMeta?: string;
  directors: FooterPerson[];
  officers: FooterPerson[];
  auditorPlace?: string;
  auditorDate?: string;
  companyPlace?: string;
  companyDate?: string;
};

type StatementPageConfig = {
  sheetName: StatementSheetName;
  title: string;
  subtitle: string;
  continuationTitle?: string;
  columns: number[];
  widths: number[];
  valueColumns: number[];
  startRow: number;
  endRow: number;
  footerSheetName?: StatementSheetName;
};

type RenderedRow = {
  cells: string[];
  kind: "blank" | "header" | "subheader" | "section" | "heading" | "total" | "default";
};

function rowText(row: string[]) {
  return row.join(" ").replace(/\s+/g, " ").trim();
}

function compactText(row: string[]) {
  return rowText(row).toUpperCase();
}

function isNumericCell(value: string) {
  const normalized = value.replace(/,/g, "").trim();

  if (!normalized) {
    return false;
  }

  return Number.isFinite(Number(normalized));
}

function formatAmount(value: string) {
  const numeric = Number(value.replace(/,/g, "").trim());

  if (!Number.isFinite(numeric)) {
    return value;
  }

  const absolute = Math.abs(numeric).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  if (numeric < 0) {
    return `(${absolute})`;
  }

  return absolute;
}

function normalizeCell(value: string, valueColumn: boolean) {
  if (!valueColumn || !isNumericCell(value)) {
    return value.trim();
  }

  return formatAmount(value);
}

function toneForRow(cells: string[]) {
  const text = compactText(cells);
  const first = (cells[0] ?? "").trim().toUpperCase();
  const second = (cells[1] ?? "").trim().toUpperCase();

  if (!text) {
    return "blank" as const;
  }

  if (text.includes("PARTICULARS") && (text.includes("31 MARCH") || text.includes("YEAR ENDED") || text.includes("AS AT"))) {
    return "header" as const;
  }

  if (text.includes("31 MARCH") || text.includes("YEAR ENDED") || text.includes("AS AT")) {
    return "subheader" as const;
  }

  if (
    second === "ASSETS" ||
    second === "EQUITY AND LIABILITIES" ||
    first === "I" ||
    first === "II" ||
    first === "III" ||
    first === "IV" ||
    first === "V" ||
    first === "VI" ||
    first === "VII" ||
    first === "VIII" ||
    first === "IX" ||
    first === "X" ||
    first === "XI" ||
    first === "XII" ||
    text.includes("CASH FLOW FROM OPERATING ACTIVITIES") ||
    text.includes("CASH FLOW FROM INVESTING ACTIVITIES") ||
    text.includes("CASH FLOW FROM FINANCING ACTIVITIES")
  ) {
    return "section" as const;
  }

  if (
    second === "NON CURRENT ASSETS" ||
    second === "CURRENT ASSETS" ||
    second === "EQUITY" ||
    second === "LIABILITIES" ||
    first.startsWith("(A)") ||
    first.startsWith("(B)") ||
    first.startsWith("(C)") ||
    first.startsWith("(1)") ||
    first.startsWith("(2)") ||
    text.includes("ADJUSTMENTS FOR") ||
    text.includes("CHANGES IN WORKING CAPITAL") ||
    text.includes("NOTES TO STATEMENT OF CASH FLOWS")
  ) {
    return "heading" as const;
  }

  if (
    text.includes("TOTAL") ||
    text.includes("NET CASH FLOW") ||
    text.includes("NET INCREASE") ||
    text.includes("BALANCE AS AT 31 MARCH") ||
    text.includes("CASH AND CASH EQUIVALENTS AT THE END OF THE PERIOD")
  ) {
    return "total" as const;
  }

  return "default" as const;
}

function drawBrandHeader(doc: PDFKit.PDFDocument, companyName: string, title: string, subtitle: string, continuationTitle?: string) {
  doc.fillColor(brandBlue).font("Helvetica-Bold").fontSize(12).text(companyName, pageMargin, pageMargin - 4);
  doc.fillColor(brandBlue).font("Helvetica").fontSize(10).text("Financial Statements", 430, pageMargin - 2, { width: 120, align: "right" });
  doc.fillColor(brandGreen).font("Helvetica").fontSize(9).text("Prepared from the current workbook", 430, pageMargin + 12, { width: 120, align: "right" });

  const heading = continuationTitle ?? title;
  doc.moveDown(1.4);
  doc.fillColor(brandBlue).font("Helvetica").fontSize(24).text(heading, pageMargin, 104, { continued: false });
  doc.fillColor(textColor).font("Helvetica").fontSize(11).text(subtitle, pageMargin, 138);
  doc
    .moveTo(pageMargin, 162)
    .lineTo(doc.page.width - pageMargin, 162)
    .strokeColor(brandBlue)
    .stroke();
  doc.fillColor(textColor).strokeColor(borderColor);
  doc.y = 168;
}

function getSheetRows(sheet: V8WorkbookSheet, columns: number[], valueColumns: number[]) {
  return sheet.rows.map<RenderedRow>((row) => {
    const cells = columns.map((columnIndex) => normalizeCell(row[columnIndex] ?? "", valueColumns.includes(columnIndex)));
    return {
      cells,
      kind: toneForRow(cells),
    };
  });
}

function renderTableRows(
  doc: PDFKit.PDFDocument,
  rows: RenderedRow[],
  widths: number[],
  valueColumnIndexes: number[],
  options: {
    reserveBottom: number;
    onPageBreak: () => void;
    repeatedHeaderRows?: RenderedRow[];
  },
) {
  const left = pageMargin;
  const totalWidth = widths.reduce((sum, width) => sum + width, 0);
  const right = left + totalWidth;
  const bottomLimit = () => doc.page.height - options.reserveBottom;

  const drawRow = (row: RenderedRow) => {
    const isSpacer = row.kind === "blank";
    const fontName = row.kind === "section" || row.kind === "heading" || row.kind === "total" || row.kind === "header" ? "Helvetica-Bold" : "Helvetica";
    const fontSize = row.kind === "section" ? 10 : row.kind === "heading" ? 9 : 8.5;
    const rowHeight = isSpacer
      ? 8
      : row.cells.reduce((largest, value, cellIndex) => {
          doc.font(fontName).fontSize(fontSize);
          const height = doc.heightOfString(value || " ", {
            width: widths[cellIndex] - 8,
            align: valueColumnIndexes.includes(cellIndex) ? "right" : "left",
          });
          return Math.max(largest, height + 6);
        }, 18);

    if (doc.y + rowHeight > bottomLimit()) {
      doc.addPage();
      options.onPageBreak();
      options.repeatedHeaderRows?.forEach((headerRow) => drawRow(headerRow));
    }

    const y = doc.y;

    if (!isSpacer) {
      let x = left;

      row.cells.forEach((value, cellIndex) => {
        const isCurrentYearCell = valueColumnIndexes[0] === cellIndex;
        const isPreviousYearCell = valueColumnIndexes[1] === cellIndex;

        if (row.kind === "header" || row.kind === "subheader") {
          if (isCurrentYearCell) {
            doc.rect(x, y, widths[cellIndex], rowHeight).fill(currentYearHeaderFill);
          } else if (isPreviousYearCell) {
            doc.rect(x, y, widths[cellIndex], rowHeight).fill("#ffffff");
          }
        } else if (isCurrentYearCell) {
          doc.rect(x, y, widths[cellIndex], rowHeight).fill(currentYearFill);
        }

        doc
          .rect(x, y, widths[cellIndex], rowHeight)
          .strokeColor(borderColor)
          .lineWidth(0.5)
          .stroke();

        const textFill =
          row.kind === "header" && isCurrentYearCell
            ? "#ffffff"
            : row.kind === "section"
              ? brandBlue
              : textColor;

        doc
          .fillColor(textFill)
          .font(fontName)
          .fontSize(fontSize)
          .text(value || " ", x + 4, y + 3, {
            width: widths[cellIndex] - 8,
            align: valueColumnIndexes.includes(cellIndex) ? "right" : "left",
          });

        x += widths[cellIndex];
      });

      doc
        .moveTo(left, y + rowHeight)
        .lineTo(right, y + rowHeight)
        .strokeColor(row.kind === "total" ? brandBlue : borderColor)
        .lineWidth(row.kind === "total" ? 0.8 : 0.5)
        .stroke();
    }

    doc.fillColor(textColor);
    doc.y = y + rowHeight;
  };

  rows.forEach((row) => drawRow(row));
}

function buildFooterFromSettings(settings: CompanySettings, companyName: string): FooterDetails {
  const auditor = settings.auditors[0];

  return {
    notes: settings.footerNote ? [settings.footerNote] : [],
    reportLine: "",
    auditorFirm: auditor?.firmName || auditor?.name || "",
    auditorDesignation: auditor?.designation || "",
    auditorRegistration: "",
    partner: auditor
      ? {
          name: auditor.name,
          role: auditor.designation,
          meta: auditor.membershipNumber,
        }
      : undefined,
    boardTitle: "For and on behalf of the Board",
    companyLine: companyName,
    companyMeta: "",
    directors: settings.directors.map((director) => ({
      name: director.name,
      role: director.designation,
      meta: "",
    })),
    officers: [],
    auditorPlace: "Place: Mumbai",
    auditorDate: "Date: 27 July 2026",
    companyPlace: "Place: Mumbai",
    companyDate: "Date: 27 July 2026",
  };
}

function drawFooter(doc: PDFKit.PDFDocument, footer: FooterDetails) {
  const footerTop = doc.page.height - 165;
  const leftX = pageMargin;
  const leftWidth = 210;
  const rightX = 300;
  const memberWidth = 105;
  let leftY = footerTop;

  footer.notes.forEach((line) => {
    doc.fillColor(textColor).font("Helvetica").fontSize(8.5).text(line, leftX, leftY, {
      width: doc.page.width - pageMargin * 2,
    });
    leftY += 12;
  });

  if (footer.reportLine) {
    doc.fillColor(textColor).font("Helvetica").fontSize(8.5).text(footer.reportLine, leftX, leftY + 2, { width: leftWidth });
    leftY += 14;
  }

  doc.fillColor(textColor).font("Helvetica-Bold").fontSize(9).text(footer.auditorFirm || "", leftX, leftY + 4, { width: leftWidth });
  leftY += 16;
  doc.font("Helvetica-Oblique").fontSize(8).text(footer.auditorDesignation || "", leftX, leftY, { width: leftWidth });
  leftY += 12;
  doc.font("Helvetica").fontSize(8).text(footer.auditorRegistration || "", leftX, leftY, { width: leftWidth });
  leftY += 14;

  if (footer.partner?.name) {
    doc.font("Helvetica-Bold").fontSize(9).text(footer.partner.name, leftX, leftY + 4, { width: leftWidth });
    leftY += 16;
    if (footer.partner.role) {
      doc.font("Helvetica-Oblique").fontSize(8).text(footer.partner.role, leftX, leftY, { width: leftWidth });
      leftY += 12;
    }
    if (footer.partner.meta) {
      doc.font("Helvetica").fontSize(8).text(footer.partner.meta, leftX, leftY, { width: leftWidth });
      leftY += 12;
    }
  }

  if (footer.auditorPlace) {
    doc.font("Helvetica").fontSize(8).text(footer.auditorPlace, leftX, leftY + 2, { width: leftWidth });
    leftY += 12;
  }
  if (footer.auditorDate) {
    doc.font("Helvetica").fontSize(8).text(footer.auditorDate, leftX, leftY, { width: leftWidth });
  }

  const rightY = footerTop + 14;
  doc.fillColor(textColor).font("Helvetica-Bold").fontSize(9).text(footer.boardTitle || "For and on behalf of the Board", rightX, footerTop, {
    width: 250,
    align: "center",
  });

  if (footer.companyLine) {
    doc.fillColor(mutedTextColor).font("Helvetica").fontSize(8).text(footer.companyLine, rightX, footerTop + 12, {
      width: 250,
      align: "center",
    });
  }

  if (footer.companyMeta) {
    doc.fillColor(mutedTextColor).font("Helvetica").fontSize(7.5).text(footer.companyMeta, rightX, footerTop + 24, {
      width: 250,
      align: "center",
    });
  }

  const boardMembers = [...footer.directors, ...footer.officers];
  boardMembers.slice(0, 3).forEach((member, index) => {
    const x = rightX + index * memberWidth;
    doc.fillColor(brandBlue).font("Helvetica-Bold").fontSize(8.5).text(member.name, x, rightY + 20, {
      width: memberWidth - 6,
      align: "center",
    });
    if (member.role) {
      doc.fillColor(textColor).font("Helvetica-Oblique").fontSize(7.8).text(member.role, x, rightY + 32, {
        width: memberWidth - 6,
        align: "center",
      });
    }
    if (member.meta) {
      doc.fillColor(textColor).font("Helvetica").fontSize(7.5).text(member.meta, x, rightY + 44, {
        width: memberWidth - 6,
        align: "center",
      });
    }
  });

  if (boardMembers.length > 3) {
    boardMembers.slice(3, 6).forEach((member, index) => {
      const x = rightX + index * memberWidth;
      doc.fillColor(brandBlue).font("Helvetica-Bold").fontSize(8.5).text(member.name, x, rightY + 68, {
        width: memberWidth - 6,
        align: "center",
      });
      if (member.role) {
        doc.fillColor(textColor).font("Helvetica-Oblique").fontSize(7.8).text(member.role, x, rightY + 80, {
          width: memberWidth - 6,
          align: "center",
        });
      }
    });
  }

  if (footer.companyPlace || footer.companyDate) {
    doc.fillColor(textColor).font("Helvetica").fontSize(8).text(
      [footer.companyPlace, footer.companyDate].filter(Boolean).join("  "),
      rightX,
      rightY + 104,
      {
        width: 250,
        align: "center",
      },
    );
  }

  doc.y = doc.page.height - 24;
}

function buildPages(): StatementPageConfig[] {
  return [
    {
      sheetName: "BS",
      title: "Standalone Balance Sheet",
      subtitle: "as at 31 March, 2026",
      columns: [0, 1, 2, 3],
      widths: [300, 52, 95, 95],
      valueColumns: [2, 3],
      startRow: 0,
      endRow: 999,
      footerSheetName: "BS",
    },
    {
      sheetName: "PL",
      title: "Standalone Statement of Profit and Loss",
      subtitle: "for the year ended 31 March, 2026",
      columns: [0, 1, 2, 3],
      widths: [300, 52, 95, 95],
      valueColumns: [2, 3],
      startRow: 0,
      endRow: 999,
      footerSheetName: "PL",
    },
    {
      sheetName: "SOCIE",
      title: "Standalone Statement of Changes in Equity",
      subtitle: "as at 31 March, 2026",
      columns: [0, 1, 2, 3, 4],
      widths: [190, 74, 74, 74, 74],
      valueColumns: [3, 4],
      startRow: 4,
      endRow: 41,
    },
    {
      sheetName: "SOCIE",
      title: "Standalone Statement of Changes in Equity",
      continuationTitle: "Standalone Statement of Changes in Equity (contd.)",
      subtitle: "as at 31 March, 2026",
      columns: [0, 1, 2, 3, 4],
      widths: [190, 74, 74, 74, 74],
      valueColumns: [3, 4],
      startRow: 41,
      endRow: 64,
      footerSheetName: "SOCIE",
    },
    {
      sheetName: "Cash Flow_FY26",
      title: "Standalone Statement of Cash Flows",
      subtitle: "for the year ended 31 March, 2026",
      columns: [0, 1, 2],
      widths: [450, 95, 95],
      valueColumns: [1, 2],
      startRow: 0,
      endRow: 999,
    },
  ];
}

type ComparativeNumber = {
  current: number;
  previous: number;
};

function normalizeLookup(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function displayLedgerValue(row: LedgerRow, year: "current" | "previous") {
  const value = year === "current" ? row.currentYear : row.previousYear;

  if (row.accountClass === "equity-liability" || row.accountClass === "income") {
    return value * -1;
  }

  return value;
}

function toRupees(value?: number) {
  return Math.round((value ?? 0) * 100000);
}

function toComparativeFromLakhs(current?: number, previous?: number): ComparativeNumber {
  return {
    current: toRupees(current),
    previous: toRupees(previous),
  };
}

function zeroComparative(): ComparativeNumber {
  return { current: 0, previous: 0 };
}

function addComparatives(...amounts: ComparativeNumber[]) {
  return amounts.reduce<ComparativeNumber>(
    (accumulator, amount) => ({
      current: accumulator.current + amount.current,
      previous: accumulator.previous + amount.previous,
    }),
    zeroComparative(),
  );
}

function subtractComparatives(base: ComparativeNumber, ...amounts: ComparativeNumber[]) {
  return amounts.reduce<ComparativeNumber>(
    (accumulator, amount) => ({
      current: accumulator.current - amount.current,
      previous: accumulator.previous - amount.previous,
    }),
    { ...base },
  );
}

function sumLedgerRows(rows: LedgerRow[], predicate: (row: LedgerRow) => boolean) {
  return rows.reduce<ComparativeNumber>(
    (accumulator, row) =>
      predicate(row)
        ? {
            current: accumulator.current + displayLedgerValue(row, "current"),
            previous: accumulator.previous + displayLedgerValue(row, "previous"),
          }
        : accumulator,
    zeroComparative(),
  );
}

function noteAmounts(note: NoteSchedule | undefined | null) {
  if (!note || note.kind !== "table") {
    return zeroComparative();
  }

  return toComparativeFromLakhs(note.totalCurrent, note.totalPrevious);
}

function findNote(pack: ReturnType<typeof getStatementPack>, id: string) {
  return pack.notes.find((note) => note.noteNumber === id || note.displayNoteNumber === id);
}

function noteRowAmounts(note: NoteSchedule | undefined | null, labels: string[]) {
  if (!note || note.kind !== "table") {
    return zeroComparative();
  }

  const normalizedLabels = labels.map(normalizeLookup);
  const rows = (note.rows ?? []).filter((row) => {
    const text = normalizeLookup(row.particulars);
    return normalizedLabels.some((label) => text === label || text.includes(label) || label.includes(text));
  });

  return rows.reduce<ComparativeNumber>(
    (accumulator, row) => ({
      current: accumulator.current + toRupees(row.current),
      previous: accumulator.previous + toRupees(row.previous),
    }),
    zeroComparative(),
  );
}

function ledgerLookupText(row: LedgerRow) {
  return normalizeLookup(`${row.glDescription} ${row.subgroupLabel} ${row.derivedLabel}`);
}

function sumByKeywords(rows: LedgerRow[], options: { noteNumbers?: string[]; include: string[]; exclude?: string[] }) {
  const includes = options.include.map(normalizeLookup);
  const excludes = (options.exclude ?? []).map(normalizeLookup);
  const noteSet = options.noteNumbers ? new Set(options.noteNumbers) : null;

  return sumLedgerRows(rows, (row) => {
    if (noteSet && !noteSet.has(row.noteNumber)) {
      return false;
    }

    const haystack = ledgerLookupText(row);
    const includeMatch = includes.some((keyword) => haystack.includes(keyword));
    const excludeMatch = excludes.some((keyword) => haystack.includes(keyword));
    return includeMatch && !excludeMatch;
  });
}

function setNumericCell(sheet: WorkSheet | undefined, address: string, value: number) {
  if (!sheet) {
    return;
  }

  const nextCell: CellObject = {
    ...(sheet[address] ?? {}),
    t: "n",
    v: value,
  };

  delete nextCell.w;
  sheet[address] = nextCell;
}

function setTextCell(sheet: WorkSheet | undefined, address: string, value: string) {
  if (!sheet) {
    return;
  }

  const nextCell: CellObject = {
    ...(sheet[address] ?? {}),
    t: "s",
    v: value,
  };

  delete nextCell.w;
  sheet[address] = nextCell;
}

function setYearPair(sheet: WorkSheet | undefined, currentCell: string, previousCell: string, amount: ComparativeNumber) {
  setNumericCell(sheet, currentCell, amount.current);
  setNumericCell(sheet, previousCell, amount.previous);
}

function setFormulaCell(sheet: WorkSheet | undefined, address: string, formula: string, value?: number | string) {
  if (!sheet) {
    return;
  }

  const nextCell: CellObject = {
    ...(sheet[address] ?? {}),
    f: formula,
    ...(typeof value === "number" ? { t: "n", v: value } : { t: "s", v: value ?? "" }),
  };

  delete nextCell.w;
  sheet[address] = nextCell;
}

function setHyperlinkCell(sheet: WorkSheet | undefined, address: string, label: string, target: string) {
  if (!sheet) {
    return;
  }

  const nextCell: CellObject & { l?: { Target: string; Tooltip?: string } } = {
    ...(sheet[address] ?? {}),
    t: "s",
    v: label,
    l: {
      Target: target,
      Tooltip: target,
    },
  };

  delete nextCell.w;
  sheet[address] = nextCell;
}

type TrialBalanceSheetResult = {
  sheet: WorkSheet;
  keyToRowNumber: Map<string, number>;
};

type FormulaNoteGroup = {
  matchKey: string;
  internalNoteKey: string;
  subgroupKey: string;
  particulars: string;
  ledgerReference: string;
  currentLakhs: number;
  previousLakhs: number;
};

type NoteAnchor = {
  sheetName: string;
  anchorRow: number;
  totalRow: number;
};

function formatFinancialYearLabels(financialYear: string) {
  const match = financialYear.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return {
      current: "31 March 2026",
      previous: "31 March 2025",
      currentStart: "1 April 2025",
      previousStart: "1 April 2024",
    };
  }

  const currentYearEnd = Number(match[1]) + 1;
  const previousYearEnd = currentYearEnd - 1;

  return {
    current: `31 March ${currentYearEnd}`,
    previous: `31 March ${previousYearEnd}`,
    currentStart: `1 April ${currentYearEnd - 1}`,
    previousStart: `1 April ${previousYearEnd - 1}`,
  };
}

function toStatementLakhs(row: LedgerRow, year: "current" | "previous") {
  const value = displayLedgerValue(row, year);
  return value / 100000;
}

function noteInternalKeyForRow(row: LedgerRow) {
  if (!row.noteNumber) {
    return "";
  }

  if (row.noteNumber === "21") {
    return row.subgroupKey === "materials-change-fg-wip" ? "21-inventory" : "21-materials";
  }

  return row.noteNumber;
}

function noteRowParticulars(row: LedgerRow) {
  return row.subgroupLabel?.trim() || row.derivedLabel?.trim() || row.glDescription?.trim() || "Particulars";
}

function buildFormulaNoteGroups(rows: LedgerRow[]) {
  const groups = new Map<string, FormulaNoteGroup[]>();
  const accumulator = new Map<
    string,
    FormulaNoteGroup & {
      ledgerReferences: Set<string>;
    }
  >();

  rows
    .filter((row) => row.accountClass !== "opening-balance" && row.noteNumber)
    .forEach((row) => {
      const internalNoteKey = noteInternalKeyForRow(row);
      const subgroupKey = row.subgroupKey || row.groupingKey || "ungrouped";
      const matchKey = `${internalNoteKey}|${subgroupKey}`;
      const existing = accumulator.get(matchKey);

      if (existing) {
        existing.currentLakhs += toStatementLakhs(row, "current");
        existing.previousLakhs += toStatementLakhs(row, "previous");
        if (row.glNumber) {
          existing.ledgerReferences.add(row.glNumber);
        }
        return;
      }

      accumulator.set(matchKey, {
        matchKey,
        internalNoteKey,
        subgroupKey,
        particulars: noteRowParticulars(row),
        ledgerReference: row.glNumber || "",
        currentLakhs: toStatementLakhs(row, "current"),
        previousLakhs: toStatementLakhs(row, "previous"),
        ledgerReferences: new Set(row.glNumber ? [row.glNumber] : []),
      });
    });

  accumulator.forEach((entry) => {
    const bucket = groups.get(entry.internalNoteKey) ?? [];
    bucket.push({
      matchKey: entry.matchKey,
      internalNoteKey: entry.internalNoteKey,
      subgroupKey: entry.subgroupKey,
      particulars: entry.particulars,
      ledgerReference: [...entry.ledgerReferences].sort((left, right) => left.localeCompare(right)).join(", "),
      currentLakhs: entry.currentLakhs,
      previousLakhs: entry.previousLakhs,
    });
    groups.set(entry.internalNoteKey, bucket);
  });

  groups.forEach((entries, key) => {
    groups.set(
      key,
      entries.sort((left, right) => Math.abs(right.currentLakhs) - Math.abs(left.currentLakhs) || left.particulars.localeCompare(right.particulars)),
    );
  });

  return groups;
}

function buildTrialBalanceSheet(snapshot: ReturnType<typeof getTrialBalanceSnapshot>, companyName: string): TrialBalanceSheetResult {
  const rows: Array<Array<string | number>> = [
    [companyName],
    [`Trial Balance mapped for note validation`],
    [""],
    [
      "Financial Statement Item",
      "GL Number",
      "GL Description",
      "Current Year",
      "Previous Year",
      "Note Number",
      "Note Title",
      "Grouping Key",
      "Subgroup Key",
      "Derived Label",
      "Statement Current (Lakhs)",
      "Statement Previous (Lakhs)",
      "Match Key",
      "Classification Basis",
    ],
  ];
  const keyToRowNumber = new Map<string, number>();

  snapshot.rows.forEach((row) => {
    const matchKey = `${noteInternalKeyForRow(row)}|${row.subgroupKey || row.groupingKey || "ungrouped"}`;
    const excelRowNumber = rows.length + 1;

    rows.push([
      row.financialStatementItem,
      row.glNumber,
      row.glDescription,
      row.currentYear,
      row.previousYear,
      row.noteNumber,
      row.noteTitle,
      row.groupingKey,
      row.subgroupKey,
      row.derivedLabel,
      toStatementLakhs(row, "current"),
      toStatementLakhs(row, "previous"),
      matchKey,
      row.classificationBasis,
    ]);

    if (row.noteNumber && !keyToRowNumber.has(matchKey)) {
      keyToRowNumber.set(matchKey, excelRowNumber);
    }
  });

  const sheet = utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 24 },
    { wch: 14 },
    { wch: 34 },
    { wch: 16 },
    { wch: 16 },
    { wch: 10 },
    { wch: 28 },
    { wch: 18 },
    { wch: 20 },
    { wch: 22 },
    { wch: 20 },
    { wch: 20 },
    { wch: 24, hidden: true },
    { wch: 44 },
  ];

  return {
    sheet,
    keyToRowNumber,
  };
}

function buildLinkedNoteSheet(input: {
  companyName: string;
  heading: string;
  currentLabel: string;
  previousLabel: string;
  periodLabel: string;
  notes: NoteSchedule[];
  noteGroups: Map<string, FormulaNoteGroup[]>;
  tbRowLookup: Map<string, number>;
  sheetName: string;
}) {
  const rows: Array<Array<string | number>> = [
    [input.companyName, "", "", "", "", ""],
    [input.heading, "", "", "(₹ in Lakh)", "", ""],
    ["", "", "", "", "", ""],
    ["Particulars", input.periodLabel, input.periodLabel, "Ledger Reference", "Trial Balance", "Match Key"],
    ["", input.currentLabel, input.previousLabel, "", "", ""],
  ];
  const anchors = new Map<string, NoteAnchor>();

  input.notes.forEach((note) => {
    rows.push(["", "", "", "", "", ""]);
    const anchorRow = rows.length + 1;
    rows.push([`Note ${note.displayNoteNumber ?? note.noteNumber}`, "", "", "", "", ""]);
    rows.push([note.title.toUpperCase(), "", "", "", "", ""]);

    const groups = input.noteGroups.get(note.noteNumber) ?? [];
    const firstDetailRow = rows.length + 1;

    groups.forEach((group) => {
      rows.push([group.particulars, "", "", group.ledgerReference, "", group.matchKey]);
    });

    const totalRow = rows.length + 1;
    rows.push(["Total", "", "", "", "", ""]);
    anchors.set(note.displayNoteNumber ?? note.noteNumber, {
      sheetName: input.sheetName,
      anchorRow,
      totalRow,
    });

    const totalCurrent = groups.reduce((sum, entry) => sum + Math.round(entry.currentLakhs), 0);
    const totalPrevious = groups.reduce((sum, entry) => sum + Math.round(entry.previousLakhs), 0);

    void totalCurrent;
    void totalPrevious;
    void firstDetailRow;
  });

  const sheet = utils.aoa_to_sheet(rows);
  sheet["!cols"] = [
    { wch: 64 },
    { wch: 16 },
    { wch: 16 },
    { wch: 20 },
    { wch: 16 },
    { wch: 24, hidden: true },
  ];

  let cursor = 6;

  input.notes.forEach((note) => {
    cursor += 1;
    const displayNoteNumber = note.displayNoteNumber ?? note.noteNumber;
    const anchor = anchors.get(displayNoteNumber);

    if (!anchor) {
      return;
    }

    cursor += 2;
    const groups = input.noteGroups.get(note.noteNumber) ?? [];
    const firstDetailRow = cursor;

    groups.forEach((group, index) => {
      const rowNumber = firstDetailRow + index;
      setFormulaCell(
        sheet,
        `B${rowNumber}`,
        `ROUND(SUMIFS('Trial Balance'!$K:$K,'Trial Balance'!$M:$M,$F${rowNumber}),0)`,
        Math.round(group.currentLakhs),
      );
      setFormulaCell(
        sheet,
        `C${rowNumber}`,
        `ROUND(SUMIFS('Trial Balance'!$L:$L,'Trial Balance'!$M:$M,$F${rowNumber}),0)`,
        Math.round(group.previousLakhs),
      );

      const tbRowNumber = input.tbRowLookup.get(group.matchKey);
      if (tbRowNumber) {
        setHyperlinkCell(sheet, `E${rowNumber}`, "Open TB", `#'Trial Balance'!A${tbRowNumber}`);
      }
    });

    const totalRow = firstDetailRow + groups.length;
    if (groups.length > 0) {
      setFormulaCell(
        sheet,
        `B${totalRow}`,
        `SUM(B${firstDetailRow}:B${totalRow - 1})`,
        groups.reduce((sum, entry) => sum + Math.round(entry.currentLakhs), 0),
      );
      setFormulaCell(
        sheet,
        `C${totalRow}`,
        `SUM(C${firstDetailRow}:C${totalRow - 1})`,
        groups.reduce((sum, entry) => sum + Math.round(entry.previousLakhs), 0),
      );
    } else {
      setFormulaCell(sheet, `B${totalRow}`, "0", 0);
      setFormulaCell(sheet, `C${totalRow}`, "0", 0);
    }

    cursor = totalRow + 1;
  });

  return {
    sheet,
    anchors,
  };
}

function buildLinkedBalanceSheetSheet(input: {
  companyName: string;
  currentLabel: string;
  previousLabel: string;
  rows: StatementDisplayRow[];
  noteAnchors: Map<string, NoteAnchor>;
}) {
  const sheetRows: Array<Array<string | number>> = [
    [input.companyName, "", "", ""],
    [`Balance Sheet as at ${input.currentLabel}`, "", "", "(₹ in Lakh)"],
    ["", "", "", ""],
    ["Particulars", "Note", "As at", "As at"],
    ["", "", input.currentLabel, input.previousLabel],
  ];
  const sheet = utils.aoa_to_sheet(sheetRows);
  sheet["!cols"] = [{ wch: 56 }, { wch: 10 }, { wch: 16 }, { wch: 16 }];

  const sumFormula = (column: "C" | "D", rows: number[]) => (rows.length > 0 ? rows.map((row) => `${column}${row}`).join("+") : "0");
  let excelRow = 6;
  let currentGroupRows: number[] = [];
  let sectionTotalRows: number[] = [];

  input.rows.forEach((row) => {
    setTextCell(sheet, `A${excelRow}`, row.particulars);
    if (row.note) {
      const anchor = input.noteAnchors.get(row.note);
      if (anchor) {
        setHyperlinkCell(sheet, `B${excelRow}`, row.note, `#'${anchor.sheetName}'!A${anchor.anchorRow}`);
        setFormulaCell(sheet, `C${excelRow}`, `'${anchor.sheetName}'!B${anchor.totalRow}`, Math.round(row.current ?? 0));
        setFormulaCell(sheet, `D${excelRow}`, `'${anchor.sheetName}'!C${anchor.totalRow}`, Math.round(row.previous ?? 0));
      } else {
        setTextCell(sheet, `B${excelRow}`, row.note);
      }
      currentGroupRows.push(excelRow);
    } else if (row.emphasis === "total") {
      const isOverallTotal = row.particulars === "Total Equity and Liabilities" || row.particulars === "Total Assets";
      const basisRows = isOverallTotal ? sectionTotalRows : currentGroupRows;
      setFormulaCell(sheet, `C${excelRow}`, sumFormula("C", basisRows), Math.round(row.current ?? 0));
      setFormulaCell(sheet, `D${excelRow}`, sumFormula("D", basisRows), Math.round(row.previous ?? 0));

      if (!isOverallTotal) {
        sectionTotalRows.push(excelRow);
      }
      currentGroupRows = [];
    }

    if (row.emphasis === "section") {
      currentGroupRows = [];
      sectionTotalRows = [];
    }

    if (row.emphasis === "heading") {
      currentGroupRows = [];
    }

    excelRow += 1;
  });

  return sheet;
}

function buildLinkedProfitAndLossSheet(input: {
  companyName: string;
  currentLabel: string;
  previousLabel: string;
  rows: StatementDisplayRow[];
  noteAnchors: Map<string, NoteAnchor>;
}) {
  const sheetRows: Array<Array<string | number>> = [
    [input.companyName, "", "", ""],
    [`Statement of Profit and Loss for the Year Ended ${input.currentLabel}`, "", "", "(₹ in Lakh)"],
    ["", "", "", ""],
    ["Particulars", "Note", "For the year ended", "For the year ended"],
    ["", "", input.currentLabel, input.previousLabel],
  ];
  const sheet = utils.aoa_to_sheet(sheetRows);
  sheet["!cols"] = [{ wch: 56 }, { wch: 10 }, { wch: 16 }, { wch: 16 }];

  const sumFormula = (column: "C" | "D", rows: number[]) => (rows.length > 0 ? rows.map((row) => `${column}${row}`).join("+") : "0");
  let excelRow = 6;
  const incomeRows: number[] = [];
  const expenseRows: number[] = [];
  let totalIncomeRow = 0;
  let totalExpenseRow = 0;
  let profitBeforeTaxRow = 0;
  let taxExpenseRow = 0;
  let inExpensesSection = false;

  input.rows.forEach((row) => {
    setTextCell(sheet, `A${excelRow}`, row.particulars);

    if (row.emphasis === "section" && row.particulars === "Expenses") {
      inExpensesSection = true;
    } else if (row.note) {
      const anchor = input.noteAnchors.get(row.note);
      if (anchor) {
        setHyperlinkCell(sheet, `B${excelRow}`, row.note, `#'${anchor.sheetName}'!A${anchor.anchorRow}`);
        setFormulaCell(sheet, `C${excelRow}`, `'${anchor.sheetName}'!B${anchor.totalRow}`, Math.round(row.current ?? 0));
        setFormulaCell(sheet, `D${excelRow}`, `'${anchor.sheetName}'!C${anchor.totalRow}`, Math.round(row.previous ?? 0));
      } else {
        setTextCell(sheet, `B${excelRow}`, row.note);
      }

      if (inExpensesSection) {
        expenseRows.push(excelRow);
      } else {
        incomeRows.push(excelRow);
      }

      if (row.particulars === "Tax Expense") {
        taxExpenseRow = excelRow;
      }
    } else if (row.particulars === "Total Income") {
      setFormulaCell(sheet, `C${excelRow}`, sumFormula("C", incomeRows), Math.round(row.current ?? 0));
      setFormulaCell(sheet, `D${excelRow}`, sumFormula("D", incomeRows), Math.round(row.previous ?? 0));
      totalIncomeRow = excelRow;
    } else if (row.particulars === "Total Expenses") {
      setFormulaCell(sheet, `C${excelRow}`, sumFormula("C", expenseRows), Math.round(row.current ?? 0));
      setFormulaCell(sheet, `D${excelRow}`, sumFormula("D", expenseRows), Math.round(row.previous ?? 0));
      totalExpenseRow = excelRow;
    } else if (row.particulars === "Profit before Tax") {
      setFormulaCell(sheet, `C${excelRow}`, `C${totalIncomeRow}-C${totalExpenseRow}`, Math.round(row.current ?? 0));
      setFormulaCell(sheet, `D${excelRow}`, `D${totalIncomeRow}-D${totalExpenseRow}`, Math.round(row.previous ?? 0));
      profitBeforeTaxRow = excelRow;
    } else if (row.particulars === "Profit after Tax") {
      const currentFormula = taxExpenseRow > 0 ? `C${profitBeforeTaxRow}-C${taxExpenseRow}` : `C${profitBeforeTaxRow}`;
      const previousFormula = taxExpenseRow > 0 ? `D${profitBeforeTaxRow}-D${taxExpenseRow}` : `D${profitBeforeTaxRow}`;
      setFormulaCell(sheet, `C${excelRow}`, currentFormula, Math.round(row.current ?? 0));
      setFormulaCell(sheet, `D${excelRow}`, previousFormula, Math.round(row.previous ?? 0));
    }

    excelRow += 1;
  });

  return sheet;
}

function buildLinkedStatementWorkbook(scope?: ExportScope) {
  const workbook = read(Buffer.from(getV8WorkbookBuffer(scope)), {
    type: "buffer",
    cellStyles: true,
    cellFormula: true,
  });
  const context = resolveWorkspaceContext({
    companyId: scope?.companyId,
    versionId: scope?.versionId,
  });
  const pack = getStatementPack(scope);
  const snapshot = getTrialBalanceSnapshot(scope);
  const dateLabels = formatFinancialYearLabels(context.currentVersion.financialYear);
  const trialBalanceSheet = buildTrialBalanceSheet(snapshot, context.company.name);
  const noteGroups = buildFormulaNoteGroups(snapshot.rows);
  const balanceSheetNotes = pack.notes.filter((note) => note.kind === "table" && note.statementArea === "balance-sheet");
  const profitAndLossNotes = pack.notes.filter((note) => note.kind === "table" && note.statementArea === "profit-and-loss");
  const linkedBalanceNotes = buildLinkedNoteSheet({
    companyName: context.company.name,
    heading: `Notes to Financial Statements for the year ended ${dateLabels.current}`,
    currentLabel: dateLabels.current,
    previousLabel: dateLabels.previous,
    periodLabel: "As at",
    notes: balanceSheetNotes,
    noteGroups,
    tbRowLookup: trialBalanceSheet.keyToRowNumber,
    sheetName: "BS  Notes  4-19",
  });
  const linkedProfitNotes = buildLinkedNoteSheet({
    companyName: context.company.name,
    heading: `Notes to Financial Statements for the year ended ${dateLabels.current}`,
    currentLabel: dateLabels.current,
    previousLabel: dateLabels.previous,
    periodLabel: "For the year ended",
    notes: profitAndLossNotes,
    noteGroups,
    tbRowLookup: trialBalanceSheet.keyToRowNumber,
    sheetName: "PL Notes 20-27",
  });

  workbook.Sheets["Trial Balance"] = trialBalanceSheet.sheet;
  workbook.Sheets["BS  Notes  4-19"] = linkedBalanceNotes.sheet;
  workbook.Sheets["PL Notes 20-27"] = linkedProfitNotes.sheet;
  workbook.Sheets.BS = buildLinkedBalanceSheetSheet({
    companyName: context.company.name,
    currentLabel: dateLabels.current,
    previousLabel: dateLabels.previous,
    rows: pack.balanceSheet.rows,
    noteAnchors: linkedBalanceNotes.anchors,
  });
  workbook.Sheets.PL = buildLinkedProfitAndLossSheet({
    companyName: context.company.name,
    currentLabel: dateLabels.current,
    previousLabel: dateLabels.previous,
    rows: pack.profitAndLoss.rows,
    noteAnchors: linkedProfitNotes.anchors,
  });

  const prioritySheetOrder = ["README", "Trial Balance", "BS", "PL", "Cash Flow_FY26", "SOCIE", "BS  Notes  4-19", "PL Notes 20-27"];
  const remainingSheets = workbook.SheetNames.filter((sheetName) => !prioritySheetOrder.includes(sheetName));
  workbook.SheetNames = [...prioritySheetOrder.filter((sheetName) => Boolean(workbook.Sheets[sheetName])), ...remainingSheets];

  const workbookWithCalc = workbook as typeof workbook & {
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

  return Buffer.from(write(workbook, { type: "buffer", bookType: "xlsx", cellStyles: true }));
}

// Retained as a fallback in case we need to inspect legacy uploaded layouts again.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function buildTemplateDrivenWorkbook(scope?: ExportScope) {
  const rawWorkbook = getUploadedWorkbookBuffer(scope);
  const workbook = read(Buffer.from(rawWorkbook), {
    type: "buffer",
    cellStyles: true,
    cellFormula: true,
  });
  const pack = getStatementPack(scope);
  const snapshot = getTrialBalanceSnapshot(scope);
  const context = resolveWorkspaceContext({
    companyId: scope?.companyId,
    versionId: scope?.versionId,
  });
  const ratios = buildKeyRatioTable({
    financialYear: context.currentVersion.financialYear,
    scope,
  });
  const rows = snapshot.rows.filter((row) => row.accountClass !== "opening-balance");
  const note3 = findNote(pack, "3");
  const note4 = findNote(pack, "4");
  const note5 = findNote(pack, "5");
  const note7 = findNote(pack, "7");
  const note9 = findNote(pack, "9");
  const note10 = findNote(pack, "10");
  const note13 = findNote(pack, "13");
  const note14 = findNote(pack, "14");
  const note15 = findNote(pack, "15");
  const note16 = findNote(pack, "16");
  const note17 = findNote(pack, "17");
  const note18 = findNote(pack, "18");
  const note19 = findNote(pack, "20");
  const note20 = findNote(pack, "21");
  const note21a = findNote(pack, "22");
  const note21c = findNote(pack, "23");
  const note22 = findNote(pack, "24");
  const note23 = findNote(pack, "25");
  const note24 = pack.notes.find((note) => note.noteNumber === "24");
  const note25 = pack.notes.find((note) => note.noteNumber === "25");

  const shareCapital = noteAmounts(note3);
  const otherEquity = noteAmounts(note4);
  const totalBorrowings = noteAmounts(note5);
  const tradePayables = noteAmounts(note9);
  const otherCurrentLiabilitiesPortal = noteAmounts(note10);
  const otherNonCurrentAssetsTotal = noteAmounts(note13);
  const inventories = noteAmounts(note14);
  const tradeReceivables = noteAmounts(note15);
  const cashAndCashEquivalents = noteAmounts(note16);
  const shortTermLoansAndAdvances = noteAmounts(note17);
  const otherCurrentAssetsPortal = noteAmounts(note18);
  const revenue = noteAmounts(note19);
  const otherIncome = noteAmounts(note20);
  const materials = noteAmounts(note21a);
  const inventoryChange = noteAmounts(note21c);
  const employeeBenefits = noteAmounts(note22);
  const financeCosts = noteAmounts(note23);
  const depreciation = noteAmounts(note24);
  const otherExpenses = noteAmounts(note25);
  const provisions = noteAmounts(note7);
  const totalAssets = toComparativeFromLakhs(pack.balanceSheet.totalCurrent, pack.balanceSheet.totalPrevious);

  const termLoans = subtractComparatives(totalBorrowings, noteRowAmounts(note5, ["lease liabilities"]));
  const leaseLiabilities = noteRowAmounts(note5, ["lease liabilities"]);
  const investments = noteRowAmounts(note13, ["investments"]);
  const otherNonCurrentAssets = subtractComparatives(otherNonCurrentAssetsTotal, investments);

  const tangiblePpe = sumByKeywords(rows, {
    noteNumbers: ["12"],
    include: ["factory building", "plant machinery", "electrical inst", "computer office", "furniture", "office equip"],
    exclude: ["auc", "under const", "rou", "right of use", "software", "technical know"],
  });
  const cwip = sumByKeywords(rows, {
    noteNumbers: ["12"],
    include: ["auc", "assets under const"],
  });
  const intangible = sumByKeywords(rows, {
    noteNumbers: ["12"],
    include: ["software", "technical know"],
    exclude: ["acc dep rou"],
  });
  const rou = sumByKeywords(rows, {
    noteNumbers: ["12"],
    include: ["rou", "right of use"],
  });

  const currentFinancialAssets = addComparatives(
    sumByKeywords(rows, { noteNumbers: ["17", "18"], include: ["icd"] }),
    sumByKeywords(rows, { noteNumbers: ["17", "18"], include: ["int acc icd", "int accrued icd", "interest accrued icd"] }),
    sumByKeywords(rows, { noteNumbers: ["17", "18"], include: ["rent deposit"] }),
    sumByKeywords(rows, { noteNumbers: ["17", "18"], include: ["travel advance", "employee misc advances", "iou"] }),
  );
  const advanceToSuppliers = sumByKeywords(rows, { noteNumbers: ["17", "18"], include: ["adv to suppliers"] });
  const gstAuthorities = sumByKeywords(rows, {
    noteNumbers: ["18"],
    include: ["gst", "cgst", "sgst", "igst", "retention", "input account", "credit on hold", "pla"],
    exclude: ["tds", "tcs"],
  });
  const tdsReceivable = sumByKeywords(rows, { noteNumbers: ["18"], include: ["tds", "tcs recei"] });
  const prepaidExpenses = sumByKeywords(rows, { noteNumbers: ["18"], include: ["prepaid"] });
  const interestOnFdReceivable = sumByKeywords(rows, { noteNumbers: ["17", "18"], include: ["fd"] });
  const otherCurrentAssets = subtractComparatives(
    addComparatives(shortTermLoansAndAdvances, otherCurrentAssetsPortal),
    currentFinancialAssets,
  );
  const otherReceivables = subtractComparatives(
    otherCurrentAssets,
    gstAuthorities,
    tdsReceivable,
    prepaidExpenses,
    advanceToSuppliers,
    interestOnFdReceivable,
  );

  const msmePayables = noteRowAmounts(note9, ["msme trade payables"]);
  const otherTradePayables = subtractComparatives(tradePayables, msmePayables);
  const employeeDues = noteRowAmounts(note10, ["employee dues"]);
  const otherFinancialLiabilities = noteRowAmounts(note10, ["other financial liabilities"]);
  const otherFinancialLiabilityTotal = addComparatives(employeeDues, otherFinancialLiabilities);
  const otherCurrentLiabilities = subtractComparatives(otherCurrentLiabilitiesPortal, otherFinancialLiabilityTotal);
  const customerAdvances = noteRowAmounts(note10, ["advances from customers"]);
  const statutoryLiabilities = noteRowAmounts(note10, ["statutory liabilities"]);
  const gratuityPayable = sumByKeywords(rows, { noteNumbers: ["10"], include: ["gratuity payable"] });
  const residualCurrentLiability = subtractComparatives(otherCurrentLiabilities, customerAdvances, statutoryLiabilities, gratuityPayable);

  const currentYearProfit = toComparativeFromLakhs(pack.profitAndLoss.profitAfterTax, pack.profitAndLoss.profitAfterTaxPrevious);
  const ratioMap = new Map(ratios.rows.map((row) => [row.label, row]));
  const fixedAssetStore = readFixedAssetStore(scope);
  const fixedAssetPpeTotal = sumFixedAssetLines(fixedAssetStore.schedules.ppe);
  const fixedAssetCwipTotal = sumFixedAssetLines(fixedAssetStore.schedules.cwip);
  const fixedAssetIntangibleTotal = sumFixedAssetLines(fixedAssetStore.schedules.intangible);
  const fixedAssetRouTotal = sumFixedAssetLines(fixedAssetStore.schedules.rou);

  const bsSheet = workbook.Sheets["BS"];
  const plSheet = workbook.Sheets["PL"];
  const cashSheet = workbook.Sheets["CashFlow"];
  const soceSheet = workbook.Sheets.SOCE;
  const ppeSheet = workbook.Sheets[" 2"];
  const cwipSheet = workbook.Sheets["3 CWIP"];
  const intangibleSheet = workbook.Sheets[" 4"];
  const inventoriesSheet = workbook.Sheets["6"];
  const investmentSheet = workbook.Sheets["7"];
  const receivableSheet = workbook.Sheets["8"];
  const cashNoteSheet = workbook.Sheets["9"];
  const currentFinAssetSheet = workbook.Sheets["10"];
  const currentAssetSheet = workbook.Sheets["11"];
  const shareCapitalSheet = workbook.Sheets["12"];
  const equitySheet = workbook.Sheets["13"];
  const borrowingsSheet = workbook.Sheets["14"];
  const payablesSheet = workbook.Sheets["15"];
  const financialLiabilitySheet = workbook.Sheets["16"];
  const currentLiabilitySheet = workbook.Sheets["17"];
  const provisionSheet = workbook.Sheets["18"];
  const revenueSheet = workbook.Sheets["19"];
  const otherIncomeSheet = workbook.Sheets["20"];
  const materialsSheet = workbook.Sheets["21"];
  const employeeSheet = workbook.Sheets["22"];
  const otherExpenseSheet = workbook.Sheets["23"];
  const financeSheet = workbook.Sheets["24"];
  const depreciationSheet = workbook.Sheets["25"];
  const epsSheet = workbook.Sheets["26"];
  const ratioSheet = workbook.Sheets["27 Ratios"];

  const companyTitleSheets = [
    bsSheet,
    plSheet,
    cashSheet,
    soceSheet,
    ppeSheet,
    cwipSheet,
    intangibleSheet,
    inventoriesSheet,
    investmentSheet,
    receivableSheet,
    cashNoteSheet,
    currentFinAssetSheet,
    currentAssetSheet,
    shareCapitalSheet,
    equitySheet,
    borrowingsSheet,
    payablesSheet,
    financialLiabilitySheet,
    currentLiabilitySheet,
    provisionSheet,
    revenueSheet,
    otherIncomeSheet,
    materialsSheet,
    employeeSheet,
    otherExpenseSheet,
    financeSheet,
    depreciationSheet,
    epsSheet,
    ratioSheet,
    workbook.Sheets["15a"],
    workbook.Sheets["Note 28 to 43"],
  ];

  for (const sheet of companyTitleSheets) {
    setTextCell(sheet, "A1", context.company.name);
    setTextCell(sheet, "B1", context.company.name);
  }

  setYearPair(bsSheet, "E9", "G9", tangiblePpe);
  setYearPair(bsSheet, "E10", "G10", cwip);
  setYearPair(bsSheet, "E11", "G11", intangible);
  setYearPair(bsSheet, "E12", "G12", zeroComparative());
  setYearPair(bsSheet, "E13", "G13", rou);
  setYearPair(bsSheet, "E14", "G14", otherNonCurrentAssets);
  setYearPair(bsSheet, "E18", "G18", inventories);
  setYearPair(bsSheet, "E20", "G20", investments);
  setYearPair(bsSheet, "E21", "G21", tradeReceivables);
  setYearPair(bsSheet, "E22", "G22", cashAndCashEquivalents);
  setYearPair(bsSheet, "E23", "G23", currentFinancialAssets);
  setYearPair(bsSheet, "E24", "G24", otherCurrentAssets);
  setYearPair(bsSheet, "E27", "G27", totalAssets);
  setYearPair(bsSheet, "E31", "G31", shareCapital);
  setYearPair(bsSheet, "E32", "G32", otherEquity);
  setYearPair(bsSheet, "E33", "G33", addComparatives(shareCapital, otherEquity));
  setYearPair(bsSheet, "E37", "G37", leaseLiabilities);
  setYearPair(bsSheet, "E41", "G41", termLoans);
  setYearPair(bsSheet, "E42", "G42", zeroComparative());
  setYearPair(bsSheet, "E43", "G43", tradePayables);
  setYearPair(bsSheet, "E44", "G44", otherFinancialLiabilityTotal);
  setYearPair(bsSheet, "E45", "G45", otherCurrentLiabilities);
  setYearPair(bsSheet, "E46", "G46", provisions);
  setYearPair(
    bsSheet,
    "E49",
    "G49",
    addComparatives(shareCapital, otherEquity, leaseLiabilities, termLoans, tradePayables, otherFinancialLiabilityTotal, otherCurrentLiabilities, provisions),
  );

  setYearPair(plSheet, "E6", "G6", revenue);
  setYearPair(plSheet, "E7", "G7", otherIncome);
  setYearPair(plSheet, "E8", "G8", addComparatives(revenue, otherIncome));
  const manufacturingSplit = sumByKeywords(rows, {
    noteNumbers: ["21"],
    include: [
      "sub contract",
      "electricity",
      "insurance",
      "engineering fees",
      "testing",
      "registration fees",
      "rent factory",
      "r m",
      "security serv",
      "roy",
      "freight forward",
      "fees manpower",
      "hire ch",
      "marine",
    ],
  });
  const rawMaterialSplit = subtractComparatives(materials, manufacturingSplit);
  setYearPair(plSheet, "E11", "G11", rawMaterialSplit);
  setYearPair(plSheet, "E12", "G12", manufacturingSplit);
  setYearPair(plSheet, "E13", "G13", inventoryChange);
  setYearPair(plSheet, "E14", "G14", employeeBenefits);
  setYearPair(plSheet, "E15", "G15", otherExpenses);
  setYearPair(plSheet, "E16", "G16", financeCosts);
  setYearPair(plSheet, "E17", "G17", depreciation);
  setYearPair(plSheet, "E18", "G18", addComparatives(materials, inventoryChange, employeeBenefits, otherExpenses, financeCosts, depreciation));
  setYearPair(plSheet, "E20", "G20", currentYearProfit);
  setYearPair(plSheet, "E21", "G21", zeroComparative());
  setYearPair(plSheet, "E22", "G22", currentYearProfit);
  setYearPair(plSheet, "E27", "G27", currentYearProfit);
  setYearPair(plSheet, "E32", "G32", currentYearProfit);
  setNumericCell(plSheet, "E34", Math.round((shareCapital.current === 0 ? 0 : currentYearProfit.current / (shareCapital.current / 10))));
  setNumericCell(plSheet, "G34", Math.round((shareCapital.previous === 0 ? 0 : currentYearProfit.previous / (shareCapital.previous / 10))));

  const cashFlow = pack.cashFlow.rows;
  const cashLine = (label: string) => {
    const row = cashFlow.find((entry) => normalizeLookup(entry.particulars) === normalizeLookup(label));
    return toComparativeFromLakhs(row?.current, row?.previous);
  };

  setYearPair(cashSheet, "C6", "D6", currentYearProfit);
  setYearPair(cashSheet, "C11", "D11", noteRowAmounts(note20, ["interest income"]));
  setYearPair(cashSheet, "C12", "D12", financeCosts);
  setYearPair(cashSheet, "C13", "D13", depreciation);
  setYearPair(cashSheet, "C18", "D18", cashLine("Movement in short-term loans, advances and other current assets"));
  setYearPair(cashSheet, "C19", "D19", cashLine("Net movement in property, plant, equipment, intangibles and other non-current assets"));
  setYearPair(cashSheet, "C20", "D20", cashLine("Movement in inventories"));
  setYearPair(cashSheet, "C21", "D21", addComparatives(cashLine("Movement in trade payables"), cashLine("Movement in other liabilities and provisions")));
  setYearPair(cashSheet, "C22", "D22", cashLine("Net cash from operating activities"));
  setYearPair(cashSheet, "C24", "D24", cashLine("Net cash from operating activities"));
  setYearPair(cashSheet, "C27", "D27", cashLine("Net movement in property, plant, equipment, intangibles and other non-current assets"));
  setYearPair(cashSheet, "C32", "D32", cashLine("Net cash from investing activities"));
  setYearPair(cashSheet, "C35", "D35", cashLine("Movement in share capital"));
  setYearPair(cashSheet, "C36", "D36", cashLine("Movement in long-term borrowings"));
  setYearPair(cashSheet, "C37", "D37", cashLine("Movement in short-term borrowings"));
  setYearPair(cashSheet, "C38", "D38", cashLine("Finance costs paid"));
  setYearPair(cashSheet, "C41", "D41", cashLine("Net cash from financing activities"));
  setYearPair(cashSheet, "C43", "D43", toComparativeFromLakhs(pack.cashFlow.netIncreaseCurrent, pack.cashFlow.netIncreasePrevious));
  setYearPair(cashSheet, "C44", "D44", toComparativeFromLakhs(pack.cashFlow.openingCashCurrent, pack.cashFlow.openingCashPrevious));
  setYearPair(cashSheet, "C45", "D45", toComparativeFromLakhs(pack.cashFlow.closingCashCurrent, pack.cashFlow.closingCashPrevious));

  setYearPair(ppeSheet, "J10", "K10", sumByKeywords(rows, { noteNumbers: ["12"], include: ["factory building"], exclude: ["auc"] }));
  setYearPair(ppeSheet, "J11", "K11", sumByKeywords(rows, { noteNumbers: ["12"], include: ["computer office"], exclude: ["auc"] }));
  setYearPair(ppeSheet, "J12", "K12", sumByKeywords(rows, { noteNumbers: ["12"], include: ["furniture"], exclude: ["auc"] }));
  setYearPair(ppeSheet, "J13", "K13", sumByKeywords(rows, { noteNumbers: ["12"], include: ["plant machinery"], exclude: ["auc"] }));
  setYearPair(ppeSheet, "J14", "K14", sumByKeywords(rows, { noteNumbers: ["12"], include: ["electrical inst"], exclude: ["auc"] }));
  setYearPair(ppeSheet, "J15", "K15", sumByKeywords(rows, { noteNumbers: ["12"], include: ["office equip"], exclude: ["auc"] }));
  setYearPair(ppeSheet, "J17", "K17", tangiblePpe);
  setYearPair(ppeSheet, "J24", "K24", zeroComparative());
  setYearPair(ppeSheet, "J25", "K25", rou);
  setYearPair(ppeSheet, "J27", "K27", rou);

  setYearPair(cwipSheet, "B8", "F8", sumByKeywords(rows, { noteNumbers: ["12"], include: ["auc building"] }));
  setYearPair(cwipSheet, "B9", "F9", sumByKeywords(rows, { noteNumbers: ["12"], include: ["auc fur"] }));
  setYearPair(cwipSheet, "B10", "F10", sumByKeywords(rows, { noteNumbers: ["12"], include: ["auc plant"] }));
  setYearPair(cwipSheet, "B11", "F11", sumByKeywords(rows, { noteNumbers: ["12"], include: ["auc electric"] }));
  setYearPair(cwipSheet, "B12", "F12", sumByKeywords(rows, { noteNumbers: ["12"], include: ["auc computer"] }));
  setYearPair(cwipSheet, "B13", "F13", cwip);
  setYearPair(cwipSheet, "B20", "F20", cwip);
  setYearPair(cwipSheet, "B22", "F22", cwip);

  setYearPair(intangibleSheet, "J10", "K10", sumByKeywords(rows, { noteNumbers: ["12"], include: ["technical know"] }));
  setYearPair(intangibleSheet, "J11", "K11", sumByKeywords(rows, { noteNumbers: ["12"], include: ["software"] }));
  setYearPair(intangibleSheet, "J13", "K13", intangible);

  setYearPair(inventoriesSheet, "B8", "C8", sumByKeywords(rows, { noteNumbers: ["14"], include: ["stock compo", "stock consum", "stock compo imp"] }));
  setYearPair(inventoriesSheet, "B9", "C9", sumByKeywords(rows, { noteNumbers: ["14"], include: ["goods in transit"] }));
  setYearPair(inventoriesSheet, "B10", "C10", sumByKeywords(rows, { noteNumbers: ["14"], include: ["stores", "spare"] }));
  setYearPair(inventoriesSheet, "B11", "C11", sumByKeywords(rows, { noteNumbers: ["14"], include: ["wip"] }));
  setYearPair(inventoriesSheet, "B12", "C12", sumByKeywords(rows, { noteNumbers: ["14"], include: ["finished goods"] }));
  setYearPair(inventoriesSheet, "B14", "C14", inventories);

  setYearPair(investmentSheet, "B8", "C8", investments);
  setYearPair(investmentSheet, "B10", "C10", investments);
  setYearPair(receivableSheet, "B8", "C8", tradeReceivables);
  setYearPair(receivableSheet, "B10", "C10", tradeReceivables);
  setYearPair(cashNoteSheet, "B7", "C7", cashAndCashEquivalents);
  setYearPair(cashNoteSheet, "B11", "C11", cashAndCashEquivalents);

  setYearPair(currentFinAssetSheet, "B8", "C8", sumByKeywords(rows, { noteNumbers: ["17", "18"], include: ["icd holding co"] }));
  setYearPair(currentFinAssetSheet, "B9", "C9", sumByKeywords(rows, { noteNumbers: ["17", "18"], include: ["int acc icd", "interest accrued icd"] }));
  setYearPair(currentFinAssetSheet, "B10", "C10", sumByKeywords(rows, { noteNumbers: ["17", "18"], include: ["rent deposit"] }));
  setYearPair(currentFinAssetSheet, "B11", "C11", sumByKeywords(rows, { noteNumbers: ["17", "18"], include: ["travel advance", "employee misc advances", "iou"] }));
  setYearPair(currentFinAssetSheet, "B13", "C13", currentFinancialAssets);

  setYearPair(currentAssetSheet, "B8", "C8", gstAuthorities);
  setYearPair(currentAssetSheet, "B11", "C11", tdsReceivable);
  setYearPair(currentAssetSheet, "B12", "C12", prepaidExpenses);
  setYearPair(currentAssetSheet, "B13", "C13", otherReceivables);
  setYearPair(currentAssetSheet, "B14", "C14", advanceToSuppliers);
  setYearPair(currentAssetSheet, "B15", "C15", interestOnFdReceivable);
  setYearPair(currentAssetSheet, "B17", "C17", otherCurrentAssets);

  setYearPair(shareCapitalSheet, "B13", "C13", shareCapital);
  setYearPair(shareCapitalSheet, "B16", "C16", shareCapital);
  const shareCountCurrent = Math.round(shareCapital.current / 10);
  const shareCountPrevious = Math.round(shareCapital.previous / 10);
  setNumericCell(shareCapitalSheet, "B23", shareCountPrevious);
  setNumericCell(shareCapitalSheet, "C23", 0);
  setNumericCell(shareCapitalSheet, "B25", shareCountCurrent - shareCountPrevious);
  setNumericCell(shareCapitalSheet, "C25", shareCountPrevious);
  setNumericCell(shareCapitalSheet, "B26", shareCountCurrent);
  setNumericCell(shareCapitalSheet, "C26", shareCountPrevious);
  setNumericCell(shareCapitalSheet, "B30", shareCapital.previous);
  setNumericCell(shareCapitalSheet, "C30", 0);
  setNumericCell(shareCapitalSheet, "B32", shareCapital.current - shareCapital.previous);
  setNumericCell(shareCapitalSheet, "C32", shareCapital.previous);
  setNumericCell(shareCapitalSheet, "B33", shareCapital.current);
  setNumericCell(shareCapitalSheet, "C33", shareCapital.previous);

  const otherReserve = noteRowAmounts(note4, ["other reserves"]);
  const retainedOpening = subtractComparatives(otherEquity, currentYearProfit, otherReserve);
  setYearPair(equitySheet, "C8", "C20", retainedOpening);
  setYearPair(equitySheet, "D8", "D20", otherReserve);
  setYearPair(equitySheet, "E8", "E20", subtractComparatives(otherEquity, currentYearProfit));
  setYearPair(equitySheet, "C10", "C22", currentYearProfit);
  setYearPair(equitySheet, "D12", "D24", zeroComparative());
  setYearPair(equitySheet, "C13", "C25", currentYearProfit);
  setYearPair(equitySheet, "D13", "D25", zeroComparative());
  setYearPair(equitySheet, "E13", "E25", currentYearProfit);
  setYearPair(equitySheet, "C14", "C26", otherEquity);
  setYearPair(equitySheet, "D14", "D26", otherReserve);
  setYearPair(equitySheet, "E14", "E26", otherEquity);

  const accruedBorrowingInterest = sumByKeywords(rows, { noteNumbers: ["5"], include: ["int accu"] });
  setYearPair(borrowingsSheet, "B8", "C8", subtractComparatives(termLoans, accruedBorrowingInterest));
  setYearPair(borrowingsSheet, "B10", "C10", accruedBorrowingInterest);
  setYearPair(borrowingsSheet, "B12", "C12", termLoans);

  setYearPair(payablesSheet, "B9", "C9", msmePayables);
  setYearPair(payablesSheet, "B10", "C10", otherTradePayables);
  setYearPair(payablesSheet, "B12", "C12", tradePayables);
  setYearPair(payablesSheet, "B20", "C20", msmePayables);
  setYearPair(payablesSheet, "B21", "C21", zeroComparative());
  setYearPair(payablesSheet, "B22", "C22", zeroComparative());
  setYearPair(payablesSheet, "B23", "C23", msmePayables);

  setYearPair(financialLiabilitySheet, "B8", "C8", noteRowAmounts(note10, ["other financial liabilities"]));
  setYearPair(financialLiabilitySheet, "B9", "C9", employeeDues);
  setYearPair(financialLiabilitySheet, "B10", "C10", sumByKeywords(rows, { noteNumbers: ["10"], include: ["powai", "curr a c", "shared serv"] }));
  setYearPair(
    financialLiabilitySheet,
    "B11",
    "C11",
    subtractComparatives(otherFinancialLiabilityTotal, noteRowAmounts(note10, ["other financial liabilities"]), employeeDues),
  );
  setYearPair(financialLiabilitySheet, "B13", "C13", otherFinancialLiabilityTotal);

  setYearPair(currentLiabilitySheet, "B9", "C9", sumByKeywords(rows, { noteNumbers: ["10"], include: ["tcs payable"] }));
  setYearPair(currentLiabilitySheet, "B10", "C10", sumByKeywords(rows, { noteNumbers: ["10"], include: ["tds payable", "tds "] }));
  setYearPair(currentLiabilitySheet, "B11", "C11", sumByKeywords(rows, { noteNumbers: ["10"], include: ["gst payable", "cgst payable", "sgst payable", "igst rcm payable"] }));
  setYearPair(currentLiabilitySheet, "B14", "C14", gratuityPayable);
  setYearPair(currentLiabilitySheet, "B16", "C16", customerAdvances);
  setYearPair(currentLiabilitySheet, "B17", "C17", residualCurrentLiability);
  setYearPair(currentLiabilitySheet, "B19", "C19", otherCurrentLiabilities);

  setYearPair(provisionSheet, "B8", "C8", provisions);
  setYearPair(provisionSheet, "B10", "C10", zeroComparative());
  setYearPair(provisionSheet, "B12", "C12", provisions);

  setYearPair(revenueSheet, "B8", "C8", revenue);
  setYearPair(revenueSheet, "B10", "C10", revenue);

  setYearPair(otherIncomeSheet, "B8", "C8", sumByKeywords(rows, { noteNumbers: ["20"], include: ["icd"] }));
  setYearPair(otherIncomeSheet, "B9", "C9", sumByKeywords(rows, { noteNumbers: ["20"], include: ["profit on curr inv"] }));
  setYearPair(otherIncomeSheet, "B10", "C10", sumByKeywords(rows, { noteNumbers: ["20"], include: ["scrap"] }));
  setYearPair(otherIncomeSheet, "B11", "C11", sumByKeywords(rows, { noteNumbers: ["20"], include: ["fixed deposit"] }));
  setYearPair(otherIncomeSheet, "B13", "C13", zeroComparative());
  setYearPair(otherIncomeSheet, "B15", "C15", otherIncome);
  setYearPair(otherIncomeSheet, "B18", "C18", sumByKeywords(rows, { noteNumbers: ["20"], include: ["icd"] }));
  setYearPair(otherIncomeSheet, "B19", "C19", sumByKeywords(rows, { noteNumbers: ["20"], include: ["fixed deposit"] }));
  setYearPair(otherIncomeSheet, "B20", "C20", zeroComparative());

  setYearPair(materialsSheet, "B11", "C11", rawMaterialSplit);
  setYearPair(materialsSheet, "B18", "C18", rawMaterialSplit);
  setYearPair(materialsSheet, "B24", "C24", manufacturingSplit);
  setYearPair(materialsSheet, "B33", "C33", manufacturingSplit);
  setYearPair(materialsSheet, "B43", "C43", zeroComparative());
  setYearPair(materialsSheet, "B49", "C49", zeroComparative());
  setYearPair(materialsSheet, "B51", "C51", inventoryChange);

  setYearPair(employeeSheet, "B8", "C8", noteRowAmounts(note22, ["salaries and wages"]));
  setYearPair(employeeSheet, "B9", "C9", noteRowAmounts(note22, ["contribution to provident and other funds"]));
  setYearPair(employeeSheet, "B10", "C10", zeroComparative());
  setYearPair(employeeSheet, "B11", "C11", noteRowAmounts(note22, ["staff welfare", "bonus and incentives"]));
  setYearPair(employeeSheet, "B13", "C13", employeeBenefits);
  setYearPair(employeeSheet, "B19", "C19", zeroComparative());
  setYearPair(employeeSheet, "B21", "C21", zeroComparative());

  setYearPair(otherExpenseSheet, "B29", "C29", otherExpenses);
  setYearPair(financeSheet, "B8", "C8", noteRowAmounts(note23, ["borrowing costs"]));
  setYearPair(financeSheet, "B10", "C10", noteRowAmounts(note23, ["interest expense"]));
  setYearPair(financeSheet, "B14", "C14", financeCosts);
  setYearPair(depreciationSheet, "B8", "C8", depreciation);
  setYearPair(depreciationSheet, "B12", "C12", depreciation);
  setYearPair(epsSheet, "B9", "C9", currentYearProfit);
  setNumericCell(epsSheet, "B10", shareCountCurrent);
  setNumericCell(epsSheet, "C10", shareCountPrevious);
  setNumericCell(epsSheet, "B11", shareCountCurrent === 0 ? 0 : Math.round((currentYearProfit.current / shareCountCurrent) * 100) / 100);
  setNumericCell(epsSheet, "C11", shareCountPrevious === 0 ? 0 : Math.round((currentYearProfit.previous / shareCountPrevious) * 100) / 100);

  const ratioRows = [
    "Current Ratio",
    "Debt-Equity Ratio",
    "Debt Service Coverage Ratio",
    "Return on Equity Ratio",
    "Inventory Turnover",
    "Trade Receivables Turnover",
    "Trade Payables Turnover",
    "Net Capital Turnover Ratio",
    "Net Profit Ratio",
    "Return on Capital Employed",
    "Return on Investment",
    "Interest Service Coverage Ratio",
    "Operating Margin",
  ].map((label) => ratioMap.get(label)).filter(Boolean);
  const ratioTargetRows = [8, 10, 12, 14, 16, 18, 20, 22, 24, 26];
  ratioRows.slice(0, ratioTargetRows.length).forEach((ratio, index) => {
    if (!ratio) {
      return;
    }

    const rowNumber = ratioTargetRows[index];
    setNumericCell(ratioSheet, `F${rowNumber}`, Math.round(ratio.current * 100) / 100);
    setNumericCell(ratioSheet, `I${rowNumber}`, Math.round(ratio.previous * 100) / 100);
    setNumericCell(ratioSheet, `J${rowNumber}`, Math.round((ratio.changePercent ?? 0) * 100) / 100);
  });

  if (hasFixedAssetUpload(fixedAssetStore)) {
    setYearPair(bsSheet, "E9", "G9", {
      current: fixedAssetPpeTotal.netCurrent,
      previous: fixedAssetPpeTotal.netPrevious,
    });
    setYearPair(bsSheet, "E10", "G10", {
      current: fixedAssetCwipTotal.netCurrent || fixedAssetCwipTotal.closingGross,
      previous: fixedAssetCwipTotal.netPrevious || fixedAssetCwipTotal.openingGross,
    });
    setYearPair(bsSheet, "E11", "G11", {
      current: fixedAssetIntangibleTotal.netCurrent,
      previous: fixedAssetIntangibleTotal.netPrevious,
    });
    setYearPair(bsSheet, "E13", "G13", {
      current: fixedAssetRouTotal.netCurrent,
      previous: fixedAssetRouTotal.netPrevious,
    });
    applyFixedAssetSchedulesToWorkbook(workbook, scope);
  }

  const workbookWithCalc = workbook as typeof workbook & {
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

  return Buffer.from(write(workbook, { type: "buffer", bookType: "xlsx", cellStyles: true }));
}

export function buildStatementWorkbook(scope?: ExportScope) {
  return buildLinkedStatementWorkbook(scope);
}

export async function buildStatementPdf(scope?: ExportScope) {
  const model = buildV8FinancialModel(scope);
  const pages = buildPages();
  const footerCache = new Map<string, FooterDetails>();

  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "A4",
      layout: "portrait",
      margin: pageMargin,
      info: {
        Title: "Financial Statements",
        Author: "OpenAI Codex",
        Subject: "Formatted financial statements export",
      },
    });

    doc.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    pages.forEach((page, pageIndex) => {
      const sheet = getV8WorkbookSheet(page.sheetName, scope);

      if (!sheet) {
        return;
      }

      if (pageIndex > 0) {
        doc.addPage();
      }

      drawBrandHeader(doc, model.entityName, page.title, page.subtitle, page.continuationTitle);
      const footer = page.footerSheetName
        ? (footerCache.get(page.footerSheetName) ??
          (() => {
            const parsedFooter = buildFooterFromSettings(model.settings, model.entityName);
            footerCache.set(page.footerSheetName, parsedFooter);
            return parsedFooter;
          })())
        : undefined;
      const visibleEndRow =
        footer && page.footerSheetName === page.sheetName && footer.footerBlockStartRow !== undefined
          ? Math.min(page.endRow, footer.footerBlockStartRow)
          : page.endRow;
      const rows = getSheetRows(sheet, page.columns, page.valueColumns).slice(page.startRow, visibleEndRow);
      const valueColumnIndexes = page.columns
        .map((columnIndex, visibleIndex) => (page.valueColumns.includes(columnIndex) ? visibleIndex : -1))
        .filter((index) => index >= 0);
      const repeatedHeaderRows = rows.filter((row) => row.kind === "header" || row.kind === "subheader").slice(0, 2);
      renderTableRows(doc, rows, page.widths, valueColumnIndexes, {
        reserveBottom: footer ? 190 : 36,
        onPageBreak: () => {
          drawBrandHeader(doc, model.entityName, page.title, page.subtitle, page.continuationTitle ?? `${page.title} (contd.)`);
        },
        repeatedHeaderRows,
      });

      if (footer) {
        drawFooter(doc, footer);
      }
    });

    doc.end();
  });
}
