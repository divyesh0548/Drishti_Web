import fs from "node:fs";
import { randomUUID } from "node:crypto";

import {
  getCompanyVersionPaths,
  listCompanies,
  listCompanyVersions,
  resolveWorkspaceContext,
  type CompanyRecord,
  type StatementVersionRecord,
} from "@/lib/company-workspace";
import { getStatementPack, type StatementDisplayRow } from "@/lib/statement-pack";

type ConsolidationScope = {
  companyId?: string;
  versionId?: string;
};

export type ConsolidationMemberSelection = {
  companyId: string;
  versionId?: string;
};

export type ConsolidationElimination = {
  id: string;
  fromCompanyId: string;
  toCompanyId: string;
  description: string;
  statementArea: "balance-sheet" | "profit-and-loss";
  noteNumber: string;
  lineItem: string;
  direction: "decrease" | "increase";
  currentAmount: number;
  previousAmount: number;
  active: boolean;
};

export type ConsolidationConfig = {
  updatedAt: string | null;
  members: ConsolidationMemberSelection[];
  eliminations: ConsolidationElimination[];
};

type RawConsolidationConfig = {
  updatedAt?: string | null;
  members?: Array<Partial<ConsolidationMemberSelection>>;
  eliminations?: Array<Partial<ConsolidationElimination>>;
};

type NoteAmount = {
  noteNumber: string;
  title: string;
  statementArea: "balance-sheet" | "profit-and-loss";
  current: number;
  previous: number;
};

export type ConsolidationMemberSummary = {
  companyId: string;
  companyName: string;
  versionId: string;
  versionLabel: string;
  financialYear: string;
};

export type ConsolidationSnapshot = {
  parentCompany: CompanyRecord;
  baseVersion: StatementVersionRecord;
  members: ConsolidationMemberSummary[];
  config: ConsolidationConfig;
  metrics: Array<{
    label: string;
    value: string;
    detail: string;
    tone: "positive" | "neutral" | "warning";
  }>;
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
  noteImpacts: Array<NoteAmount & { adjustmentCurrent: number; adjustmentPrevious: number }>;
  eliminationSummaries: Array<
    ConsolidationElimination & {
      fromCompanyName: string;
      toCompanyName: string;
    }
  >;
};

const defaultConsolidationConfig: ConsolidationConfig = {
  updatedAt: null,
  members: [],
  eliminations: [],
};

const noteDefinitions = [
  { noteNumber: "3", title: "Share Capital", statementArea: "balance-sheet" as const },
  { noteNumber: "4", title: "Reserves and Surplus", statementArea: "balance-sheet" as const },
  { noteNumber: "5", title: "Long-term Borrowings", statementArea: "balance-sheet" as const },
  { noteNumber: "6", title: "Deferred Tax Liabilities (Net)", statementArea: "balance-sheet" as const },
  { noteNumber: "7", title: "Long-term Provisions", statementArea: "balance-sheet" as const },
  { noteNumber: "8", title: "Short-term Borrowings", statementArea: "balance-sheet" as const },
  { noteNumber: "9", title: "Trade Payables", statementArea: "balance-sheet" as const },
  { noteNumber: "10", title: "Other Current Liabilities", statementArea: "balance-sheet" as const },
  { noteNumber: "11", title: "Short-term Provisions", statementArea: "balance-sheet" as const },
  { noteNumber: "12", title: "Property, Plant, Equipment and Intangible Assets", statementArea: "balance-sheet" as const },
  { noteNumber: "13", title: "Other Non-current Assets", statementArea: "balance-sheet" as const },
  { noteNumber: "14", title: "Inventories", statementArea: "balance-sheet" as const },
  { noteNumber: "15", title: "Trade Receivables", statementArea: "balance-sheet" as const },
  { noteNumber: "16", title: "Cash and Cash Equivalents", statementArea: "balance-sheet" as const },
  { noteNumber: "17", title: "Short-term Loans and Advances", statementArea: "balance-sheet" as const },
  { noteNumber: "18", title: "Other Current Assets", statementArea: "balance-sheet" as const },
  { noteNumber: "19", title: "Revenue from Operations", statementArea: "profit-and-loss" as const },
  { noteNumber: "20", title: "Other Income", statementArea: "profit-and-loss" as const },
  { noteNumber: "21", title: "Cost of Materials and Manufacturing", statementArea: "profit-and-loss" as const },
  { noteNumber: "22", title: "Employee Benefits Expense", statementArea: "profit-and-loss" as const },
  { noteNumber: "23", title: "Finance Costs", statementArea: "profit-and-loss" as const },
  { noteNumber: "24", title: "Depreciation and Amortisation", statementArea: "profit-and-loss" as const },
  { noteNumber: "25", title: "Other Expenses", statementArea: "profit-and-loss" as const },
  { noteNumber: "26", title: "Tax Expense", statementArea: "profit-and-loss" as const },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function resolveScope(scope?: ConsolidationScope) {
  const context = resolveWorkspaceContext({
    companyId: scope?.companyId,
    versionId: scope?.versionId,
  });

  return {
    companyId: context.company.id,
    versionId: context.currentVersion.id,
    company: context.company,
    version: context.currentVersion,
  };
}

function getConsolidationConfigPath(scope?: ConsolidationScope) {
  const resolved = resolveScope(scope);
  return getCompanyVersionPaths(resolved.companyId, resolved.versionId).consolidationConfigPath;
}

function ensureConsolidationConfig(scope?: ConsolidationScope) {
  const configPath = getConsolidationConfigPath(scope);

  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, `${JSON.stringify(defaultConsolidationConfig, null, 2)}\n`, "utf8");
  }
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    return normalized ? Number(normalized) || 0 : 0;
  }

  return 0;
}

export function getConsolidationConfig(scope?: ConsolidationScope) {
  ensureConsolidationConfig(scope);
  const configPath = getConsolidationConfigPath(scope);
  const raw = fs.readFileSync(configPath, "utf8");

  try {
    const parsed = JSON.parse(raw) as RawConsolidationConfig;
    const companies = new Set(listCompanies().map((company) => company.id));

    return {
      updatedAt: parsed.updatedAt ?? null,
      members: (parsed.members ?? [])
        .filter((member): member is ConsolidationMemberSelection => typeof member.companyId === "string" && companies.has(member.companyId))
        .map((member) => ({
          companyId: member.companyId,
          versionId: typeof member.versionId === "string" ? member.versionId : undefined,
        })),
      eliminations: (parsed.eliminations ?? [])
        .filter(
          (entry): entry is ConsolidationElimination =>
            typeof entry.fromCompanyId === "string" &&
            typeof entry.toCompanyId === "string" &&
            typeof entry.noteNumber === "string" &&
            typeof entry.statementArea === "string" &&
            typeof entry.lineItem === "string" &&
            companies.has(entry.fromCompanyId) &&
            companies.has(entry.toCompanyId),
        )
        .map((entry) => ({
          id: typeof entry.id === "string" ? entry.id : randomUUID(),
          fromCompanyId: entry.fromCompanyId,
          toCompanyId: entry.toCompanyId,
          description: typeof entry.description === "string" ? entry.description : "",
          statementArea: entry.statementArea === "profit-and-loss" ? "profit-and-loss" : "balance-sheet",
          noteNumber: entry.noteNumber,
          lineItem: entry.lineItem,
          direction: entry.direction === "increase" ? "increase" : "decrease",
          currentAmount: parseNumber(entry.currentAmount),
          previousAmount: parseNumber(entry.previousAmount),
          active: entry.active !== false,
        })),
    } satisfies ConsolidationConfig;
  } catch {
    fs.writeFileSync(configPath, `${JSON.stringify(defaultConsolidationConfig, null, 2)}\n`, "utf8");
    return defaultConsolidationConfig;
  }
}

export function saveConsolidationConfig(
  input: {
    members: ConsolidationMemberSelection[];
    eliminations: Array<Partial<ConsolidationElimination>>;
  },
  scope?: ConsolidationScope,
) {
  const resolved = resolveScope(scope);
  const companies = listCompanies();
  const companyLookup = new Set(companies.map((company) => company.id));
  const members = input.members
    .filter((member) => member.companyId && member.companyId !== resolved.companyId && companyLookup.has(member.companyId))
    .map((member) => ({
      companyId: member.companyId,
      versionId: member.versionId?.trim() || undefined,
    }))
    .filter((member, index, items) => items.findIndex((candidate) => candidate.companyId === member.companyId) === index);
  const eliminations = input.eliminations
    .filter(
      (entry) =>
        typeof entry.fromCompanyId === "string" &&
        typeof entry.toCompanyId === "string" &&
        typeof entry.noteNumber === "string" &&
        typeof entry.lineItem === "string" &&
        companyLookup.has(entry.fromCompanyId) &&
        companyLookup.has(entry.toCompanyId),
    )
    .map(
      (entry) =>
        ({
          id: typeof entry.id === "string" && entry.id.trim() ? entry.id : randomUUID(),
          fromCompanyId: entry.fromCompanyId!,
          toCompanyId: entry.toCompanyId!,
          description: typeof entry.description === "string" ? entry.description.trim() : "",
          statementArea: entry.statementArea === "profit-and-loss" ? "profit-and-loss" : "balance-sheet",
          noteNumber: entry.noteNumber!.trim(),
          lineItem: entry.lineItem!.trim(),
          direction: entry.direction === "increase" ? "increase" : "decrease",
          currentAmount: parseNumber(entry.currentAmount),
          previousAmount: parseNumber(entry.previousAmount),
          active: entry.active !== false,
        }) satisfies ConsolidationElimination,
    )
    .filter((entry) => entry.noteNumber && entry.lineItem);

  const nextConfig: ConsolidationConfig = {
    updatedAt: new Date().toISOString(),
    members,
    eliminations,
  };

  fs.writeFileSync(getConsolidationConfigPath(scope), `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
  return nextConfig;
}

function getNoteAmount(notes: ReturnType<typeof getStatementPack>["notes"], noteNumber: string, title: string, statementArea: "balance-sheet" | "profit-and-loss") {
  const note = notes.find((entry) => entry.noteNumber === noteNumber);

  return {
    noteNumber,
    title,
    statementArea,
    current: note?.totalCurrent ?? 0,
    previous: note?.totalPrevious ?? 0,
  } satisfies NoteAmount;
}

function resolveVersionForCompany(companyId: string, requestedVersionId: string | undefined, fallbackVersionId: string) {
  const versions = listCompanyVersions(companyId);
  return versions.find((version) => version.id === requestedVersionId) ?? versions.find((version) => version.id === fallbackVersionId) ?? versions[0];
}

function buildBalanceSheetFromNotes(notes: Map<string, NoteAmount>) {
  const note = (noteNumber: string) => notes.get(noteNumber) ?? { current: 0, previous: 0 };
  const shareCapital = note("3");
  const reserves = note("4");
  const longTermBorrowings = note("5");
  const deferredTax = note("6");
  const longTermProvisions = note("7");
  const shortTermBorrowings = note("8");
  const tradePayables = note("9");
  const otherCurrentLiabilities = note("10");
  const shortTermProvisions = note("11");
  const ppe = note("12");
  const otherNonCurrentAssets = note("13");
  const inventories = note("14");
  const tradeReceivables = note("15");
  const cash = note("16");
  const shortTermLoans = note("17");
  const otherCurrentAssets = note("18");

  const shareholderFundsTotal = {
    current: shareCapital.current + reserves.current,
    previous: shareCapital.previous + reserves.previous,
  };
  const nonCurrentLiabilitiesTotal = {
    current: longTermBorrowings.current + deferredTax.current + longTermProvisions.current,
    previous: longTermBorrowings.previous + deferredTax.previous + longTermProvisions.previous,
  };
  const currentLiabilitiesTotal = {
    current: shortTermBorrowings.current + tradePayables.current + otherCurrentLiabilities.current + shortTermProvisions.current,
    previous: shortTermBorrowings.previous + tradePayables.previous + otherCurrentLiabilities.previous + shortTermProvisions.previous,
  };
  const nonCurrentAssetsTotal = {
    current: ppe.current + otherNonCurrentAssets.current,
    previous: ppe.previous + otherNonCurrentAssets.previous,
  };
  const currentAssetsTotal = {
    current: inventories.current + tradeReceivables.current + cash.current + shortTermLoans.current + otherCurrentAssets.current,
    previous: inventories.previous + tradeReceivables.previous + cash.previous + shortTermLoans.previous + otherCurrentAssets.previous,
  };
  const totalEquityAndLiabilities = {
    current: shareholderFundsTotal.current + nonCurrentLiabilitiesTotal.current + currentLiabilitiesTotal.current,
    previous: shareholderFundsTotal.previous + nonCurrentLiabilitiesTotal.previous + currentLiabilitiesTotal.previous,
  };
  const totalAssets = {
    current: nonCurrentAssetsTotal.current + currentAssetsTotal.current,
    previous: nonCurrentAssetsTotal.previous + currentAssetsTotal.previous,
  };

  return {
    rows: [
      { particulars: "I. Equity and Liabilities", emphasis: "section" as const },
      { particulars: "(1) Shareholders' funds", emphasis: "heading" as const },
      { particulars: "Share Capital", note: "3", current: shareCapital.current, previous: shareCapital.previous, emphasis: "line" as const },
      { particulars: "Reserves and Surplus", note: "4", current: reserves.current, previous: reserves.previous, emphasis: "line" as const },
      { particulars: "Total Shareholders' funds", current: shareholderFundsTotal.current, previous: shareholderFundsTotal.previous, emphasis: "total" as const },
      { particulars: "(2) Non-current liabilities", emphasis: "heading" as const },
      { particulars: "Long-term Borrowings", note: "5", current: longTermBorrowings.current, previous: longTermBorrowings.previous, emphasis: "line" as const },
      { particulars: "Deferred Tax Liabilities (Net)", note: "6", current: deferredTax.current, previous: deferredTax.previous, emphasis: "line" as const },
      { particulars: "Long-term Provisions", note: "7", current: longTermProvisions.current, previous: longTermProvisions.previous, emphasis: "line" as const },
      { particulars: "Total Non-current liabilities", current: nonCurrentLiabilitiesTotal.current, previous: nonCurrentLiabilitiesTotal.previous, emphasis: "total" as const },
      { particulars: "(3) Current liabilities", emphasis: "heading" as const },
      { particulars: "Short-term Borrowings", note: "8", current: shortTermBorrowings.current, previous: shortTermBorrowings.previous, emphasis: "line" as const },
      { particulars: "Trade Payables", note: "9", current: tradePayables.current, previous: tradePayables.previous, emphasis: "line" as const },
      { particulars: "Other Current Liabilities", note: "10", current: otherCurrentLiabilities.current, previous: otherCurrentLiabilities.previous, emphasis: "line" as const },
      { particulars: "Short-term Provisions", note: "11", current: shortTermProvisions.current, previous: shortTermProvisions.previous, emphasis: "line" as const },
      { particulars: "Total Current liabilities", current: currentLiabilitiesTotal.current, previous: currentLiabilitiesTotal.previous, emphasis: "total" as const },
      { particulars: "Total Equity and Liabilities", current: totalEquityAndLiabilities.current, previous: totalEquityAndLiabilities.previous, emphasis: "total" as const },
      { particulars: "II. Assets", emphasis: "section" as const },
      { particulars: "(1) Non-current assets", emphasis: "heading" as const },
      { particulars: "Property, Plant, Equipment and Intangible Assets", note: "12", current: ppe.current, previous: ppe.previous, emphasis: "line" as const },
      { particulars: "Other Non-current Assets", note: "13", current: otherNonCurrentAssets.current, previous: otherNonCurrentAssets.previous, emphasis: "line" as const },
      { particulars: "Total Non-current assets", current: nonCurrentAssetsTotal.current, previous: nonCurrentAssetsTotal.previous, emphasis: "total" as const },
      { particulars: "(2) Current assets", emphasis: "heading" as const },
      { particulars: "Inventories", note: "14", current: inventories.current, previous: inventories.previous, emphasis: "line" as const },
      { particulars: "Trade Receivables", note: "15", current: tradeReceivables.current, previous: tradeReceivables.previous, emphasis: "line" as const },
      { particulars: "Cash and Cash Equivalents", note: "16", current: cash.current, previous: cash.previous, emphasis: "line" as const },
      { particulars: "Short-term Loans and Advances", note: "17", current: shortTermLoans.current, previous: shortTermLoans.previous, emphasis: "line" as const },
      { particulars: "Other Current Assets", note: "18", current: otherCurrentAssets.current, previous: otherCurrentAssets.previous, emphasis: "line" as const },
      { particulars: "Total Current assets", current: currentAssetsTotal.current, previous: currentAssetsTotal.previous, emphasis: "total" as const },
      { particulars: "Total Assets", current: totalAssets.current, previous: totalAssets.previous, emphasis: "total" as const },
    ] satisfies StatementDisplayRow[],
    totalCurrent: totalAssets.current,
    totalPrevious: totalAssets.previous,
  };
}

function buildProfitAndLossFromNotes(notes: Map<string, NoteAmount>) {
  const note = (noteNumber: string) => notes.get(noteNumber) ?? { current: 0, previous: 0 };
  const revenue = note("19");
  const otherIncome = note("20");
  const materials = note("21");
  const employees = note("22");
  const finance = note("23");
  const depreciation = note("24");
  const otherExpenses = note("25");
  const taxExpense = note("26");
  const totalIncome = {
    current: revenue.current + otherIncome.current,
    previous: revenue.previous + otherIncome.previous,
  };
  const totalExpenses = {
    current: materials.current + employees.current + finance.current + depreciation.current + otherExpenses.current,
    previous: materials.previous + employees.previous + finance.previous + depreciation.previous + otherExpenses.previous,
  };
  const profitBeforeTax = {
    current: totalIncome.current - totalExpenses.current,
    previous: totalIncome.previous - totalExpenses.previous,
  };
  const profitAfterTax = {
    current: profitBeforeTax.current - taxExpense.current,
    previous: profitBeforeTax.previous - taxExpense.previous,
  };

  return {
    rows: [
      { particulars: "Revenue from Operations", note: "19", current: revenue.current, previous: revenue.previous, emphasis: "line" as const },
      { particulars: "Other Income", note: "20", current: otherIncome.current, previous: otherIncome.previous, emphasis: "line" as const },
      { particulars: "Total Income", current: totalIncome.current, previous: totalIncome.previous, emphasis: "total" as const },
      { particulars: "Expenses", emphasis: "section" as const },
      { particulars: "Cost of Materials and Manufacturing", note: "21", current: materials.current, previous: materials.previous, emphasis: "line" as const },
      { particulars: "Employee Benefits Expense", note: "22", current: employees.current, previous: employees.previous, emphasis: "line" as const },
      { particulars: "Finance Costs", note: "23", current: finance.current, previous: finance.previous, emphasis: "line" as const },
      { particulars: "Depreciation and Amortisation", note: "24", current: depreciation.current, previous: depreciation.previous, emphasis: "line" as const },
      { particulars: "Other Expenses", note: "25", current: otherExpenses.current, previous: otherExpenses.previous, emphasis: "line" as const },
      { particulars: "Total Expenses", current: totalExpenses.current, previous: totalExpenses.previous, emphasis: "total" as const },
      { particulars: "Profit before Tax", current: profitBeforeTax.current, previous: profitBeforeTax.previous, emphasis: "total" as const },
      { particulars: "Tax Expense", note: "26", current: taxExpense.current, previous: taxExpense.previous, emphasis: "line" as const },
      { particulars: "Profit after Tax", current: profitAfterTax.current, previous: profitAfterTax.previous, emphasis: "total" as const },
    ] satisfies StatementDisplayRow[],
    profitBeforeTax: profitBeforeTax.current,
    profitBeforeTaxPrevious: profitBeforeTax.previous,
    profitAfterTax: profitAfterTax.current,
    profitAfterTaxPrevious: profitAfterTax.previous,
  };
}

export function buildConsolidationSnapshot(scope?: ConsolidationScope) {
  const resolved = resolveScope(scope);
  const config = getConsolidationConfig(scope);
  const companyLookup = new Map(listCompanies().map((company) => [company.id, company]));
  const selectedMembers = [
    { companyId: resolved.companyId, versionId: resolved.versionId },
    ...config.members,
  ].filter((member, index, items) => items.findIndex((candidate) => candidate.companyId === member.companyId) === index);
  const members = selectedMembers
    .map((member) => {
      const company = companyLookup.get(member.companyId);

      if (!company) {
        return null;
      }

      const version = resolveVersionForCompany(company.id, member.versionId, resolved.versionId);

      if (!version) {
        return null;
      }

      return {
        company,
        version,
        pack: getStatementPack({
          companyId: company.id,
          versionId: version.id,
        }),
      };
    })
    .filter((member): member is NonNullable<typeof member> => member !== null);

  const noteMap = new Map<string, NoteAmount>(
    noteDefinitions.map((note) => [
      note.noteNumber,
      {
        noteNumber: note.noteNumber,
        title: note.title,
        statementArea: note.statementArea,
        current: 0,
        previous: 0,
      },
    ]),
  );
  const noteAdjustments = new Map<string, { current: number; previous: number }>();

  members.forEach((member) => {
    noteDefinitions.forEach((definition) => {
      const amount = getNoteAmount(member.pack.notes, definition.noteNumber, definition.title, definition.statementArea);
      const existing = noteMap.get(definition.noteNumber)!;
      existing.current += amount.current;
      existing.previous += amount.previous;
    });
  });

  const eliminationSummaries = config.eliminations.map((entry) => {
    const multiplier = entry.active ? (entry.direction === "increase" ? 1 : -1) : 0;
    const note = noteMap.get(entry.noteNumber);

    if (note) {
      note.current += entry.currentAmount * multiplier;
      note.previous += entry.previousAmount * multiplier;
      const adjustment = noteAdjustments.get(entry.noteNumber) ?? { current: 0, previous: 0 };
      adjustment.current += entry.currentAmount * multiplier;
      adjustment.previous += entry.previousAmount * multiplier;
      noteAdjustments.set(entry.noteNumber, adjustment);
    }

    return {
      ...entry,
      fromCompanyName: companyLookup.get(entry.fromCompanyId)?.name ?? entry.fromCompanyId,
      toCompanyName: companyLookup.get(entry.toCompanyId)?.name ?? entry.toCompanyId,
    };
  });

  const balanceSheet = buildBalanceSheetFromNotes(noteMap);
  const profitAndLoss = buildProfitAndLossFromNotes(noteMap);
  const noteImpacts = [...noteMap.values()]
    .map((note) => ({
      ...note,
      adjustmentCurrent: noteAdjustments.get(note.noteNumber)?.current ?? 0,
      adjustmentPrevious: noteAdjustments.get(note.noteNumber)?.previous ?? 0,
    }))
    .filter((note) => Math.abs(note.current) >= 0.5 || Math.abs(note.previous) >= 0.5 || Math.abs(note.adjustmentCurrent) >= 0.5 || Math.abs(note.adjustmentPrevious) >= 0.5)
    .sort((left, right) => Number(left.noteNumber) - Number(right.noteNumber));

  return {
    parentCompany: resolved.company,
    baseVersion: resolved.version,
    members: members.map((member) => ({
      companyId: member.company.id,
      companyName: member.company.name,
      versionId: member.version.id,
      versionLabel: member.version.label,
      financialYear: member.version.financialYear,
    })),
    config,
    metrics: [
      {
        label: "Companies included",
        value: String(members.length),
        detail: `${members.length - 1} group companies plus parent workspace`,
        tone: "neutral" as const,
      },
      {
        label: "Intercompany eliminations",
        value: String(config.eliminations.filter((entry) => entry.active).length),
        detail: `${config.eliminations.length} rules configured`,
        tone: config.eliminations.some((entry) => entry.active) ? "warning" : "neutral" as const,
      },
      {
        label: "Consolidated assets",
        value: formatCurrency(balanceSheet.totalCurrent),
        detail: `Previous year ${formatCurrency(balanceSheet.totalPrevious)}`,
        tone: "positive" as const,
      },
      {
        label: "Consolidated PAT",
        value: formatCurrency(profitAndLoss.profitAfterTax),
        detail: `Previous year ${formatCurrency(profitAndLoss.profitAfterTaxPrevious)}`,
        tone: profitAndLoss.profitAfterTax >= 0 ? "positive" : "warning" as const,
      },
    ],
    balanceSheet,
    profitAndLoss,
    noteImpacts,
    eliminationSummaries,
  } satisfies ConsolidationSnapshot;
}
