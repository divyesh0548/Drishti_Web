import { requireActiveCompany, resolveWorkspaceContext } from "@/lib/company-workspace";
import { loadTrialBalanceSourceFromDb } from "@/lib/trial-balance-database";
import {
  type GroupingScope,
  getLedgerGroupingOverrides,
  getLedgerGroupingOverrideStamp,
  getMasterGroupingForLedger,
  getMasterGroupingStamp,
  getSuggestedGroupingForLedger,
} from "@/lib/ledger-groupings";

export type LedgerRow = {
  financialStatementItem: string;
  glNumber: string;
  glDescription: string;
  currentYear: number;
  previousYear: number;
  accountClass: "equity-liability" | "asset" | "income" | "expense" | "clearing" | "opening-balance" | "other";
  derivedBucket:
    | "equity"
    | "non-current-liabilities"
    | "current-liabilities"
    | "non-current-assets"
    | "current-assets"
    | "clearing-assets"
    | "clearing-liabilities"
    | "revenue-from-operations"
    | "other-income"
    | "cost-of-materials"
    | "employee-benefits"
    | "finance-costs"
    | "depreciation-amortisation"
    | "other-expenses"
    | "tax-expense"
    | "opening-balance-adjustments"
    | "unclassified";
  derivedLabel: string;
  groupingKey: string;
  subgroupKey: string;
  subgroupLabel: string;
  noteNumber: string;
  noteTitle: string;
  classificationBasis: string;
  isManualGrouping: boolean;
  groupingNotes: string;
};

type StatementLine = {
  label: string;
  current: number;
  previous: number;
};

type ReviewFlag = {
  title: string;
  detail: string;
  tone: "neutral" | "warning" | "critical";
};

type DashboardMetric = {
  label: string;
  value: string;
  delta: string;
  tone: "positive" | "neutral" | "warning";
};

type BucketDefinition = {
  label: string;
  natural: "debit" | "credit";
};

type DerivedSnapshot = {
  sourcePath: string;
  sourceName: string;
  lastModified: string;
  rowCount: number;
  balanceDifferenceCurrent: number;
  balanceDifferencePrevious: number;
  rows: LedgerRow[];
  previewRows: LedgerRow[];
  topLedgers: LedgerRow[];
  groupSummaries: StatementLine[];
  dashboardMetrics: DashboardMetric[];
  balanceSheet: {
    assets: StatementLine[];
    equityAndLiabilities: StatementLine[];
    totals: {
      totalAssets: number;
      totalAssetsPrevious: number;
      totalEquityAndLiabilities: number;
      totalEquityAndLiabilitiesPrevious: number;
    };
  };
  profitAndLoss: {
    lines: StatementLine[];
    profitBeforeTax: number;
    profitBeforeTaxPrevious: number;
    profitAfterTax: number;
    profitAfterTaxPrevious: number;
  };
  mappingPreview: LedgerRow[];
  reviewFlags: ReviewFlag[];
  reportHighlights: string[];
  workflowSteps: { step: string; status: string; detail: string }[];
  accountingAssumptions: string[];
};

const bucketDefinitions: Record<
  Exclude<
    LedgerRow["derivedBucket"],
    "revenue-from-operations" | "other-income" | "cost-of-materials" | "employee-benefits" | "finance-costs" | "depreciation-amortisation" | "other-expenses" | "tax-expense" | "opening-balance-adjustments" | "unclassified"
  >,
  BucketDefinition
> = {
  equity: { label: "Equity", natural: "credit" },
  "non-current-liabilities": { label: "Non-current liabilities", natural: "credit" },
  "current-liabilities": { label: "Current liabilities", natural: "credit" },
  "non-current-assets": { label: "Non-current assets", natural: "debit" },
  "current-assets": { label: "Current assets", natural: "debit" },
  "clearing-assets": { label: "Clearing and suspense assets", natural: "debit" },
  "clearing-liabilities": { label: "Clearing and suspense liabilities", natural: "credit" },
};

const pnlDefinitions: Record<
  | "revenue-from-operations"
  | "other-income"
  | "cost-of-materials"
  | "employee-benefits"
  | "finance-costs"
  | "depreciation-amortisation"
  | "other-expenses"
  | "tax-expense",
  BucketDefinition
> = {
  "revenue-from-operations": { label: "Revenue from operations", natural: "credit" },
  "other-income": { label: "Other income", natural: "credit" },
  "cost-of-materials": { label: "Cost of materials and manufacturing", natural: "debit" },
  "employee-benefits": { label: "Employee benefits expense", natural: "debit" },
  "finance-costs": { label: "Finance costs", natural: "debit" },
  "depreciation-amortisation": { label: "Depreciation and amortisation", natural: "debit" },
  "other-expenses": { label: "Other expenses", natural: "debit" },
  "tax-expense": { label: "Tax expense", natural: "debit" },
};

const equityKeywords = [
  "share capital",
  "security premium",
  "retained earning",
  "profit & loss account",
  "profit and loss account",
  "opening balance - retained",
  "ccps",
  "equity",
];

const nonCurrentLiabilityKeywords = [
  "tl_",
  "term loan",
  "deferred tax liability",
  "gratuity",
  "leave salary",
  "borrowing",
  "transaction cost impact on tl",
];

const nonCurrentAssetKeywords = [
  "land",
  "building",
  "plant",
  "machinery",
  "office equiment",
  "office equipment",
  "computer",
  "furniture",
  "electrical",
  "software",
  "capital work in progress",
  "capital advances",
  "auc cost",
  "deposit",
  "investment",
  "deferred tax assets",
  "leasehold",
  "freehold",
];

const revenueKeywords = ["sales", "scrap", "revenue"];
const materialKeywords = [
  "cogs",
  "cogm",
  "consumption",
  "raw material",
  "packing material",
  "fuel",
  "stock",
  "inventory",
  "stores and spares",
  "semi-finished",
  "finished goods",
  "change in stock",
  "jobwork",
  "power cost",
  "labour charges",
  "effluent",
  "steam purchased",
];
const employeeKeywords = [
  "salary",
  "allowance",
  "employee",
  "staff",
  "bonus",
  "gratuity",
  "leave salary",
  "pf",
  "esic",
  "medical",
  "welfare",
  "training",
  "incentive",
];
const financeKeywords = [
  "interest",
  "bank charges",
  "buyer’s credit",
  "buyers credit",
  "cash credit",
  "loan",
  "stamp duty",
  "commission charges",
];
const taxKeywords = ["tax expense", "income tax", "deferred tax", "mat", "current tax"];

const cachedSnapshot: Record<
  string,
  { sourceVersion: string; overrideVersion: string; masterGroupingVersion: string; snapshot: DerivedSnapshot }
> = {};

function hasKeyword(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    return normalized ? Number(normalized) : 0;
  }

  return 0;
}

function hasMeaningfulLedgerSourceRow(row: Record<string, string | number>) {
  return [
    row["Financial Statement Item"],
    row["GL Number"],
    row["GL Description"],
    row["Current Year"],
    row["Previous Year"],
  ].some((value) => String(value ?? "").trim() !== "");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyInLakhs(value: number) {
  const absoluteLakhs = Math.abs(value) / 100000;
  const formattedLakhs = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: absoluteLakhs >= 1000 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(absoluteLakhs);

  return `${value < 0 ? "-" : ""}₹${formattedLakhs}L`;
}

function formatSignedDisplay(value: number, natural: "debit" | "credit") {
  return natural === "credit" ? value * -1 : value;
}

function classifyRow(
  glNumber: string,
  glDescription: string,
  currentYear: number,
  previousYear: number,
): Pick<LedgerRow, "accountClass" | "derivedBucket" | "derivedLabel" | "classificationBasis"> {
  const lowerDescription = glDescription.toLowerCase();
  const firstChar = glNumber.trim().charAt(0);

  if (firstChar === "1") {
    if (hasKeyword(lowerDescription, equityKeywords)) {
      return {
        accountClass: "equity-liability",
        derivedBucket: "equity",
        derivedLabel: "Equity",
        classificationBasis: "GL prefix 1 with equity keywords",
      };
    }

    if (hasKeyword(lowerDescription, nonCurrentLiabilityKeywords)) {
      return {
        accountClass: "equity-liability",
        derivedBucket: "non-current-liabilities",
        derivedLabel: "Non-current liabilities",
        classificationBasis: "GL prefix 1 with long-term liability keywords",
      };
    }

    return {
      accountClass: "equity-liability",
      derivedBucket: "current-liabilities",
      derivedLabel: "Current liabilities",
      classificationBasis: "GL prefix 1 defaulted to current liabilities",
    };
  }

  if (firstChar === "2") {
    if (hasKeyword(lowerDescription, nonCurrentAssetKeywords)) {
      return {
        accountClass: "asset",
        derivedBucket: "non-current-assets",
        derivedLabel: "Non-current assets",
        classificationBasis: "GL prefix 2 with non-current asset keywords",
      };
    }

    return {
      accountClass: "asset",
      derivedBucket: "current-assets",
      derivedLabel: "Current assets",
      classificationBasis: "GL prefix 2 defaulted to current assets",
    };
  }

  if (firstChar === "3") {
    if (hasKeyword(lowerDescription, revenueKeywords)) {
      return {
        accountClass: "income",
        derivedBucket: "revenue-from-operations",
        derivedLabel: "Revenue from operations",
        classificationBasis: "GL prefix 3 with sales and revenue keywords",
      };
    }

    return {
      accountClass: "income",
      derivedBucket: "other-income",
      derivedLabel: "Other income",
      classificationBasis: "GL prefix 3 defaulted to other income",
    };
  }

  if (firstChar === "4") {
    if (hasKeyword(lowerDescription, taxKeywords)) {
      return {
        accountClass: "expense",
        derivedBucket: "tax-expense",
        derivedLabel: "Tax expense",
        classificationBasis: "GL prefix 4 with tax-related keywords",
      };
    }

    if (glNumber.startsWith("405") || lowerDescription.includes("acc_dep") || lowerDescription.includes("depreci") || lowerDescription.includes("amort")) {
      return {
        accountClass: "expense",
        derivedBucket: "depreciation-amortisation",
        derivedLabel: "Depreciation and amortisation",
        classificationBasis: "GL prefix 405 or depreciation keyword",
      };
    }

    if (hasKeyword(lowerDescription, employeeKeywords)) {
      return {
        accountClass: "expense",
        derivedBucket: "employee-benefits",
        derivedLabel: "Employee benefits expense",
        classificationBasis: "GL prefix 4 with employee-related keywords",
      };
    }

    if (hasKeyword(lowerDescription, financeKeywords)) {
      return {
        accountClass: "expense",
        derivedBucket: "finance-costs",
        derivedLabel: "Finance costs",
        classificationBasis: "GL prefix 4 with finance-related keywords",
      };
    }

    if (hasKeyword(lowerDescription, materialKeywords)) {
      return {
        accountClass: "expense",
        derivedBucket: "cost-of-materials",
        derivedLabel: "Cost of materials and manufacturing",
        classificationBasis: "GL prefix 4 with material or manufacturing keywords",
      };
    }

    return {
      accountClass: "expense",
      derivedBucket: "other-expenses",
      derivedLabel: "Other expenses",
      classificationBasis: "GL prefix 4 defaulted to other expenses",
    };
  }

  if (firstChar === "8") {
    const anchor = currentYear !== 0 ? currentYear : previousYear;
    const derivedBucket = anchor >= 0 ? "clearing-assets" : "clearing-liabilities";
    return {
      accountClass: "clearing",
      derivedBucket,
      derivedLabel: derivedBucket === "clearing-assets" ? "Clearing and suspense assets" : "Clearing and suspense liabilities",
      classificationBasis: "GL prefix 8 treated as clearing and suspense balance",
    };
  }

  if (glNumber.startsWith("L")) {
    return {
      accountClass: "opening-balance",
      derivedBucket: "opening-balance-adjustments",
      derivedLabel: "Opening balance adjustments",
      classificationBasis: "Opening upload code kept outside draft statements",
    };
  }

  return {
    accountClass: "other",
    derivedBucket: "unclassified",
    derivedLabel: "Unclassified",
    classificationBasis: "Unrecognised GL code retained for review",
  };
}

function sumLines(
  lines: StatementLine[],
  labels: string[],
) {
  return lines
    .filter((line) => labels.includes(line.label))
    .reduce(
      (accumulator, line) => ({
        current: accumulator.current + line.current,
        previous: accumulator.previous + line.previous,
      }),
      { current: 0, previous: 0 },
    );
}

function pushIfValue(lines: StatementLine[], label: string, current: number, previous: number) {
  if (Math.abs(current) < 0.5 && Math.abs(previous) < 0.5) {
    return;
  }

  lines.push({ label, current, previous });
}

export async function getTrialBalanceSnapshot(scope?: GroupingScope) {
  const resolvedScope =
    scope?.companyId && scope?.versionId
      ? scope
      : {
          companyId: requireActiveCompany(resolveWorkspaceContext()).company.id,
          versionId: requireActiveCompany(resolveWorkspaceContext()).currentVersion.id,
        };
  const sourceData = await loadTrialBalanceSourceFromDb(resolvedScope.companyId!, resolvedScope.versionId!);
  if (!sourceData) {
    throw new Error("No trial balance found in the database for this company version. Re-upload the trial balance.");
  }
  const sourceModifiedAt = new Date(sourceData.lastModifiedIso);
  const sourceVersion = `${sourceData.lastModifiedIso}:${sourceData.rows.length}:${sourceData.rows
    .map((row) => `${row["GL Number"]}:${row["Current Year"]}:${row["Previous Year"]}`)
    .join("|")}`;
  const [overrideVersion, masterGroupingVersion, overrides] = await Promise.all([
    getLedgerGroupingOverrideStamp(resolvedScope),
    getMasterGroupingStamp(),
    getLedgerGroupingOverrides(resolvedScope),
  ]);
  const cacheKey = `${resolvedScope.companyId}:${resolvedScope.versionId}`;

  if (
    cachedSnapshot[cacheKey] &&
    cachedSnapshot[cacheKey].sourceVersion === sourceVersion &&
    cachedSnapshot[cacheKey].overrideVersion === overrideVersion &&
    cachedSnapshot[cacheKey].masterGroupingVersion === masterGroupingVersion
  ) {
    return cachedSnapshot[cacheKey].snapshot;
  }

  const rows: LedgerRow[] = [];
  for (const row of sourceData.rows.filter(hasMeaningfulLedgerSourceRow)) {
    const financialStatementItem = String(row["Financial Statement Item"] ?? "").trim();
    const glNumber = String(row["GL Number"] ?? "").trim();
    const glDescription = String(row["GL Description"] ?? "").trim();
    const currentYear = toNumber(row["Current Year"]);
    const previousYear = toNumber(row["Previous Year"]);
    const savedOverride = overrides[glNumber];
    const inferredClassification = classifyRow(glNumber, glDescription, currentYear, previousYear);
    const workbookGrouping = await getMasterGroupingForLedger(glNumber, glDescription, resolvedScope);
    const suggestedGrouping = await getSuggestedGroupingForLedger({
      glNumber,
      glDescription,
      bucket: inferredClassification.derivedBucket,
    }, resolvedScope);
    const classification = savedOverride
      ? {
          accountClass: savedOverride.accountClass,
          derivedBucket: savedOverride.bucket,
          derivedLabel: savedOverride.label,
          groupingKey: savedOverride.groupKey,
          subgroupKey: savedOverride.subgroupKey,
          subgroupLabel: savedOverride.subgroupLabel,
          noteNumber: savedOverride.noteNumber,
          noteTitle: savedOverride.noteTitle,
          classificationBasis: `Saved manual grouping override${savedOverride.notes ? ` · ${savedOverride.notes}` : ""}`,
        }
      : workbookGrouping
        ? {
            accountClass: workbookGrouping.accountClass,
            derivedBucket: workbookGrouping.bucket,
            derivedLabel: workbookGrouping.label,
            groupingKey: workbookGrouping.key,
            subgroupKey: workbookGrouping.subgroupKey,
            subgroupLabel: workbookGrouping.subgroupLabel,
            noteNumber: workbookGrouping.noteNumber,
            noteTitle: workbookGrouping.noteTitle,
            classificationBasis: `Master grouping file matched to ${workbookGrouping.label}`,
          }
        : suggestedGrouping
          ? {
              accountClass: suggestedGrouping.accountClass,
              derivedBucket: suggestedGrouping.bucket,
              derivedLabel: suggestedGrouping.label,
              groupingKey: suggestedGrouping.key,
              subgroupKey: suggestedGrouping.subgroupKey,
              subgroupLabel: suggestedGrouping.subgroupLabel,
              noteNumber: suggestedGrouping.noteNumber,
              noteTitle: suggestedGrouping.noteTitle,
              classificationBasis: `Heuristic fallback aligned to ${suggestedGrouping.label}`,
            }
          : {
              ...inferredClassification,
              groupingKey: "",
              subgroupKey: "",
              subgroupLabel: "",
              noteNumber: "",
              noteTitle: "",
            };

    rows.push({
      financialStatementItem,
      glNumber,
      glDescription,
      currentYear,
      previousYear,
      ...classification,
      isManualGrouping: Boolean(savedOverride),
      groupingNotes: savedOverride?.notes ?? "",
    });
  }

  const balanceDifferenceCurrent = rows.reduce((sum, row) => sum + row.currentYear, 0);
  const balanceDifferencePrevious = rows.reduce((sum, row) => sum + row.previousYear, 0);

  const balanceBucketTotals = {
    equity: { current: 0, previous: 0 },
    "non-current-liabilities": { current: 0, previous: 0 },
    "current-liabilities": { current: 0, previous: 0 },
    "non-current-assets": { current: 0, previous: 0 },
    "current-assets": { current: 0, previous: 0 },
    "clearing-assets": { current: 0, previous: 0 },
    "clearing-liabilities": { current: 0, previous: 0 },
  };

  const pnlBucketTotals = {
    "revenue-from-operations": { current: 0, previous: 0 },
    "other-income": { current: 0, previous: 0 },
    "cost-of-materials": { current: 0, previous: 0 },
    "employee-benefits": { current: 0, previous: 0 },
    "finance-costs": { current: 0, previous: 0 },
    "depreciation-amortisation": { current: 0, previous: 0 },
    "other-expenses": { current: 0, previous: 0 },
    "tax-expense": { current: 0, previous: 0 },
  };

  for (const row of rows) {
    if (row.derivedBucket in balanceBucketTotals) {
      const bucket = balanceBucketTotals[row.derivedBucket as keyof typeof balanceBucketTotals];
      bucket.current += row.currentYear;
      bucket.previous += row.previousYear;
    }

    if (row.derivedBucket in pnlBucketTotals) {
      const bucket = pnlBucketTotals[row.derivedBucket as keyof typeof pnlBucketTotals];
      bucket.current += row.currentYear;
      bucket.previous += row.previousYear;
    }
  }

  const assetLines: StatementLine[] = [];
  const equityAndLiabilityLines: StatementLine[] = [];

  for (const bucket of ["non-current-assets", "current-assets", "clearing-assets"] as const) {
    const definition = bucketDefinitions[bucket];
    pushIfValue(
      assetLines,
      definition.label,
      formatSignedDisplay(balanceBucketTotals[bucket].current, definition.natural),
      formatSignedDisplay(balanceBucketTotals[bucket].previous, definition.natural),
    );
  }

  for (const bucket of ["equity", "non-current-liabilities", "current-liabilities", "clearing-liabilities"] as const) {
    const definition = bucketDefinitions[bucket];
    pushIfValue(
      equityAndLiabilityLines,
      definition.label,
      formatSignedDisplay(balanceBucketTotals[bucket].current, definition.natural),
      formatSignedDisplay(balanceBucketTotals[bucket].previous, definition.natural),
    );
  }

  const totalAssets = assetLines.reduce((sum, line) => sum + line.current, 0);
  const totalAssetsPrevious = assetLines.reduce((sum, line) => sum + line.previous, 0);
  const totalEquityAndLiabilities = equityAndLiabilityLines.reduce((sum, line) => sum + line.current, 0);
  const totalEquityAndLiabilitiesPrevious = equityAndLiabilityLines.reduce((sum, line) => sum + line.previous, 0);

  const profitAndLossLines: StatementLine[] = [];

  for (const bucket of [
    "revenue-from-operations",
    "other-income",
    "cost-of-materials",
    "employee-benefits",
    "finance-costs",
    "depreciation-amortisation",
    "other-expenses",
    "tax-expense",
  ] as const) {
    const definition = pnlDefinitions[bucket];
    pushIfValue(
      profitAndLossLines,
      definition.label,
      formatSignedDisplay(pnlBucketTotals[bucket].current, definition.natural),
      formatSignedDisplay(pnlBucketTotals[bucket].previous, definition.natural),
    );
  }

  const revenueLine = sumLines(profitAndLossLines, ["Revenue from operations", "Other income"]);
  const expenseBeforeTax = sumLines(profitAndLossLines, [
    "Cost of materials and manufacturing",
    "Employee benefits expense",
    "Finance costs",
    "Depreciation and amortisation",
    "Other expenses",
  ]);
  const taxExpense = sumLines(profitAndLossLines, ["Tax expense"]);

  const profitBeforeTax = revenueLine.current - expenseBeforeTax.current;
  const profitBeforeTaxPrevious = revenueLine.previous - expenseBeforeTax.previous;
  const profitAfterTax = profitBeforeTax - taxExpense.current;
  const profitAfterTaxPrevious = profitBeforeTaxPrevious - taxExpense.previous;

  const currentAssetLine = assetLines.find((line) => line.label === "Current assets");
  const clearingAssetLine = assetLines.find((line) => line.label === "Clearing and suspense assets");
  const currentLiabilityLine = equityAndLiabilityLines.find((line) => line.label === "Current liabilities");
  const clearingLiabilityLine = equityAndLiabilityLines.find((line) => line.label === "Clearing and suspense liabilities");
  const equityLine = equityAndLiabilityLines.find((line) => line.label === "Equity");

  const currentAssets = (currentAssetLine?.current ?? 0) + (clearingAssetLine?.current ?? 0);
  const currentLiabilities = (currentLiabilityLine?.current ?? 0) + (clearingLiabilityLine?.current ?? 0);
  const workingCapital = currentAssets - currentLiabilities;
  const currentRatio = currentLiabilities === 0 ? 0 : currentAssets / currentLiabilities;

  const financeCosts = profitAndLossLines.find((line) => line.label === "Finance costs")?.current ?? 0;
  const depreciation = profitAndLossLines.find((line) => line.label === "Depreciation and amortisation")?.current ?? 0;
  const ebitda = profitBeforeTax + financeCosts + depreciation;

  const debtRows = rows.filter(
    (row) =>
      row.accountClass === "equity-liability" &&
      ["tl_", "wcdl", "buyer", "cash credit", "cc_"].some((keyword) => row.glDescription.toLowerCase().includes(keyword)),
  );
  const debtCurrent = debtRows.reduce((sum, row) => sum + row.currentYear * -1, 0);
  const debtToEquity = (equityLine?.current ?? 0) === 0 ? 0 : debtCurrent / (equityLine?.current ?? 1);

  const groupedByPrefix = [
    {
      label: "Equity and liability ledgers",
      current: rows.filter((row) => row.accountClass === "equity-liability").reduce((sum, row) => sum + row.currentYear * -1, 0),
      previous: rows.filter((row) => row.accountClass === "equity-liability").reduce((sum, row) => sum + row.previousYear * -1, 0),
    },
    {
      label: "Asset ledgers",
      current: rows.filter((row) => row.accountClass === "asset").reduce((sum, row) => sum + row.currentYear, 0),
      previous: rows.filter((row) => row.accountClass === "asset").reduce((sum, row) => sum + row.previousYear, 0),
    },
    {
      label: "Income ledgers",
      current: rows.filter((row) => row.accountClass === "income").reduce((sum, row) => sum + row.currentYear * -1, 0),
      previous: rows.filter((row) => row.accountClass === "income").reduce((sum, row) => sum + row.previousYear * -1, 0),
    },
    {
      label: "Expense ledgers",
      current: rows.filter((row) => row.accountClass === "expense").reduce((sum, row) => sum + row.currentYear, 0),
      previous: rows.filter((row) => row.accountClass === "expense").reduce((sum, row) => sum + row.previousYear, 0),
    },
  ];

  const clearingRows = rows.filter((row) => row.accountClass === "clearing");
  const openingRows = rows.filter((row) => row.accountClass === "opening-balance");
  const unclassifiedRows = rows.filter((row) => row.accountClass === "other");

  const reviewFlags: ReviewFlag[] = [];

  if (Math.abs(balanceDifferenceCurrent) > 1 || Math.abs(balanceDifferencePrevious) > 1) {
    reviewFlags.push({
      title: "Trial balance does not net to zero",
      detail: `Current year difference ${formatCurrency(Math.abs(balanceDifferenceCurrent))} and previous year difference ${formatCurrency(
        Math.abs(balanceDifferencePrevious),
      )}.`,
      tone: "critical",
    });
  } else {
    reviewFlags.push({
      title: "Trial balance is arithmetically balanced",
      detail: `Current year residual ${formatCurrency(Math.abs(balanceDifferenceCurrent))}; previous year residual ${formatCurrency(
        Math.abs(balanceDifferencePrevious),
      )}.`,
      tone: "neutral",
    });
  }

  if (clearingRows.length > 0) {
    const clearingTotal = clearingRows.reduce((sum, row) => sum + row.currentYear, 0);
    reviewFlags.push({
      title: "Clearing balances remain in the source ledger",
      detail: `${clearingRows.length} prefix-8 ledgers aggregate to ${formatCurrency(Math.abs(clearingTotal))} and are shown separately in the draft statements.`,
      tone: "warning",
    });
  }

  if (openingRows.length > 0) {
    reviewFlags.push({
      title: "Opening upload ledgers detected",
      detail: `${openingRows.length} opening-balance rows were excluded from draft statements and should be reviewed before final sign-off.`,
      tone: "warning",
    });
  }

  if (unclassifiedRows.length > 0) {
    reviewFlags.push({
      title: "Unclassified source rows detected",
      detail: `${unclassifiedRows.length} rows did not fit the GL pattern and remain flagged for manual review.`,
      tone: "critical",
    });
  }

  const mirroredBankGroups = Object.values(
    rows
      .filter((row) => row.glDescription.startsWith("CA_") || row.glDescription.startsWith("CC_"))
      .reduce<Record<string, { positive: number; negative: number }>>((accumulator, row) => {
        const current = accumulator[row.glDescription] ?? { positive: 0, negative: 0 };

        if (row.currentYear >= 0) {
          current.positive += row.currentYear;
        } else {
          current.negative += row.currentYear;
        }

        accumulator[row.glDescription] = current;
        return accumulator;
      }, {}),
  ).filter((entry) => entry.positive !== 0 && entry.negative !== 0);

  if (mirroredBankGroups.length > 0) {
    reviewFlags.push({
      title: "Bank ledgers contain offsetting debit and credit mirrors",
      detail: `${mirroredBankGroups.length} cash and credit-account descriptions appear as mirrored balances and should be validated against bank mapping logic.`,
      tone: "warning",
    });
  }

  const dashboardMetrics: DashboardMetric[] = [
    {
      label: "Ledger rows",
      value: rows.length.toString(),
      delta: `Workbook updated ${new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(sourceModifiedAt)}`,
      tone: "neutral",
    },
    {
      label: "Total assets",
      value: formatCurrencyInLakhs(totalAssets),
      delta: `Previous year ${formatCurrencyInLakhs(totalAssetsPrevious)}`,
      tone: "neutral",
    },
    {
      label: "Revenue from operations",
      value: formatCurrencyInLakhs(profitAndLossLines.find((line) => line.label === "Revenue from operations")?.current ?? 0),
      delta: `Previous year ${formatCurrencyInLakhs(profitAndLossLines.find((line) => line.label === "Revenue from operations")?.previous ?? 0)}`,
      tone: "positive",
    },
    {
      label: "Profit after tax",
      value: formatCurrencyInLakhs(profitAfterTax),
      delta: `EBITDA ${formatCurrencyInLakhs(ebitda)}`,
      tone: profitAfterTax >= 0 ? "positive" : "warning",
    },
    {
      label: "Current ratio",
      value: currentRatio.toFixed(2),
      delta: `Working capital ${formatCurrencyInLakhs(workingCapital)}`,
      tone: currentRatio >= 1 ? "positive" : "warning",
    },
    {
      label: "Debt to equity",
      value: debtToEquity.toFixed(2),
      delta: `Net worth ${formatCurrencyInLakhs(equityLine?.current ?? 0)}`,
      tone: "neutral",
    },
  ];

  const topLedgers = [...rows]
    .sort((left, right) => Math.abs(right.currentYear) - Math.abs(left.currentYear))
    .slice(0, 20);

  const mappingPreview = [...rows]
    .sort((left, right) => Math.abs(right.currentYear) - Math.abs(left.currentYear))
    .slice(0, 30);

  const reportHighlights = [
    `Draft balance sheet prepared with total assets of ${formatCurrency(totalAssets)}.`,
    `Revenue from operations aggregates to ${formatCurrency(
      profitAndLossLines.find((line) => line.label === "Revenue from operations")?.current ?? 0,
    )} and profit after tax to ${formatCurrency(profitAfterTax)}.`,
    `${reviewFlags.length} review flags remain open, primarily around clearing and opening-balance ledgers.`,
  ];

  const workflowSteps = [
    {
      step: "Source file ingestion",
      status: "Completed",
      detail: `${rows.length} ledger rows were loaded from ${sourceData.sourceName}.`,
    },
    {
      step: "GL-based classification",
      status: "Completed",
      detail: "The master grouping workbook was used first, then heuristic suggestions filled any gaps, and saved manual overrides were applied last.",
    },
    {
      step: "Draft statements prepared",
      status: "Completed",
      detail: "Balance sheet and profit and loss schedules are now available in the portal.",
    },
    {
      step: "Accounting review",
      status: reviewFlags.some((flag) => flag.tone === "critical") ? "Needs attention" : "Open",
      detail: `${reviewFlags.length} review flags should be resolved before issuing final financials.`,
    },
  ];

  const accountingAssumptions = [
    "Master Grouping File.xlsx was used as the primary source for current ledger grouping wherever a code match was available.",
    "Where the master grouping workbook did not contain a code, the portal suggested the closest current grouping from the same option list using GL patterns and ledger-description keywords.",
    "Any saved ledger grouping override in Mapping Studio takes precedence over both workbook and heuristic grouping.",
    "Prefix-8 ledgers were treated as clearing or suspense balances and shown separately in the draft balance sheet.",
    "Opening upload codes beginning with L were excluded from the draft statements and highlighted for manual review.",
    "Revenue, expense, and balance sheet roll-up still map into Schedule III statement buckets behind the scenes and should be validated before statutory issuance.",
  ];

  const snapshot: DerivedSnapshot = {
    sourcePath: sourceData.sourcePath,
    sourceName: sourceData.sourceName,
    lastModified: new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(sourceModifiedAt),
    rowCount: rows.length,
    balanceDifferenceCurrent,
    balanceDifferencePrevious,
    rows,
    previewRows: rows.slice(0, 20),
    topLedgers,
    groupSummaries: groupedByPrefix,
    dashboardMetrics,
    balanceSheet: {
      assets: assetLines,
      equityAndLiabilities: equityAndLiabilityLines,
      totals: {
        totalAssets,
        totalAssetsPrevious,
        totalEquityAndLiabilities,
        totalEquityAndLiabilitiesPrevious,
      },
    },
    profitAndLoss: {
      lines: profitAndLossLines,
      profitBeforeTax,
      profitBeforeTaxPrevious,
      profitAfterTax,
      profitAfterTaxPrevious,
    },
    mappingPreview,
    reviewFlags,
    reportHighlights,
    workflowSteps,
    accountingAssumptions,
  };

  cachedSnapshot[cacheKey] = {
    sourceVersion,
    overrideVersion,
    masterGroupingVersion,
    snapshot,
  };

  return snapshot;
}

export type TrialBalanceSnapshot = Awaited<ReturnType<typeof getTrialBalanceSnapshot>>;
