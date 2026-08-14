import { readRatioLedgerConfig } from "@/lib/ratio-ledger-config";
import { getTrialBalanceSnapshot, type LedgerRow } from "@/lib/trial-balance";

type RatioKind = "times" | "percent";

type ComparativeAmount = {
  current: number;
  previous: number;
};

export type RatioDefinition = {
  id: string;
  label: string;
  formula: string;
  notes: string;
  kind: RatioKind;
  relevantNoteNumbers: string[];
};

export type KeyRatioRow = {
  id: string;
  label: string;
  formula: string;
  notes: string;
  kind: RatioKind;
  current: number;
  previous: number;
  changePercent: number | null;
};

export const ratioDefinitions: RatioDefinition[] = [
  {
    id: "current-ratio",
    label: "Current Ratio",
    formula: "Current Assets / Current Liabilities",
    notes: "14,15,16,17,18 / 8,9,10,11",
    kind: "times",
    relevantNoteNumbers: ["8", "9", "10", "11", "14", "15", "16", "17", "18"],
  },
  {
    id: "debt-equity-ratio",
    label: "Debt-Equity Ratio",
    formula: "Total Debt / Net Worth",
    notes: "5,8 / 3,4",
    kind: "times",
    relevantNoteNumbers: ["3", "4", "5", "8"],
  },
  {
    id: "debt-service-coverage-ratio",
    label: "Debt Service Coverage Ratio",
    formula: "(Profit Before Tax + Finance Cost) / Finance Cost",
    notes: "19,20,21,22,23,24,25,26",
    kind: "times",
    relevantNoteNumbers: ["19", "20", "21", "22", "23", "24", "25", "26"],
  },
  {
    id: "return-on-equity",
    label: "Return on Equity Ratio",
    formula: "Profit After Tax / Average Shareholders' Equity",
    notes: "3,4,19,20,21,22,23,24,25,26",
    kind: "percent",
    relevantNoteNumbers: ["3", "4", "19", "20", "21", "22", "23", "24", "25", "26"],
  },
  {
    id: "inventory-turnover",
    label: "Inventory Turnover",
    formula: "Cost of Materials and Manufacturing / Average Inventory",
    notes: "14,21",
    kind: "times",
    relevantNoteNumbers: ["14", "21"],
  },
  {
    id: "trade-receivables-turnover",
    label: "Trade Receivables Turnover",
    formula: "Revenue from Operations / Average Trade Receivables",
    notes: "15,19",
    kind: "times",
    relevantNoteNumbers: ["15", "19"],
  },
  {
    id: "trade-payables-turnover",
    label: "Trade Payables Turnover",
    formula: "Purchases and Services / Average Trade Payables",
    notes: "9,21,25",
    kind: "times",
    relevantNoteNumbers: ["9", "21", "25"],
  },
  {
    id: "net-capital-turnover",
    label: "Net Capital Turnover Ratio",
    formula: "Revenue from Operations / Average Working Capital",
    notes: "14,15,16,17,18 / 8,9,10,11 / 19",
    kind: "times",
    relevantNoteNumbers: ["8", "9", "10", "11", "14", "15", "16", "17", "18", "19"],
  },
  {
    id: "net-profit-ratio",
    label: "Net Profit Ratio",
    formula: "Profit After Tax / Revenue from Operations",
    notes: "19,20,21,22,23,24,25,26",
    kind: "percent",
    relevantNoteNumbers: ["19", "20", "21", "22", "23", "24", "25", "26"],
  },
  {
    id: "return-on-capital-employed",
    label: "Return on Capital Employed",
    formula: "EBIT / Average Capital Employed",
    notes: "8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26",
    kind: "percent",
    relevantNoteNumbers: ["8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26"],
  },
  {
    id: "return-on-investment",
    label: "Return on Investment",
    formula: "Profit Before Tax / Average Total Assets",
    notes: "12,13,14,15,16,17,18,19,20,21,22,23,24,25,26",
    kind: "percent",
    relevantNoteNumbers: ["12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26"],
  },
  {
    id: "interest-service-coverage",
    label: "Interest Service Coverage Ratio",
    formula: "EBIT / Finance Cost",
    notes: "19,20,21,22,23,24,25,26",
    kind: "times",
    relevantNoteNumbers: ["19", "20", "21", "22", "23", "24", "25", "26"],
  },
  {
    id: "operating-margin",
    label: "Operating Margin",
    formula: "EBITDA / Revenue from Operations",
    notes: "19,20,21,22,23,24,25,26",
    kind: "percent",
    relevantNoteNumbers: ["19", "20", "21", "22", "23", "24", "25", "26"],
  },
];

function displayAmount(row: LedgerRow, year: "current" | "previous") {
  const value = year === "current" ? row.currentYear : row.previousYear;

  if (row.accountClass === "equity-liability" || row.accountClass === "income") {
    return value * -1;
  }

  return value;
}

function safeDivide(numerator: number, denominator: number) {
  if (Math.abs(denominator) < 0.000001) {
    return 0;
  }

  return numerator / denominator;
}

function average(current: number, previous: number) {
  return (current + previous) / 2;
}

function changePercent(current: number, previous: number) {
  if (Math.abs(previous) < 0.000001) {
    return null;
  }

  return ((current - previous) / Math.abs(previous)) * 100;
}

function getPreviousFinancialYearLabel(financialYear: string) {
  const match = financialYear.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return "Previous Year";
  }

  const start = Number(match[1]) - 1;
  const end = String(Number(match[2]) - 1).padStart(2, "0");
  return `${start}-${end}`;
}

function zeroAmount(): ComparativeAmount {
  return { current: 0, previous: 0 };
}

function sumRowsByNotes(rows: LedgerRow[], noteNumbers: string[]) {
  const noteSet = new Set(noteNumbers);

  return rows.reduce<ComparativeAmount>(
    (accumulator, row) =>
      noteSet.has(row.noteNumber)
        ? {
            current: accumulator.current + displayAmount(row, "current"),
            previous: accumulator.previous + displayAmount(row, "previous"),
          }
        : accumulator,
    zeroAmount(),
  );
}

function addAmounts(...amounts: ComparativeAmount[]) {
  return amounts.reduce<ComparativeAmount>(
    (accumulator, amount) => ({
      current: accumulator.current + amount.current,
      previous: accumulator.previous + amount.previous,
    }),
    zeroAmount(),
  );
}

export async function buildKeyRatioTable(input: {
  financialYear: string;
  scope?: Parameters<typeof getTrialBalanceSnapshot>[0];
}) {
  const snapshot = await getTrialBalanceSnapshot(input.scope);
  const ratioConfig = readRatioLedgerConfig(input.scope);
  const sourceRows = snapshot.rows.filter((row) => row.accountClass !== "opening-balance" && row.noteNumber);

  const rows = ratioDefinitions.map<KeyRatioRow>((definition) => {
    const excludedGlNumbers = new Set(ratioConfig.ratios[definition.id]?.excludedGlNumbers ?? []);
    const ratioRows = sourceRows.filter(
      (row) => definition.relevantNoteNumbers.includes(row.noteNumber) && !excludedGlNumbers.has(row.glNumber),
    );

    const shareCapital = sumRowsByNotes(ratioRows, ["3"]);
    const reserves = sumRowsByNotes(ratioRows, ["4"]);
    const longTermBorrowings = sumRowsByNotes(ratioRows, ["5"]);
    const shortTermBorrowings = sumRowsByNotes(ratioRows, ["8"]);
    const tradePayables = sumRowsByNotes(ratioRows, ["9"]);
    const otherCurrentLiabilities = sumRowsByNotes(ratioRows, ["10"]);
    const shortTermProvisions = sumRowsByNotes(ratioRows, ["11"]);
    const ppeAndIntangibles = sumRowsByNotes(ratioRows, ["12"]);
    const otherNonCurrentAssets = sumRowsByNotes(ratioRows, ["13"]);
    const inventories = sumRowsByNotes(ratioRows, ["14"]);
    const tradeReceivables = sumRowsByNotes(ratioRows, ["15"]);
    const cashAndCashEquivalents = sumRowsByNotes(ratioRows, ["16"]);
    const shortTermLoansAndAdvances = sumRowsByNotes(ratioRows, ["17"]);
    const otherCurrentAssets = sumRowsByNotes(ratioRows, ["18"]);
    const revenueFromOperations = sumRowsByNotes(ratioRows, ["19"]);
    const otherIncome = sumRowsByNotes(ratioRows, ["20"]);
    const materialsAndManufacturing = sumRowsByNotes(ratioRows, ["21"]);
    const employeeBenefits = sumRowsByNotes(ratioRows, ["22"]);
    const financeCosts = sumRowsByNotes(ratioRows, ["23"]);
    const depreciation = sumRowsByNotes(ratioRows, ["24"]);
    const otherExpenses = sumRowsByNotes(ratioRows, ["25"]);
    const taxExpense = sumRowsByNotes(ratioRows, ["26"]);

    const currentAssets = addAmounts(
      inventories,
      tradeReceivables,
      cashAndCashEquivalents,
      shortTermLoansAndAdvances,
      otherCurrentAssets,
    );
    const currentLiabilities = addAmounts(shortTermBorrowings, tradePayables, otherCurrentLiabilities, shortTermProvisions);
    const equity = addAmounts(shareCapital, reserves);
    const totalDebt = addAmounts(longTermBorrowings, shortTermBorrowings);
    const totalAssets = addAmounts(
      ppeAndIntangibles,
      otherNonCurrentAssets,
      inventories,
      tradeReceivables,
      cashAndCashEquivalents,
      shortTermLoansAndAdvances,
      otherCurrentAssets,
    );
    const workingCapital = {
      current: currentAssets.current - currentLiabilities.current,
      previous: currentAssets.previous - currentLiabilities.previous,
    };
    const totalIncome = addAmounts(revenueFromOperations, otherIncome);
    const totalExpensesBeforeTax = addAmounts(
      materialsAndManufacturing,
      employeeBenefits,
      financeCosts,
      depreciation,
      otherExpenses,
    );
    const profitBeforeTax = {
      current: totalIncome.current - totalExpensesBeforeTax.current,
      previous: totalIncome.previous - totalExpensesBeforeTax.previous,
    };
    const profitAfterTax = {
      current: profitBeforeTax.current - taxExpense.current,
      previous: profitBeforeTax.previous - taxExpense.previous,
    };
    const ebit = {
      current: profitBeforeTax.current + financeCosts.current,
      previous: profitBeforeTax.previous + financeCosts.previous,
    };
    const ebitda = {
      current: ebit.current + depreciation.current,
      previous: ebit.previous + depreciation.previous,
    };
    const capitalEmployed = {
      current: totalAssets.current - currentLiabilities.current,
      previous: totalAssets.previous - currentLiabilities.previous,
    };
    const purchaseAndServices = addAmounts(materialsAndManufacturing, otherExpenses);

    const calculators: Record<string, ComparativeAmount> = {
      "current-ratio": {
        current: safeDivide(currentAssets.current, currentLiabilities.current),
        previous: safeDivide(currentAssets.previous, currentLiabilities.previous),
      },
      "debt-equity-ratio": {
        current: safeDivide(totalDebt.current, equity.current),
        previous: safeDivide(totalDebt.previous, equity.previous),
      },
      "debt-service-coverage-ratio": {
        current: safeDivide(ebit.current, financeCosts.current),
        previous: safeDivide(ebit.previous, financeCosts.previous),
      },
      "return-on-equity": {
        current: safeDivide(profitAfterTax.current, average(equity.current, equity.previous)) * 100,
        previous: safeDivide(profitAfterTax.previous, equity.previous) * 100,
      },
      "inventory-turnover": {
        current: safeDivide(materialsAndManufacturing.current, average(inventories.current, inventories.previous)),
        previous: safeDivide(materialsAndManufacturing.previous, inventories.previous),
      },
      "trade-receivables-turnover": {
        current: safeDivide(revenueFromOperations.current, average(tradeReceivables.current, tradeReceivables.previous)),
        previous: safeDivide(revenueFromOperations.previous, tradeReceivables.previous),
      },
      "trade-payables-turnover": {
        current: safeDivide(purchaseAndServices.current, average(tradePayables.current, tradePayables.previous)),
        previous: safeDivide(purchaseAndServices.previous, tradePayables.previous),
      },
      "net-capital-turnover": {
        current: safeDivide(revenueFromOperations.current, average(workingCapital.current, workingCapital.previous)),
        previous: safeDivide(revenueFromOperations.previous, workingCapital.previous),
      },
      "net-profit-ratio": {
        current: safeDivide(profitAfterTax.current, revenueFromOperations.current) * 100,
        previous: safeDivide(profitAfterTax.previous, revenueFromOperations.previous) * 100,
      },
      "return-on-capital-employed": {
        current: safeDivide(ebit.current, average(capitalEmployed.current, capitalEmployed.previous)) * 100,
        previous: safeDivide(ebit.previous, capitalEmployed.previous) * 100,
      },
      "return-on-investment": {
        current: safeDivide(profitBeforeTax.current, average(totalAssets.current, totalAssets.previous)) * 100,
        previous: safeDivide(profitBeforeTax.previous, totalAssets.previous) * 100,
      },
      "interest-service-coverage": {
        current: safeDivide(ebit.current, financeCosts.current),
        previous: safeDivide(ebit.previous, financeCosts.previous),
      },
      "operating-margin": {
        current: safeDivide(ebitda.current, revenueFromOperations.current) * 100,
        previous: safeDivide(ebitda.previous, revenueFromOperations.previous) * 100,
      },
    };

    const result = calculators[definition.id] ?? zeroAmount();

    return {
      id: definition.id,
      label: definition.label,
      formula: definition.formula,
      notes: definition.notes,
      kind: definition.kind,
      current: result.current,
      previous: result.previous,
      changePercent: changePercent(result.current, result.previous),
    };
  });

  return {
    currentYearLabel: input.financialYear,
    previousYearLabel: getPreviousFinancialYearLabel(input.financialYear),
    rows,
  };
}
