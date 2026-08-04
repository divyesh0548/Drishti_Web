import type { WorkBook, WorkSheet, CellObject } from "xlsx";

import type { StatementPack } from "@/lib/statement-pack";

/**
 * Option B: map StatementPack note totals into the XYZ desired-structure cells.
 * Pack amounts are already in Rs. lakhs (same unit as XYZ Input!C2 = 100000).
 *
 * Strategy:
 * 1. Write totals into the note/PPE source cells that BS/PL formulas reference.
 * 2. Also write the same totals onto BS/PL amount cells as values so the report
 *    shows company data even when Excel does not recalculate.
 */

export type XyzAmountSource =
  | { kind: "note"; noteNumber: string }
  | { kind: "literal"; current: number; previous: number };

export type XyzCellPair = {
  label: string;
  source: XyzAmountSource;
  /** Note / working sheet cells (current, previous). */
  noteCells?: { sheet: string; current: string; previous: string };
  /** Statement face cells (current, previous). */
  statementCells?: { sheet: string; current: string; previous: string };
};

/**
 * Semantic map: portal pack noteNumber → XYZ template cells.
 * XYZ Ind AS note numbers on the face differ; we map by meaning, not face note no.
 */
export const XYZ_PACK_CELL_MAP: XyzCellPair[] = [
  // --- Non-current assets ---
  {
    label: "Property, Plant & Equipment",
    source: { kind: "note", noteNumber: "12" },
    noteCells: { sheet: "PPE- note 3", current: "J17", previous: "K17" },
    statementCells: { sheet: "BS", current: "D8", previous: "E8" },
  },
  {
    label: "Right of Use Assets",
    source: { kind: "literal", current: 0, previous: 0 },
    noteCells: { sheet: "PPE- note 3", current: "J23", previous: "K23" },
    statementCells: { sheet: "BS", current: "D9", previous: "E9" },
  },
  {
    label: "Capital work-in-progress",
    source: { kind: "literal", current: 0, previous: 0 },
    noteCells: { sheet: "PPE- note 3", current: "J18", previous: "K18" },
    statementCells: { sheet: "BS", current: "D10", previous: "E10" },
  },
  {
    label: "Intangible assets",
    source: { kind: "literal", current: 0, previous: 0 },
    noteCells: { sheet: "PPE- note 3", current: "J27", previous: "K27" },
    statementCells: { sheet: "BS", current: "D11", previous: "E11" },
  },
  {
    label: "Investments (no separate pack note — cleared)",
    source: { kind: "literal", current: 0, previous: 0 },
    noteCells: { sheet: "BS  Notes  4-19", current: "G11", previous: "H11" },
    statementCells: { sheet: "BS", current: "D13", previous: "E13" },
  },
  {
    label: "Loans (non-current) — pack short-term loans as nearest source",
    source: { kind: "note", noteNumber: "17" },
    noteCells: { sheet: "BS  Notes  4-19", current: "G21", previous: "H21" },
    statementCells: { sheet: "BS", current: "D14", previous: "E14" },
  },
  {
    label: "Other Financial Assets (non-current)",
    source: { kind: "literal", current: 0, previous: 0 },
    noteCells: { sheet: "BS  Notes  4-19", current: "G33", previous: "H33" },
    statementCells: { sheet: "BS", current: "D15", previous: "E15" },
  },
  {
    label: "Deferred Tax Assets / Liabilities (Net)",
    source: { kind: "note", noteNumber: "6" },
    noteCells: { sheet: "BS  Notes  4-19", current: "G328", previous: "H328" },
    statementCells: { sheet: "BS", current: "D16", previous: "E16" },
  },
  {
    label: "Other Tax Assets (Net)",
    source: { kind: "literal", current: 0, previous: 0 },
    noteCells: { sheet: "BS  Notes  4-19", current: "G44", previous: "H44" },
    statementCells: { sheet: "BS", current: "D17", previous: "E17" },
  },
  {
    label: "Other Non Current Assets",
    source: { kind: "note", noteNumber: "13" },
    noteCells: { sheet: "BS  Notes  4-19", current: "G54", previous: "H54" },
    statementCells: { sheet: "BS", current: "D18", previous: "E18" },
  },

  // --- Current assets ---
  {
    label: "Inventories",
    source: { kind: "note", noteNumber: "14" },
    noteCells: { sheet: "BS  Notes  4-19", current: "G76", previous: "H76" },
    statementCells: { sheet: "BS", current: "D22", previous: "E22" },
  },
  {
    label: "Trade Receivables",
    source: { kind: "note", noteNumber: "15" },
    noteCells: { sheet: "BS  Notes  4-19", current: "G90", previous: "H90" },
    statementCells: { sheet: "BS", current: "D24", previous: "E24" },
  },
  {
    label: "Cash and Cash Equivalents",
    source: { kind: "note", noteNumber: "16" },
    noteCells: { sheet: "BS  Notes  4-19", current: "G118", previous: "H118" },
    statementCells: { sheet: "BS", current: "D25", previous: "E25" },
  },
  {
    label: "Current Tax Assets (net)",
    source: { kind: "literal", current: 0, previous: 0 },
    noteCells: { sheet: "BS  Notes  4-19", current: "G48", previous: "H48" },
    statementCells: { sheet: "BS", current: "D26", previous: "E26" },
  },
  {
    label: "Bank balances other than cash",
    source: { kind: "literal", current: 0, previous: 0 },
    noteCells: { sheet: "BS  Notes  4-19", current: "G122", previous: "H122" },
    statementCells: { sheet: "BS", current: "D28", previous: "E28" },
  },
  {
    label: "Other Current Assets",
    source: { kind: "note", noteNumber: "18" },
    noteCells: { sheet: "BS  Notes  4-19", current: "G131", previous: "H131" },
    statementCells: { sheet: "BS", current: "D29", previous: "E29" },
  },

  // --- Equity ---
  {
    label: "Equity Share Capital",
    source: { kind: "note", noteNumber: "3" },
    noteCells: { sheet: "BS  Notes  4-19", current: "G146", previous: "H146" },
    statementCells: { sheet: "BS", current: "D35", previous: "E35" },
  },
  {
    label: "Instrument entirely equity in nature",
    source: { kind: "literal", current: 0, previous: 0 },
    noteCells: { sheet: "BS  Notes  4-19", current: "G197", previous: "H197" },
    statementCells: { sheet: "BS", current: "D36", previous: "E36" },
  },
  {
    label: "Other Equity",
    source: { kind: "note", noteNumber: "4" },
    noteCells: { sheet: "BS  Notes  4-19", current: "G227", previous: "H227" },
    statementCells: { sheet: "BS", current: "D37", previous: "E37" },
  },

  // --- Liabilities ---
  {
    label: "Non-current Borrowings",
    source: { kind: "note", noteNumber: "5" },
    noteCells: { sheet: "BS  Notes  4-19", current: "G263", previous: "H263" },
    statementCells: { sheet: "BS", current: "D43", previous: "E43" },
  },
  {
    label: "Non-current Provisions",
    source: { kind: "note", noteNumber: "7" },
    noteCells: { sheet: "BS  Notes  4-19", current: "G306", previous: "H306" },
    statementCells: { sheet: "BS", current: "D45", previous: "E45" },
  },
  {
    label: "Current Borrowings",
    source: { kind: "note", noteNumber: "8" },
    noteCells: { sheet: "BS  Notes  4-19", current: "G275", previous: "H275" },
    statementCells: { sheet: "BS", current: "D50", previous: "E50" },
  },
  {
    label: "Trade Payables — MSME (split unavailable)",
    source: { kind: "literal", current: 0, previous: 0 },
    noteCells: { sheet: "BS  Notes  4-19", current: "G421", previous: "H421" },
    statementCells: { sheet: "BS", current: "D53", previous: "E53" },
  },
  {
    label: "Trade Payables — others",
    source: { kind: "note", noteNumber: "9" },
    noteCells: { sheet: "BS  Notes  4-19", current: "G422", previous: "H422" },
    statementCells: { sheet: "BS", current: "D54", previous: "E54" },
  },
  {
    label: "Other Financial Liabilities",
    source: { kind: "literal", current: 0, previous: 0 },
    noteCells: { sheet: "BS  Notes  4-19", current: "G469", previous: "H469" },
    statementCells: { sheet: "BS", current: "D55", previous: "E55" },
  },
  {
    label: "Other Current Liabilities",
    source: { kind: "note", noteNumber: "10" },
    noteCells: { sheet: "BS  Notes  4-19", current: "G475", previous: "H475" },
    statementCells: { sheet: "BS", current: "D56", previous: "E56" },
  },
  {
    label: "Current Provisions",
    source: { kind: "note", noteNumber: "11" },
    noteCells: { sheet: "BS  Notes  4-19", current: "G311", previous: "H311" },
    statementCells: { sheet: "BS", current: "D58", previous: "E58" },
  },

  // --- Profit & Loss ---
  {
    label: "Revenue from Operations",
    source: { kind: "note", noteNumber: "19" },
    noteCells: { sheet: "PL Notes 20-27", current: "C17", previous: "D17" },
    statementCells: { sheet: "PL", current: "D8", previous: "E8" },
  },
  {
    label: "Other Income",
    source: { kind: "note", noteNumber: "20" },
    noteCells: { sheet: "PL Notes 20-27", current: "C36", previous: "D36" },
    statementCells: { sheet: "PL", current: "D9", previous: "E9" },
  },
  {
    label: "Cost of materials consumed",
    source: { kind: "note", noteNumber: "21-materials" },
    noteCells: { sheet: "PL Notes 20-27", current: "C51", previous: "D51" },
    statementCells: { sheet: "PL", current: "D13", previous: "E13" },
  },
  {
    label: "Purchase of stock-in-trade",
    source: { kind: "literal", current: 0, previous: 0 },
    statementCells: { sheet: "PL", current: "D14", previous: "E14" },
  },
  {
    label: "Changes in inventories",
    source: { kind: "note", noteNumber: "21-inventory" },
    noteCells: { sheet: "PL Notes 20-27", current: "C64", previous: "D64" },
    statementCells: { sheet: "PL", current: "D15", previous: "E15" },
  },
  {
    label: "Employee Benefits Expense",
    source: { kind: "note", noteNumber: "22" },
    noteCells: { sheet: "PL Notes 20-27", current: "C74", previous: "D74" },
    statementCells: { sheet: "PL", current: "D16", previous: "E16" },
  },
  {
    label: "Finance Costs",
    source: { kind: "note", noteNumber: "23" },
    noteCells: { sheet: "PL Notes 20-27", current: "C86", previous: "D86" },
    statementCells: { sheet: "PL", current: "D17", previous: "E17" },
  },
  {
    label: "Depreciation and Amortisation",
    source: { kind: "note", noteNumber: "24" },
    statementCells: { sheet: "PL", current: "D18", previous: "E18" },
  },
  {
    label: "Other Expenses",
    source: { kind: "note", noteNumber: "25" },
    noteCells: { sheet: "PL Notes 20-27", current: "C111", previous: "D111" },
    statementCells: { sheet: "PL", current: "D19", previous: "E19" },
  },
  {
    label: "Current Tax",
    source: { kind: "note", noteNumber: "26" },
    statementCells: { sheet: "PL", current: "D23", previous: "E23" },
  },
  {
    label: "Deferred Tax (P&L)",
    source: { kind: "literal", current: 0, previous: 0 },
    statementCells: { sheet: "PL", current: "D24", previous: "E24" },
  },
];

function roundLakhs(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

export function resolvePackAmount(pack: StatementPack, source: XyzAmountSource): { current: number; previous: number } {
  if (source.kind === "literal") {
    return {
      current: roundLakhs(source.current),
      previous: roundLakhs(source.previous),
    };
  }

  const note = pack.notes.find((entry) => entry.noteNumber === source.noteNumber);
  return {
    current: roundLakhs(note?.totalCurrent ?? 0),
    previous: roundLakhs(note?.totalPrevious ?? 0),
  };
}

function setNumericCell(sheet: WorkSheet | undefined, address: string, value: number) {
  if (!sheet) {
    return;
  }

  const existing = (sheet[address] ?? {}) as CellObject;
  const next: CellObject = {
    ...existing,
    t: "n",
    v: value,
  };
  delete next.f;
  delete next.w;
  sheet[address] = next;
}

/**
 * Apply StatementPack totals onto the XYZ workbook cell map.
 */
export function applyXyzPackCellMap(workbook: WorkBook, pack: StatementPack) {
  XYZ_PACK_CELL_MAP.forEach((entry) => {
    const amount = resolvePackAmount(pack, entry.source);

    if (entry.noteCells) {
      setNumericCell(workbook.Sheets[entry.noteCells.sheet], entry.noteCells.current, amount.current);
      setNumericCell(workbook.Sheets[entry.noteCells.sheet], entry.noteCells.previous, amount.previous);
    }

    if (entry.statementCells) {
      setNumericCell(workbook.Sheets[entry.statementCells.sheet], entry.statementCells.current, amount.current);
      setNumericCell(workbook.Sheets[entry.statementCells.sheet], entry.statementCells.previous, amount.previous);
    }
  });

  // PPE depreciation charge used by template PL formulas (sum G17+G23+G27).
  const depreciation = resolvePackAmount(pack, { kind: "note", noteNumber: "24" });
  setNumericCell(workbook.Sheets["PPE- note 3"], "G17", depreciation.current);
  setNumericCell(workbook.Sheets["PPE- note 3"], "G23", 0);
  setNumericCell(workbook.Sheets["PPE- note 3"], "G27", 0);

  applyCashFlowPackValues(workbook, pack);
}

function findCashFlowRow(pack: StatementPack, particulars: string) {
  return pack.cashFlow.rows.find((row) => row.particulars === particulars);
}

function applyCashFlowPackValues(workbook: WorkBook, pack: StatementPack) {
  const sheet = workbook.Sheets["Cash Flow_FY26"];
  if (!sheet) {
    return;
  }

  // Write pack cash-flow section totals into XYZ net lines (template formulas replaced with company values).
  const mappings: Array<{ particulars: string; current: string; previous: string }> = [
    { particulars: "Net cash from operating activities", current: "C29", previous: "D29" },
    { particulars: "Net cash from investing activities", current: "C40", previous: "D40" },
    { particulars: "Net cash from financing activities", current: "C51", previous: "D51" },
    { particulars: "Net increase / (decrease) in cash and cash equivalents", current: "C53", previous: "D53" },
    { particulars: "Opening cash and cash equivalents", current: "C54", previous: "D54" },
    { particulars: "Closing cash and cash equivalents", current: "C55", previous: "D55" },
  ];

  mappings.forEach((mapping) => {
    const row = findCashFlowRow(pack, mapping.particulars);
    if (!row) {
      return;
    }
    setNumericCell(sheet, mapping.current, roundLakhs(row.current ?? 0));
    setNumericCell(sheet, mapping.previous, roundLakhs(row.previous ?? 0));
  });

  // XYZ "Total Cash and Cash Equivalents" footnote block.
  setNumericCell(sheet, "C59", roundLakhs(pack.cashFlow.closingCashCurrent));
  setNumericCell(sheet, "D59", roundLakhs(pack.cashFlow.closingCashPrevious));
}
