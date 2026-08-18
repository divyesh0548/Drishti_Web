import type { WorkBook, WorkSheet, CellObject } from "xlsx";

import type { StatementPack } from "@/lib/statement-pack";

/**
 * Option B: map StatementPack note totals into the LTEL desired-structure cells.
 * Pack amounts are in Rs. lakhs (portal standard / LTEL settings.unitsLabel).
 *
 * LTEL face note numbers differ from portal note numbers — map by meaning.
 */

export type LtelAmountSource =
  | { kind: "note"; noteNumber: string }
  | { kind: "literal"; current: number; previous: number };

export type LtelCellPair = {
  label: string;
  source: LtelAmountSource;
  noteCells?: { sheet: string; current: string; previous: string };
  statementCells?: { sheet: string; current: string; previous: string };
};

export const LTEL_PACK_CELL_MAP: LtelCellPair[] = [
  // --- Non-current assets ---
  {
    label: "Property, plant and equipment",
    source: { kind: "note", noteNumber: "12" },
    noteCells: { sheet: " 2", current: "J17", previous: "K17" },
    statementCells: { sheet: "BS", current: "E9", previous: "G9" },
  },
  {
    label: "Capital work-in-progress",
    source: { kind: "literal", current: 0, previous: 0 },
    noteCells: { sheet: "3 CWIP", current: "F13", previous: "B13" },
    statementCells: { sheet: "BS", current: "E10", previous: "G10" },
  },
  {
    label: "Other intangible assets",
    source: { kind: "literal", current: 0, previous: 0 },
    noteCells: { sheet: " 4", current: "J13", previous: "K13" },
    statementCells: { sheet: "BS", current: "E11", previous: "G11" },
  },
  {
    label: "Intangible assets under development",
    source: { kind: "literal", current: 0, previous: 0 },
    noteCells: { sheet: "5", current: "B11", previous: "C11" },
    statementCells: { sheet: "BS", current: "E12", previous: "G12" },
  },
  {
    label: "Right-of-use assets",
    source: { kind: "literal", current: 0, previous: 0 },
    noteCells: { sheet: " 2", current: "J27", previous: "K27" },
    statementCells: { sheet: "BS", current: "E13", previous: "G13" },
  },
  {
    label: "Other non current assets",
    source: { kind: "note", noteNumber: "13" },
    statementCells: { sheet: "BS", current: "E14", previous: "G14" },
  },

  // --- Current assets ---
  {
    label: "Inventories",
    source: { kind: "note", noteNumber: "14" },
    noteCells: { sheet: "6", current: "B14", previous: "C14" },
    statementCells: { sheet: "BS", current: "E18", previous: "G18" },
  },
  {
    label: "Investments",
    source: { kind: "literal", current: 0, previous: 0 },
    noteCells: { sheet: "7", current: "B10", previous: "C10" },
    statementCells: { sheet: "BS", current: "E20", previous: "G20" },
  },
  {
    label: "Trade receivables",
    source: { kind: "note", noteNumber: "15" },
    noteCells: { sheet: "8", current: "B10", previous: "C10" },
    statementCells: { sheet: "BS", current: "E21", previous: "G21" },
  },
  {
    label: "Cash and cash equivalents",
    source: { kind: "note", noteNumber: "16" },
    noteCells: { sheet: "9", current: "B11", previous: "C11" },
    statementCells: { sheet: "BS", current: "E22", previous: "G22" },
  },
  {
    label: "Other current financial assets",
    source: { kind: "note", noteNumber: "17" },
    noteCells: { sheet: "10", current: "B13", previous: "C13" },
    statementCells: { sheet: "BS", current: "E23", previous: "G23" },
  },
  {
    label: "Other current assets",
    source: { kind: "note", noteNumber: "18" },
    noteCells: { sheet: "11", current: "B17", previous: "C17" },
    statementCells: { sheet: "BS", current: "E24", previous: "G24" },
  },

  // --- Equity ---
  {
    label: "Equity share capital",
    source: { kind: "note", noteNumber: "3" },
    noteCells: { sheet: "12", current: "B16", previous: "C12" },
    statementCells: { sheet: "BS", current: "E31", previous: "G31" },
  },
  {
    label: "Other equity",
    source: { kind: "note", noteNumber: "4" },
    noteCells: { sheet: "13", current: "E14", previous: "E26" },
    statementCells: { sheet: "BS", current: "E32", previous: "G32" },
  },

  // --- Liabilities ---
  {
    label: "Current borrowings",
    source: { kind: "note", noteNumber: "8" },
    noteCells: { sheet: "14", current: "B12", previous: "C12" },
    statementCells: { sheet: "BS", current: "E41", previous: "G41" },
  },
  {
    label: "Trade payables",
    source: { kind: "note", noteNumber: "9" },
    noteCells: { sheet: "15", current: "B12", previous: "C12" },
    statementCells: { sheet: "BS", current: "E43", previous: "G43" },
  },
  {
    label: "Other financial liabilities",
    source: { kind: "literal", current: 0, previous: 0 },
    noteCells: { sheet: "16", current: "B13", previous: "C13" },
    statementCells: { sheet: "BS", current: "E44", previous: "G44" },
  },
  {
    label: "Other current liabilities",
    source: { kind: "note", noteNumber: "10" },
    noteCells: { sheet: "17", current: "B19", previous: "C19" },
    statementCells: { sheet: "BS", current: "E45", previous: "G45" },
  },
  {
    label: "Provisions",
    source: { kind: "note", noteNumber: "11" },
    noteCells: { sheet: "18", current: "B12", previous: "C12" },
    statementCells: { sheet: "BS", current: "E46", previous: "G46" },
  },

  // --- Profit and loss ---
  {
    label: "Revenue from operations",
    source: { kind: "note", noteNumber: "19" },
    noteCells: { sheet: "19", current: "B10", previous: "C8" },
    statementCells: { sheet: "PL", current: "E6", previous: "G6" },
  },
  {
    label: "Other income",
    source: { kind: "note", noteNumber: "20" },
    noteCells: { sheet: "20", current: "B15", previous: "C15" },
    statementCells: { sheet: "PL", current: "E7", previous: "G7" },
  },
  {
    label: "Cost of raw materials and components consumed",
    source: { kind: "note", noteNumber: "21" },
    noteCells: { sheet: "21", current: "B18", previous: "C18" },
    statementCells: { sheet: "PL", current: "D11", previous: "F11" },
  },
  {
    label: "Change in inventories of finished goods / WIP",
    source: { kind: "note", noteNumber: "22" },
    noteCells: { sheet: "21", current: "B51", previous: "C51" },
    statementCells: { sheet: "PL", current: "D13", previous: "F13" },
  },
  {
    label: "Employee benefit expenses",
    source: { kind: "note", noteNumber: "23" },
    noteCells: { sheet: "22", current: "B13", previous: "C13" },
    statementCells: { sheet: "PL", current: "E14", previous: "G14" },
  },
  {
    label: "Selling, administration and other expenses",
    source: { kind: "note", noteNumber: "26" },
    noteCells: { sheet: "23", current: "B29", previous: "C29" },
    statementCells: { sheet: "PL", current: "E15", previous: "G15" },
  },
  {
    label: "Finance costs",
    source: { kind: "note", noteNumber: "24" },
    noteCells: { sheet: "24", current: "B14", previous: "C14" },
    statementCells: { sheet: "PL", current: "E16", previous: "G16" },
  },
  {
    label: "Depreciation and amortization",
    source: { kind: "note", noteNumber: "25" },
    noteCells: { sheet: "25", current: "B12", previous: "C12" },
    statementCells: { sheet: "PL", current: "E17", previous: "G17" },
  },
];

function roundLakhs(value: number) {
  return Math.round(value);
}

function resolvePackAmount(pack: StatementPack, source: LtelAmountSource) {
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
    v: Math.round(value),
    z: "#,##0;(#,##0);-",
  };
  delete next.f;
  delete next.w;
  sheet[address] = next;
}

function findCashFlowRow(pack: StatementPack, particulars: string) {
  return pack.cashFlow.rows.find((row) => row.particulars === particulars);
}

function applyCashFlowPackValues(workbook: WorkBook, pack: StatementPack) {
  const sheet = workbook.Sheets.CashFlow;
  if (!sheet) {
    return;
  }

  const mappings: Array<{ particulars: string; current: string; previous: string }> = [
    { particulars: "Net cash from operating activities", current: "C24", previous: "D24" },
    { particulars: "Net cash from investing activities", current: "C32", previous: "D32" },
    { particulars: "Net cash from financing activities", current: "C41", previous: "D41" },
    { particulars: "Net increase / (decrease) in cash and cash equivalents", current: "C43", previous: "D43" },
    { particulars: "Opening cash and cash equivalents", current: "C44", previous: "D44" },
    { particulars: "Closing cash and cash equivalents", current: "C45", previous: "D45" },
  ];

  mappings.forEach((mapping) => {
    const row = findCashFlowRow(pack, mapping.particulars);
    if (!row) {
      return;
    }
    setNumericCell(sheet, mapping.current, roundLakhs(row.current ?? 0));
    setNumericCell(sheet, mapping.previous, roundLakhs(row.previous ?? 0));
  });
}

/**
 * Apply StatementPack totals onto the LTEL workbook cell map.
 */
export function applyLtelPackCellMap(workbook: WorkBook, pack: StatementPack) {
  LTEL_PACK_CELL_MAP.forEach((entry) => {
    const amount = resolvePackAmount(pack, entry.source);

    if (entry.noteCells) {
      setNumericCell(workbook.Sheets[entry.noteCells.sheet], entry.noteCells.current, amount.current);
      setNumericCell(workbook.Sheets[entry.noteCells.sheet], entry.noteCells.previous, amount.previous);
    }

    if (entry.statementCells) {
      setNumericCell(
        workbook.Sheets[entry.statementCells.sheet],
        entry.statementCells.current,
        amount.current,
      );
      setNumericCell(
        workbook.Sheets[entry.statementCells.sheet],
        entry.statementCells.previous,
        amount.previous,
      );
    }
  });

  applyCashFlowPackValues(workbook, pack);
}
