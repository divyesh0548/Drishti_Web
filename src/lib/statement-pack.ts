import {
  getLedgerSubgroupOptions,
  noteTitleByNumber,
} from "@/lib/ledger-groupings";
import {
  normalizeStatementLineOverrides,
  type StatementLineOverride,
  type StatementOverrideArea,
} from "@/lib/statement-line-overrides";
import {
  getTrialBalanceSnapshot,
  type LedgerRow,
  type TrialBalanceSnapshot,
} from "@/lib/trial-balance";

export type StatementDisplayRow = {
  particulars: string;
  note?: string;
  current?: number;
  previous?: number;
  emphasis?: "section" | "heading" | "line" | "total";
};

export type CashFlowRow = {
  particulars: string;
  current?: number;
  previous?: number;
  emphasis?: "section" | "line" | "total";
};

export type NoteScheduleRow = {
  ledgerReference?: string;
  particulars: string;
  current?: number;
  previous?: number;
  classificationBasis?: string;
  emphasis?: "heading" | "line" | "total";
};

export type NoteSchedule = {
  noteNumber: string;
  title: string;
  sheetName: string;
  statementArea: "general" | "balance-sheet" | "profit-and-loss";
  kind: "text" | "table";
  paragraphs?: string[];
  rows?: NoteScheduleRow[];
  totalCurrent?: number;
  totalPrevious?: number;
};

export type StatementPack = {
  entityName: string;
  reportTitle: string;
  sourceName: string;
  sourcePath: string;
  generatedAt: string;
  reportingLabels: {
    current: string;
    previous: string;
  };
  balanceSheet: {
    rows: StatementDisplayRow[];
    totalCurrent: number;
    totalPrevious: number;
  };
  profitAndLoss: {
    rows: StatementDisplayRow[];
    profitBeforeTax: number;
    profitBeforeTaxPrevious: number;
    profitAfterTax: number;
    profitAfterTaxPrevious: number;
  };
  cashFlow: {
    rows: CashFlowRow[];
    netIncreaseCurrent: number;
    netIncreasePrevious: number;
    openingCashCurrent: number;
    openingCashPrevious: number;
    closingCashCurrent: number;
    closingCashPrevious: number;
  };
  notes: NoteSchedule[];
  reviewFlags: TrialBalanceSnapshot["reviewFlags"];
  accountingAssumptions: string[];
};

type ComparativeAmount = {
  current: number;
  previous: number;
};

type BuiltNote = NoteSchedule & {
  totalCurrent: number;
  totalPrevious: number;
};

type BuiltBalanceSheet = {
  rows: StatementDisplayRow[];
  totalCurrent: number;
  totalPrevious: number;
  totalEquityAndLiabilitiesCurrent: number;
  totalEquityAndLiabilitiesPrevious: number;
};

type BuiltProfitAndLoss = {
  rows: StatementDisplayRow[];
  profitBeforeTax: number;
  profitBeforeTaxPrevious: number;
  profitAfterTax: number;
  profitAfterTaxPrevious: number;
};

type StatementLineConfig = {
  particulars: string;
  noteNumber: string;
};

type StatementPackScope = Parameters<typeof getTrialBalanceSnapshot>[0] & {
  statementLineOverrides?: StatementLineOverride[];
};

const subgroupRank = new Map(
  getLedgerSubgroupOptions().map((option, index) => [option.key, index]),
);
const amountScale = 100000;

function isDisplayZero(value: number | undefined) {
  return value === undefined || Math.abs(value) < 0.5;
}

function displayAmount(row: LedgerRow, year: "current" | "previous") {
  const value = year === "current" ? row.currentYear : row.previousYear;
  const scaledValue = value / amountScale;

  if (
    row.accountClass === "equity-liability" ||
    row.accountClass === "income"
  ) {
    return scaledValue * -1;
  }

  return scaledValue;
}

function sumLedgerRows(rows: LedgerRow[]): ComparativeAmount {
  return rows.reduce<ComparativeAmount>(
    (accumulator, row) => ({
      current: accumulator.current + displayAmount(row, "current"),
      previous: accumulator.previous + displayAmount(row, "previous"),
    }),
    { current: 0, previous: 0 },
  );
}

function toNoteRows(rows: LedgerRow[]) {
  const groupedRows = rows.reduce<Record<string, LedgerRow[]>>(
    (accumulator, row) => {
      const key =
        row.subgroupKey || row.groupingKey || row.noteNumber || "ungrouped";
      accumulator[key] = [...(accumulator[key] ?? []), row];
      return accumulator;
    },
    {},
  );
  const groupKeys = Object.keys(groupedRows).sort((left, right) => {
    const leftRank = subgroupRank.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = subgroupRank.get(right) ?? Number.MAX_SAFE_INTEGER;
    return leftRank - rightRank || left.localeCompare(right);
  });

  return groupKeys
    .map<NoteScheduleRow>((groupKey) => {
      const entries = groupedRows[groupKey];
      const firstRow = entries[0];
      const particulars =
        firstRow?.subgroupLabel?.trim() ||
        firstRow?.derivedLabel?.trim() ||
        firstRow?.glDescription?.trim() ||
        "Particulars";
      const totals = entries.reduce<ComparativeAmount>(
        (accumulator, row) => ({
          current: accumulator.current + displayAmount(row, "current"),
          previous: accumulator.previous + displayAmount(row, "previous"),
        }),
        { current: 0, previous: 0 },
      );
      const ledgerReference = [
        ...new Set(entries.map((row) => row.glNumber).filter(Boolean)),
      ]
        .sort((left, right) => left.localeCompare(right))
        .join(", ");
      const classificationBasis = [
        ...new Set(
          entries.map((row) => row.classificationBasis).filter(Boolean),
        ),
      ].join(" | ");

      return {
        particulars,
        ledgerReference,
        current: totals.current,
        previous: totals.previous,
        classificationBasis,
        emphasis: "line",
      };
    })
    .sort(
      (left, right) =>
        Math.abs(right.current ?? 0) - Math.abs(left.current ?? 0),
    );
}

function buildTextNote(input: {
  noteNumber: string;
  title: string;
  sheetName: string;
  statementArea: NoteSchedule["statementArea"];
  paragraphs: string[];
}): BuiltNote {
  return {
    ...input,
    kind: "text",
    totalCurrent: 0,
    totalPrevious: 0,
  };
}

function buildTableNote(input: {
  noteNumber: string;
  title: string;
  sheetName: string;
  statementArea: NoteSchedule["statementArea"];
  rows: LedgerRow[];
  }): BuiltNote | null {
  if (input.rows.length === 0) {
    return null;
  }

  const totals = sumLedgerRows(input.rows);

  return {
    noteNumber: input.noteNumber,
    title: input.title,
    sheetName: input.sheetName,
    statementArea: input.statementArea,
    kind: "table",
    rows: toNoteRows(input.rows),
    totalCurrent: totals.current,
    totalPrevious: totals.previous,
  };
}

function getFirstNoteAmount(notes: BuiltNote[], noteNumber: string) {
  const note = notes.find((entry) => entry.noteNumber === noteNumber);
  return note
    ? { current: note.totalCurrent, previous: note.totalPrevious }
    : { current: 0, previous: 0 };
}

function buildStatementLine(
  note: BuiltNote | null,
  particulars: string,
  ): StatementDisplayRow | null {
  if (!note) {
    return null;
  }

  return {
    particulars,
    note: note.noteNumber,
    current: note.totalCurrent,
    previous: note.totalPrevious,
    emphasis: "line",
  };
}

function buildStatementOverrideMap(overrides?: StatementLineOverride[]) {
  return new Map(
    normalizeStatementLineOverrides(overrides).map((override) => [
      `${override.statementArea}:${override.particulars}`,
      override.noteNumber,
    ]),
  );
}

function buildConfiguredStatementLine(
  notes: BuiltNote[],
  overrides: Map<string, string>,
  statementArea: StatementOverrideArea,
  config: StatementLineConfig,
) {
  const overrideKey = `${statementArea}:${config.particulars}`;
  const effectiveNoteNumber = overrides.has(overrideKey)
    ? overrides.get(overrideKey) ?? ""
    : config.noteNumber;

  if (!effectiveNoteNumber) {
    return null;
  }

  const note = notes.find((entry) => entry.noteNumber === effectiveNoteNumber) ?? null;
  return buildStatementLine(note, config.particulars);
}

function sumStatementRows(rows: Array<StatementDisplayRow | null>) {
  return rows.reduce<ComparativeAmount>(
    (accumulator, row) => ({
      current: accumulator.current + (row?.current ?? 0),
      previous: accumulator.previous + (row?.previous ?? 0),
    }),
    { current: 0, previous: 0 },
  );
}

function buildCashFlowStatement(
  notes: BuiltNote[],
  snapshot: TrialBalanceSnapshot,
  ) {
  const inventories = getFirstNoteAmount(notes, "14");
  const receivables = getFirstNoteAmount(notes, "15");
  const cashAndCashEquivalents = getFirstNoteAmount(notes, "16");
  const shortTermLoansAndAdvances = getFirstNoteAmount(notes, "17");
  const otherCurrentAssets = getFirstNoteAmount(notes, "18");
  const longTermBorrowings = getFirstNoteAmount(notes, "5");
  const shareCapital = getFirstNoteAmount(notes, "3");
  const shortTermBorrowings = getFirstNoteAmount(notes, "8");
  const tradePayables = getFirstNoteAmount(notes, "9");
  const otherCurrentLiabilities = getFirstNoteAmount(notes, "10");
  const shortTermProvisions = getFirstNoteAmount(notes, "11");
  const otherNonCurrentAssets = getFirstNoteAmount(notes, "13");
  const ppeAndIntangibles = getFirstNoteAmount(notes, "12");
  const financeCosts = getFirstNoteAmount(notes, "23");
  const depreciation = getFirstNoteAmount(notes, "24");
  const taxExpense = getFirstNoteAmount(notes, "26");

  const inventoryMovementCurrent = inventories.previous - inventories.current;
  const inventoryMovementPrevious = 0;
  const receivableMovementCurrent = receivables.previous - receivables.current;
  const receivableMovementPrevious = 0;
  const otherCurrentAssetsMovementCurrent =
    shortTermLoansAndAdvances.previous -
    shortTermLoansAndAdvances.current +
    otherCurrentAssets.previous -
    otherCurrentAssets.current;
  const otherCurrentAssetsMovementPrevious = 0;
  const tradePayablesMovementCurrent =
    tradePayables.current - tradePayables.previous;
  const tradePayablesMovementPrevious = 0;
  const otherLiabilitiesMovementCurrent =
    otherCurrentLiabilities.current -
    otherCurrentLiabilities.previous +
    shortTermProvisions.current -
    shortTermProvisions.previous;
  const otherLiabilitiesMovementPrevious = 0;

  const netCashFromOperatingCurrent =
    snapshot.profitAndLoss.profitAfterTax +
    depreciation.current +
    financeCosts.current +
    taxExpense.current +
    inventoryMovementCurrent +
    receivableMovementCurrent +
    otherCurrentAssetsMovementCurrent +
    tradePayablesMovementCurrent +
    otherLiabilitiesMovementCurrent;

  const netCashFromOperatingPrevious =
    snapshot.profitAndLoss.profitAfterTaxPrevious +
    depreciation.previous +
    financeCosts.previous +
    taxExpense.previous;

  const netCashFromInvestingCurrent =
    ppeAndIntangibles.previous -
    ppeAndIntangibles.current +
    (otherNonCurrentAssets.previous - otherNonCurrentAssets.current);
  const netCashFromInvestingPrevious = 0;

  const openingCashCurrent = cashAndCashEquivalents.previous;
  const openingCashPrevious = 0;
  const closingCashCurrent = cashAndCashEquivalents.current;
  const closingCashPrevious = cashAndCashEquivalents.previous;
  const netIncreaseCurrent = closingCashCurrent - openingCashCurrent;
  const netIncreasePrevious = closingCashPrevious - openingCashPrevious;

  const equityMovementCurrent = shareCapital.current - shareCapital.previous;
  const equityMovementPrevious = shareCapital.previous;
  const longTermBorrowingMovementCurrent =
    longTermBorrowings.current - longTermBorrowings.previous;
  const longTermBorrowingMovementPrevious = longTermBorrowings.previous;
  const shortTermBorrowingMovementCurrent =
    shortTermBorrowings.current - shortTermBorrowings.previous;
  const shortTermBorrowingMovementPrevious = shortTermBorrowings.previous;

  const knownFinancingCurrent =
    equityMovementCurrent +
    longTermBorrowingMovementCurrent +
    shortTermBorrowingMovementCurrent -
    financeCosts.current;
  const knownFinancingPrevious =
    equityMovementPrevious +
    longTermBorrowingMovementPrevious +
    shortTermBorrowingMovementPrevious -
    financeCosts.previous;

  const netCashFromFinancingCurrent =
    netIncreaseCurrent -
    netCashFromOperatingCurrent -
    netCashFromInvestingCurrent;
  const netCashFromFinancingPrevious =
    netIncreasePrevious -
    netCashFromOperatingPrevious -
    netCashFromInvestingPrevious;

  const financingResidualCurrent =
    netCashFromFinancingCurrent - knownFinancingCurrent;
  const financingResidualPrevious =
    netCashFromFinancingPrevious - knownFinancingPrevious;

  const rows: CashFlowRow[] = [
    { particulars: "Cash flow from operating activities", emphasis: "section" },
    {
      particulars: "Profit after tax",
      current: snapshot.profitAndLoss.profitAfterTax,
      previous: snapshot.profitAndLoss.profitAfterTaxPrevious,
      emphasis: "line",
    },
    {
      particulars: "Depreciation and amortisation",
      current: depreciation.current,
      previous: depreciation.previous,
      emphasis: "line",
    },
    {
      particulars: "Finance costs",
      current: financeCosts.current,
      previous: financeCosts.previous,
      emphasis: "line",
    },
    {
      particulars: "Tax expense",
      current: taxExpense.current,
      previous: taxExpense.previous,
      emphasis: "line",
    },
    {
      particulars: "Movement in inventories",
      current: inventoryMovementCurrent,
      previous: inventoryMovementPrevious,
      emphasis: "line",
    },
    {
      particulars: "Movement in trade receivables",
      current: receivableMovementCurrent,
      previous: receivableMovementPrevious,
      emphasis: "line",
    },
    {
      particulars:
        "Movement in short-term loans, advances and other current assets",
      current: otherCurrentAssetsMovementCurrent,
      previous: otherCurrentAssetsMovementPrevious,
      emphasis: "line",
    },
    {
      particulars: "Movement in trade payables",
      current: tradePayablesMovementCurrent,
      previous: tradePayablesMovementPrevious,
      emphasis: "line",
    },
    {
      particulars: "Movement in other liabilities and provisions",
      current: otherLiabilitiesMovementCurrent,
      previous: otherLiabilitiesMovementPrevious,
      emphasis: "line",
    },
    {
      particulars: "Net cash from operating activities",
      current: netCashFromOperatingCurrent,
      previous: netCashFromOperatingPrevious,
      emphasis: "total",
    },
    { particulars: "Cash flow from investing activities", emphasis: "section" },
    {
      particulars:
        "Net movement in property, plant, equipment, intangibles and other non-current assets",
      current: netCashFromInvestingCurrent,
      previous: netCashFromInvestingPrevious,
      emphasis: "line",
    },
    {
      particulars: "Net cash from investing activities",
      current: netCashFromInvestingCurrent,
      previous: netCashFromInvestingPrevious,
      emphasis: "total",
    },
    { particulars: "Cash flow from financing activities", emphasis: "section" },
    {
      particulars: "Movement in share capital",
      current: equityMovementCurrent,
      previous: equityMovementPrevious,
      emphasis: "line",
    },
    {
      particulars: "Movement in long-term borrowings",
      current: longTermBorrowingMovementCurrent,
      previous: longTermBorrowingMovementPrevious,
      emphasis: "line",
    },
    {
      particulars: "Movement in short-term borrowings",
      current: shortTermBorrowingMovementCurrent,
      previous: shortTermBorrowingMovementPrevious,
      emphasis: "line",
    },
    {
      particulars: "Finance costs paid",
      current: financeCosts.current * -1,
      previous: financeCosts.previous * -1,
      emphasis: "line",
    },
    {
      particulars: "Other financing movements",
      current: financingResidualCurrent,
      previous: financingResidualPrevious,
      emphasis: "line",
    },
    {
      particulars: "Net cash from financing activities",
      current: netCashFromFinancingCurrent,
      previous: netCashFromFinancingPrevious,
      emphasis: "total",
    },
    {
      particulars: "Net increase / (decrease) in cash and cash equivalents",
      current: netIncreaseCurrent,
      previous: netIncreasePrevious,
      emphasis: "total",
    },
    {
      particulars: "Opening cash and cash equivalents",
      current: openingCashCurrent,
      previous: openingCashPrevious,
      emphasis: "line",
    },
    {
      particulars: "Closing cash and cash equivalents",
      current: closingCashCurrent,
      previous: closingCashPrevious,
      emphasis: "total",
    },
  ];

  return {
    rows,
    netIncreaseCurrent,
    netIncreasePrevious,
    openingCashCurrent,
    openingCashPrevious,
    closingCashCurrent,
    closingCashPrevious,
  };
}

function buildNotes(snapshot: TrialBalanceSnapshot) {
  const rows = snapshot.rows.filter(
    (row) => row.accountClass !== "opening-balance" && row.noteNumber,
  );
  const noteDefinitions = [
    {
      noteNumber: "3",
      title: noteTitleByNumber["3"],
      sheetName: "N03 Share Capital",
      statementArea: "balance-sheet" as const,
    },
    {
      noteNumber: "4",
      title: noteTitleByNumber["4"],
      sheetName: "N04 Reserves",
      statementArea: "balance-sheet" as const,
    },
    {
      noteNumber: "5",
      title: noteTitleByNumber["5"],
      sheetName: "N05 LT Borrowings",
      statementArea: "balance-sheet" as const,
    },
    {
      noteNumber: "6",
      title: noteTitleByNumber["6"],
      sheetName: "N06 Deferred Tax",
      statementArea: "balance-sheet" as const,
    },
    {
      noteNumber: "7",
      title: noteTitleByNumber["7"],
      sheetName: "N07 LT Provisions",
      statementArea: "balance-sheet" as const,
    },
    {
      noteNumber: "8",
      title: noteTitleByNumber["8"],
      sheetName: "N08 ST Borrowings",
      statementArea: "balance-sheet" as const,
    },
    {
      noteNumber: "9",
      title: noteTitleByNumber["9"],
      sheetName: "N09 Trade Payables",
      statementArea: "balance-sheet" as const,
    },
    {
      noteNumber: "10",
      title: noteTitleByNumber["10"],
      sheetName: "N10 Other CL",
      statementArea: "balance-sheet" as const,
    },
    {
      noteNumber: "11",
      title: noteTitleByNumber["11"],
      sheetName: "N11 ST Provisions",
      statementArea: "balance-sheet" as const,
    },
    {
      noteNumber: "12",
      title: noteTitleByNumber["12"],
      sheetName: "N12 PPE",
      statementArea: "balance-sheet" as const,
    },
    {
      noteNumber: "13",
      title: noteTitleByNumber["13"],
      sheetName: "N13 Other NCA",
      statementArea: "balance-sheet" as const,
    },
    {
      noteNumber: "14",
      title: noteTitleByNumber["14"],
      sheetName: "N14 Inventories",
      statementArea: "balance-sheet" as const,
    },
    {
      noteNumber: "15",
      title: noteTitleByNumber["15"],
      sheetName: "N15 Trade Rec",
      statementArea: "balance-sheet" as const,
    },
    {
      noteNumber: "16",
      title: noteTitleByNumber["16"],
      sheetName: "N16 Cash",
      statementArea: "balance-sheet" as const,
    },
    {
      noteNumber: "17",
      title: noteTitleByNumber["17"],
      sheetName: "N17 ST Loans",
      statementArea: "balance-sheet" as const,
    },
    {
      noteNumber: "18",
      title: noteTitleByNumber["18"],
      sheetName: "N18 Other CA",
      statementArea: "balance-sheet" as const,
    },
    {
      noteNumber: "19",
      title: noteTitleByNumber["19"],
      sheetName: "N19 Revenue",
      statementArea: "profit-and-loss" as const,
      rowFilter: (row: LedgerRow) => row.noteNumber === "19",
    },
    {
      noteNumber: "20",
      title: noteTitleByNumber["20"],
      sheetName: "N20 Other Income",
      statementArea: "profit-and-loss" as const,
      rowFilter: (row: LedgerRow) => row.noteNumber === "20",
    },
    {
      noteNumber: "21",
      title: noteTitleByNumber["21"],
      sheetName: "N21 Materials",
      statementArea: "profit-and-loss" as const,
      rowFilter: (row: LedgerRow) => row.noteNumber === "21",
    },
    {
      noteNumber: "22",
      title: noteTitleByNumber["22"],
      sheetName: "N22 Inventory",
      statementArea: "profit-and-loss" as const,
      rowFilter: (row: LedgerRow) => row.noteNumber === "22",
    },
    {
      noteNumber: "23",
      title: noteTitleByNumber["23"],
      sheetName: "N23 Employee",
      statementArea: "profit-and-loss" as const,
      rowFilter: (row: LedgerRow) => row.noteNumber === "23",
    },
    {
      noteNumber: "24",
      title: noteTitleByNumber["24"],
      sheetName: "N24 Finance",
      statementArea: "profit-and-loss" as const,
      rowFilter: (row: LedgerRow) => row.noteNumber === "24",
    },
    {
      noteNumber: "25",
      title: noteTitleByNumber["25"],
      sheetName: "N25 Depreciation",
      statementArea: "profit-and-loss" as const,
      rowFilter: (row: LedgerRow) => row.noteNumber === "25",
    },
    {
      noteNumber: "26",
      title: noteTitleByNumber["26"],
      sheetName: "N26 Other Exp",
      statementArea: "profit-and-loss" as const,
      rowFilter: (row: LedgerRow) => row.noteNumber === "26",
    },
    {
      noteNumber: "27",
      title: noteTitleByNumber["27"],
      sheetName: "N27 Tax",
      statementArea: "profit-and-loss" as const,
      rowFilter: (row: LedgerRow) => row.noteNumber === "27",
    },
  ];

  const notes = [
    buildTextNote({
      noteNumber: "1",
      title: "Source workbook and reporting basis",
      sheetName: "N01 Basis",
      statementArea: "general",
      paragraphs: [
        `This statement pack has been derived from ${snapshot.sourceName}.`,
        "The current workbook snapshot is treated as the source ledger for the balance sheet, statement of profit and loss, and supporting notes.",
        "Amounts in the export pack are presented in Rs. lakhs so the layout aligns more closely with the supplied Schedule III-style sample.",
      ],
    }),
    buildTextNote({
      noteNumber: "2",
      title: "Preparation assumptions and controls",
      sheetName: "N02 Assumptions",
      statementArea: "general",
      paragraphs: [
        ...snapshot.accountingAssumptions,
        ...snapshot.reviewFlags.map((flag) => `${flag.title}: ${flag.detail}`),
      ],
    }),
    ...noteDefinitions.map((definition) =>
      buildTableNote({
        ...definition,
        rows: rows.filter(
          definition.rowFilter ??
            ((row) => row.noteNumber === definition.noteNumber),
        ),
      }),
    ),
  ].filter((note): note is BuiltNote => note !== null);

  return notes;
}

function buildBalanceSheet(
  notes: BuiltNote[],
  statementLineOverrides?: StatementLineOverride[],
  ): BuiltBalanceSheet {
  const shareCapital = notes.find((note) => note.noteNumber === "3") ?? null;
  const reserves = notes.find((note) => note.noteNumber === "4") ?? null;
  const longTermBorrowings =
    notes.find((note) => note.noteNumber === "5") ?? null;
  const deferredTax = notes.find((note) => note.noteNumber === "6") ?? null;
  const longTermProvisions =
    notes.find((note) => note.noteNumber === "7") ?? null;
  const shortTermBorrowings =
    notes.find((note) => note.noteNumber === "8") ?? null;
  const tradePayables = notes.find((note) => note.noteNumber === "9") ?? null;
  const otherCurrentLiabilities =
    notes.find((note) => note.noteNumber === "10") ?? null;
  const shortTermProvisions =
    notes.find((note) => note.noteNumber === "11") ?? null;
  const ppe = notes.find((note) => note.noteNumber === "12") ?? null;
  const otherNonCurrentAssets =
    notes.find((note) => note.noteNumber === "13") ?? null;
  const inventories = notes.find((note) => note.noteNumber === "14") ?? null;
  const tradeReceivables =
    notes.find((note) => note.noteNumber === "15") ?? null;
  const cash = notes.find((note) => note.noteNumber === "16") ?? null;
  const shortTermLoans = notes.find((note) => note.noteNumber === "17") ?? null;
  const otherCurrentAssets =
    notes.find((note) => note.noteNumber === "18") ?? null;
  void shareCapital;
  void reserves;
  void longTermBorrowings;
  void deferredTax;
  void longTermProvisions;
  void shortTermBorrowings;
  void tradePayables;
  void otherCurrentLiabilities;
  void shortTermProvisions;
  void ppe;
  void otherNonCurrentAssets;
  void inventories;
  void tradeReceivables;
  void cash;
  void shortTermLoans;
  void otherCurrentAssets;

  const overrides = buildStatementOverrideMap(statementLineOverrides);
  const shareholderFundRows = [
    { particulars: noteTitleByNumber["3"], noteNumber: "3" },
    { particulars: noteTitleByNumber["4"], noteNumber: "4" },
  ].map((config) =>
    buildConfiguredStatementLine(notes, overrides, "balance-sheet", config),
  );
  const nonCurrentLiabilityRows = [
    { particulars: noteTitleByNumber["5"], noteNumber: "5" },
    { particulars: noteTitleByNumber["6"], noteNumber: "6" },
    { particulars: noteTitleByNumber["7"], noteNumber: "7" },
  ].map((config) =>
    buildConfiguredStatementLine(notes, overrides, "balance-sheet", config),
  );
  const currentLiabilityRows = [
    { particulars: noteTitleByNumber["8"], noteNumber: "8" },
    { particulars: noteTitleByNumber["9"], noteNumber: "9" },
    { particulars: noteTitleByNumber["10"], noteNumber: "10" },
    { particulars: noteTitleByNumber["11"], noteNumber: "11" },
  ].map((config) =>
    buildConfiguredStatementLine(notes, overrides, "balance-sheet", config),
  );
  const nonCurrentAssetRows = [
    { particulars: noteTitleByNumber["12"], noteNumber: "12" },
    { particulars: noteTitleByNumber["13"], noteNumber: "13" },
  ].map((config) =>
    buildConfiguredStatementLine(notes, overrides, "balance-sheet", config),
  );
  const currentAssetRows = [
    { particulars: noteTitleByNumber["14"], noteNumber: "14" },
    { particulars: noteTitleByNumber["15"], noteNumber: "15" },
    { particulars: noteTitleByNumber["16"], noteNumber: "16" },
    { particulars: noteTitleByNumber["17"], noteNumber: "17" },
    { particulars: noteTitleByNumber["18"], noteNumber: "18" },
  ].map((config) =>
    buildConfiguredStatementLine(notes, overrides, "balance-sheet", config),
  );

  const shareholderFundsTotal = sumStatementRows(shareholderFundRows);
  const nonCurrentLiabilitiesTotal = sumStatementRows(nonCurrentLiabilityRows);
  const currentLiabilitiesTotal = sumStatementRows(currentLiabilityRows);
  const nonCurrentAssetsTotal = sumStatementRows(nonCurrentAssetRows);
  const currentAssetsTotal = sumStatementRows(currentAssetRows);

  const totalEquityAndLiabilities =
    shareholderFundsTotal.current +
    nonCurrentLiabilitiesTotal.current +
    currentLiabilitiesTotal.current;
  const totalEquityAndLiabilitiesPrevious =
    shareholderFundsTotal.previous +
    nonCurrentLiabilitiesTotal.previous +
    currentLiabilitiesTotal.previous;
  const totalAssets =
    nonCurrentAssetsTotal.current + currentAssetsTotal.current;
  const totalAssetsPrevious =
    nonCurrentAssetsTotal.previous + currentAssetsTotal.previous;

  const rows: StatementDisplayRow[] = [
    { particulars: "I. Equity and Liabilities", emphasis: "section" },
    { particulars: "(1) Shareholders' funds", emphasis: "heading" },
    ...shareholderFundRows.filter(
      (row): row is StatementDisplayRow => row !== null,
    ),
    {
      particulars: "Total Shareholders' funds",
      current: shareholderFundsTotal.current,
      previous: shareholderFundsTotal.previous,
      emphasis: "total",
    },
    { particulars: "(2) Non-current liabilities", emphasis: "heading" },
    ...nonCurrentLiabilityRows.filter(
      (row): row is StatementDisplayRow => row !== null,
    ),
    {
      particulars: "Total Non-current liabilities",
      current: nonCurrentLiabilitiesTotal.current,
      previous: nonCurrentLiabilitiesTotal.previous,
      emphasis: "total",
    },
    { particulars: "(3) Current liabilities", emphasis: "heading" },
    ...currentLiabilityRows.filter(
      (row): row is StatementDisplayRow => row !== null,
    ),
    {
      particulars: "Total Current liabilities",
      current: currentLiabilitiesTotal.current,
      previous: currentLiabilitiesTotal.previous,
      emphasis: "total",
    },
    {
      particulars: "Total Equity and Liabilities",
      current: totalEquityAndLiabilities,
      previous: totalEquityAndLiabilitiesPrevious,
      emphasis: "total",
    },
    { particulars: "II. Assets", emphasis: "section" },
    { particulars: "(1) Non-current assets", emphasis: "heading" },
    ...nonCurrentAssetRows.filter(
      (row): row is StatementDisplayRow => row !== null,
    ),
    {
      particulars: "Total Non-current assets",
      current: nonCurrentAssetsTotal.current,
      previous: nonCurrentAssetsTotal.previous,
      emphasis: "total",
    },
    { particulars: "(2) Current assets", emphasis: "heading" },
    ...currentAssetRows.filter(
      (row): row is StatementDisplayRow => row !== null,
    ),
    {
      particulars: "Total Current assets",
      current: currentAssetsTotal.current,
      previous: currentAssetsTotal.previous,
      emphasis: "total",
    },
    {
      particulars: "Total Assets",
      current: totalAssets,
      previous: totalAssetsPrevious,
      emphasis: "total",
    },
  ];

  return {
    rows,
    totalCurrent: totalAssets,
    totalPrevious: totalAssetsPrevious,
    totalEquityAndLiabilitiesCurrent: totalEquityAndLiabilities,
    totalEquityAndLiabilitiesPrevious: totalEquityAndLiabilitiesPrevious,
  };
}

function buildProfitAndLoss(
  notes: BuiltNote[],
  statementLineOverrides?: StatementLineOverride[],
  ): BuiltProfitAndLoss {
  const overrides = buildStatementOverrideMap(statementLineOverrides);
  const taxExpense = notes.find((note) => note.noteNumber === "27") ?? null;

  const incomeRows = [
    { particulars: noteTitleByNumber["19"], noteNumber: "19" },
    { particulars: noteTitleByNumber["20"], noteNumber: "20" },
  ].map((config) =>
    buildConfiguredStatementLine(notes, overrides, "profit-and-loss", config),
  );
  const expenseRows = [
    { particulars: noteTitleByNumber["21"], noteNumber: "21" },
    { particulars: noteTitleByNumber["22"], noteNumber: "22" },
    { particulars: noteTitleByNumber["23"], noteNumber: "23" },
    { particulars: noteTitleByNumber["24"], noteNumber: "24" },
    { particulars: noteTitleByNumber["25"], noteNumber: "25" },
    { particulars: noteTitleByNumber["26"], noteNumber: "26" },
  ].map((config) =>
    buildConfiguredStatementLine(notes, overrides, "profit-and-loss", config),
  );

  const totalIncome = sumStatementRows(incomeRows);
  const totalExpensesBeforeTax = sumStatementRows(expenseRows);
  const tax = taxExpense
    ? { current: taxExpense.totalCurrent, previous: taxExpense.totalPrevious }
    : { current: 0, previous: 0 };
  const profitBeforeTax = totalIncome.current - totalExpensesBeforeTax.current;
  const profitBeforeTaxPrevious =
    totalIncome.previous - totalExpensesBeforeTax.previous;
  const profitAfterTax = profitBeforeTax - tax.current;
  const profitAfterTaxPrevious = profitBeforeTaxPrevious - tax.previous;

  const rows: StatementDisplayRow[] = [
    ...incomeRows.filter((row): row is StatementDisplayRow => row !== null),
    {
      particulars: "Total Income",
      current: totalIncome.current,
      previous: totalIncome.previous,
      emphasis: "total",
    },
    { particulars: "Expenses", emphasis: "section" },
    ...expenseRows.filter((row): row is StatementDisplayRow => row !== null),
    {
      particulars: "Total Expenses",
      current: totalExpensesBeforeTax.current,
      previous: totalExpensesBeforeTax.previous,
      emphasis: "total",
    },
    {
      particulars: "Profit before Tax",
      current: profitBeforeTax,
      previous: profitBeforeTaxPrevious,
      emphasis: "total",
    },
    ...(taxExpense
      ? [
          {
            particulars: "Tax Expense",
            note: taxExpense.noteNumber,
            current: tax.current,
            previous: tax.previous,
            emphasis: "line" as const,
          },
        ]
      : []),
    {
      particulars: "Profit after Tax",
      current: profitAfterTax,
      previous: profitAfterTaxPrevious,
      emphasis: "total",
    },
  ];

  return {
    rows,
    profitBeforeTax,
    profitBeforeTaxPrevious,
    profitAfterTax,
    profitAfterTaxPrevious,
  };
}

function reconcileReservesWithProfitAndLoss(
  notes: BuiltNote[],
  profitAndLoss: BuiltProfitAndLoss,
  balanceSheet: BuiltBalanceSheet,
  ) {
  const reservesNote = notes.find((note) => note.noteNumber === "4");

  if (!reservesNote) {
    return notes;
  }

  const currentDifference =
    balanceSheet.totalEquityAndLiabilitiesCurrent - balanceSheet.totalCurrent;
  const previousDifference =
    balanceSheet.totalEquityAndLiabilitiesPrevious - balanceSheet.totalPrevious;
  const shouldAdjustCurrent =
    Math.abs(currentDifference) > 0.5 &&
    Math.abs(currentDifference + profitAndLoss.profitAfterTax) < 0.5;
  const shouldAdjustPrevious =
    Math.abs(previousDifference) > 0.5 &&
    Math.abs(previousDifference + profitAndLoss.profitAfterTaxPrevious) < 0.5;

  if (!shouldAdjustCurrent && !shouldAdjustPrevious) {
    return notes;
  }

  return notes.map((note) => {
    if (note.noteNumber !== "4") {
      return note;
    }

    return {
      ...note,
      rows: [
        ...(note.rows ?? []),
        {
          particulars: "Profit / (loss) for the year",
          current: shouldAdjustCurrent
            ? profitAndLoss.profitAfterTax
            : undefined,
          previous: shouldAdjustPrevious
            ? profitAndLoss.profitAfterTaxPrevious
            : undefined,
          classificationBasis:
            "Auto-adjusted so the balance sheet reflects the year-end profit or loss carried in the trial balance.",
          emphasis: "line",
        },
      ],
      totalCurrent:
        note.totalCurrent +
        (shouldAdjustCurrent ? profitAndLoss.profitAfterTax : 0),
      totalPrevious:
        note.totalPrevious +
        (shouldAdjustPrevious ? profitAndLoss.profitAfterTaxPrevious : 0),
    } satisfies BuiltNote;
  });
}

export async function getStatementPack(
  scope?: StatementPackScope,
  ): Promise<StatementPack> {
  const snapshot = await getTrialBalanceSnapshot({
    companyId: scope?.companyId,
    versionId: scope?.versionId,
  });
  const baseNotes = buildNotes(snapshot);
  const profitAndLoss = buildProfitAndLoss(baseNotes, scope?.statementLineOverrides);
  const preliminaryBalanceSheet = buildBalanceSheet(
    baseNotes,
    scope?.statementLineOverrides,
  );
  const notes = reconcileReservesWithProfitAndLoss(
    baseNotes,
    profitAndLoss,
    preliminaryBalanceSheet,
  );
  const balanceSheet = buildBalanceSheet(notes, scope?.statementLineOverrides);
  const cashFlow = buildCashFlowStatement(notes, {
    ...snapshot,
    profitAndLoss: {
      ...snapshot.profitAndLoss,
      profitBeforeTax: profitAndLoss.profitBeforeTax,
      profitBeforeTaxPrevious: profitAndLoss.profitBeforeTaxPrevious,
      profitAfterTax: profitAndLoss.profitAfterTax,
      profitAfterTaxPrevious: profitAndLoss.profitAfterTaxPrevious,
    },
  });

  return {
    entityName: "Schedule III Financial Statements",
    reportTitle: "Financial Statement Pack",
    sourceName: snapshot.sourceName,
    sourcePath: snapshot.sourcePath,
    generatedAt: new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date()),
    reportingLabels: {
      current: "Current Year",
      previous: "Previous Year",
    },
    balanceSheet,
    profitAndLoss,
    cashFlow,
    notes,
    reviewFlags: snapshot.reviewFlags,
    accountingAssumptions: snapshot.accountingAssumptions,
  };
}

export function hasStatementValue(row: StatementDisplayRow | CashFlowRow) {
  return !isDisplayZero(row.current) || !isDisplayZero(row.previous);
}
