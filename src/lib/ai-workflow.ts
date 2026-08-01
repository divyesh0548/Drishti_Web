import type { KeyRatioRow } from "@/lib/key-ratios";
import type { TrialBalanceSnapshot } from "@/lib/trial-balance";
import { formatCurrency, formatPercent } from "@/lib/utils";

type InsightTone = "positive" | "neutral" | "warning" | "critical";
type ConfidenceLevel = "High" | "Medium" | "Low";

export type AiWorkflowStep = {
  label: string;
  detail: string;
  status: "completed" | "in-progress" | "attention";
};

export type AiMappingSuggestion = {
  field: string;
  detectedFrom: string;
  confidence: ConfidenceLevel;
  detail: string;
};

export type AiInsightMetric = {
  label: string;
  value: string;
  commentary: string;
  tone: InsightTone;
};

export type AiCopilotPrompt = {
  prompt: string;
  answer: string;
};

export type AiWorkflowInsights = {
  uploadSources: string[];
  workflowSteps: AiWorkflowStep[];
  mappingSuggestions: AiMappingSuggestion[];
  validationHighlights: Array<{ label: string; value: string; tone: InsightTone }>;
  classificationSummary: Array<{ label: string; count: number; confidence: ConfidenceLevel }>;
  executiveSummary: string[];
  profitability: AiInsightMetric[];
  liquidity: AiInsightMetric[];
  solvency: AiInsightMetric[];
  efficiency: AiInsightMetric[];
  varianceHighlights: string[];
  riskAssessment: string[];
  recommendations: string[];
  cfoNarrative: string[];
  copilotPrompts: AiCopilotPrompt[];
  reportThemes: string[];
};

function findRatio(rows: KeyRatioRow[], id: string) {
  return rows.find((row) => row.id === id);
}

function currentMetricValue(snapshot: TrialBalanceSnapshot, label: string) {
  return snapshot.dashboardMetrics.find((metric) => metric.label === label)?.value ?? "-";
}

function currentMetricDelta(snapshot: TrialBalanceSnapshot, label: string) {
  return snapshot.dashboardMetrics.find((metric) => metric.label === label)?.delta ?? "";
}

function keywordAmount(snapshot: TrialBalanceSnapshot, keywords: string[]) {
  return snapshot.rows
    .filter((row) => {
      const haystack = `${row.glDescription} ${row.noteTitle} ${row.derivedLabel}`.toLowerCase();
      return keywords.some((keyword) => haystack.includes(keyword));
    })
    .reduce(
      (total, row) => ({
        current: total.current + Math.abs(row.currentYear),
        previous: total.previous + Math.abs(row.previousYear),
      }),
      { current: 0, previous: 0 },
    );
}

function classifyConfidence(rowCount: number, matchedCount: number): ConfidenceLevel {
  if (rowCount === 0) {
    return "Low";
  }

  const coverage = matchedCount / rowCount;

  if (coverage >= 0.85) {
    return "High";
  }

  if (coverage >= 0.55) {
    return "Medium";
  }

  return "Low";
}

export function buildAiWorkflowInsights(input: {
  snapshot: TrialBalanceSnapshot;
  ratioRows: KeyRatioRow[];
  companyName: string;
  versionLabel: string;
  financialYear: string;
}) {
  const { snapshot, ratioRows, companyName, versionLabel, financialYear } = input;
  const mappedCount = snapshot.rows.filter((row) => row.noteNumber).length;
  const unmappedCount = snapshot.rows.length - mappedCount;
  const manualCount = snapshot.rows.filter((row) => row.isManualGrouping).length;
  const duplicateSignals = new Set(snapshot.rows.map((row) => row.glNumber)).size !== snapshot.rows.length;
  const currentRatio = findRatio(ratioRows, "current-ratio");
  const debtEquity = findRatio(ratioRows, "debt-equity-ratio");
  const netProfit = findRatio(ratioRows, "net-profit-ratio");
  const operatingMargin = findRatio(ratioRows, "operating-margin");
  const receivableTurnover = findRatio(ratioRows, "trade-receivables-turnover");
  const payableTurnover = findRatio(ratioRows, "trade-payables-turnover");
  const inventoryTurnover = findRatio(ratioRows, "inventory-turnover");
  const reviewCount = snapshot.reviewFlags.filter((flag) => flag.tone !== "neutral").length;
  const inventoryBalance = keywordAmount(snapshot, ["inventory", "stock", "finished goods", "raw material"]);
  const receivableBalance = keywordAmount(snapshot, ["receivable", "debtor"]);
  const payableBalance = keywordAmount(snapshot, ["payable", "creditor"]);
  const expenseSignals = snapshot.topLedgers
    .filter((row) => row.accountClass === "expense")
    .slice(0, 3)
    .map((row) => `${row.glDescription} at ${formatCurrency(Math.abs(row.currentYear))}`);

  const workflowSteps: AiWorkflowStep[] = [
    {
      label: "Upload Trial Balance",
      detail: `${snapshot.sourceName} loaded for ${companyName} ${versionLabel}. Multi-format ingestion can extend from Excel, CSV, SAP, Tally, Oracle, Zoho Books, QuickBooks, and Busy ERP exports.`,
      status: "completed",
    },
    {
      label: "Intelligent Column Mapping",
      detail: `${mappedCount} ledgers are already aligned to notes and statement buckets, with ${manualCount} company-specific overrides preserved as learning signals.`,
      status: unmappedCount > 0 ? "in-progress" : "completed",
    },
    {
      label: "Generate Financial Model",
      detail: `The current financial model has been built for ${financialYear}, including statements, grouped schedules, and validation checkpoints.`,
      status: "completed",
    },
    {
      label: "AI GL Classification Engine",
      detail: `${snapshot.rows.length} ledger rows have been classified across balance sheet and profit-and-loss structures with confidence tracking and manual review support.`,
      status: reviewCount > 0 ? "in-progress" : "completed",
    },
    {
      label: "Institutional Report Preparation",
      detail: `Balance sheet, P&L, cash flow workbook tabs, notes, and export-ready outputs are available for audit or board presentation.`,
      status: "completed",
    },
    {
      label: "AI Financial Analysis",
      detail: `${reviewCount} flagged items remain available for narrative, risk, and recommendation generation before final issue.`,
      status: reviewCount > 0 ? "attention" : "completed",
    },
  ];

  const mappingSuggestions: AiMappingSuggestion[] = [
    {
      field: "Account Code / GL Code",
      detectedFrom: "GL Number",
      confidence: "High",
      detail: "Numeric code patterns and prefix logic are already consistent across the imported trial balance.",
    },
    {
      field: "Account Name / Ledger Name",
      detectedFrom: "GL Description",
      confidence: "High",
      detail: "Descriptions are rich enough to support category inference, note assignment, and expense trend detection.",
    },
    {
      field: "Closing Balance",
      detectedFrom: "Current Year",
      confidence: "High",
      detail: "The current-year balance column is directly used for statement generation and ratio calculations.",
    },
    {
      field: "Comparative Balance",
      detectedFrom: "Previous Year",
      confidence: "High",
      detail: "Previous-year values are already present, enabling comparative statements and year-over-year analysis.",
    },
    {
      field: "Business Context / Segment",
      detectedFrom: "Financial Statement Item",
      confidence: "Medium",
      detail: "This column can serve as a header cue for import intelligence, though it may still need company-specific templates.",
    },
    {
      field: "Cost Center / Business Unit",
      detectedFrom: "Additional ERP extract columns",
      confidence: "Low",
      detail: "This data is not yet in the current workbook layout, but the upload flow can surface it when available.",
    },
  ];

  const classificationSummary: AiWorkflowInsights["classificationSummary"] = [
    {
      label: "Balance Sheet Classification",
      count: snapshot.rows.filter((row) => row.accountClass === "asset" || row.accountClass === "equity-liability").length,
      confidence: classifyConfidence(snapshot.rows.length, snapshot.rows.filter((row) => row.noteNumber && (row.accountClass === "asset" || row.accountClass === "equity-liability")).length),
    },
    {
      label: "Profit & Loss Classification",
      count: snapshot.rows.filter((row) => row.accountClass === "income" || row.accountClass === "expense").length,
      confidence: classifyConfidence(snapshot.rows.length, snapshot.rows.filter((row) => row.noteNumber && (row.accountClass === "income" || row.accountClass === "expense")).length),
    },
    {
      label: "Cash Flow Routing Readiness",
      count: snapshot.rows.filter((row) => row.noteNumber).length,
      confidence: unmappedCount <= 8 ? "High" : unmappedCount <= 20 ? "Medium" : "Low",
    },
  ];

  const profitability: AiInsightMetric[] = [
    {
      label: "Revenue from Operations",
      value: currentMetricValue(snapshot, "Revenue from operations"),
      commentary: currentMetricDelta(snapshot, "Revenue from operations"),
      tone: "positive",
    },
    {
      label: "Profit After Tax",
      value: currentMetricValue(snapshot, "Profit after tax"),
      commentary: `Net profit ratio ${netProfit ? formatPercent(netProfit.current) : "not available"} with ${expenseSignals.length > 0 ? expenseSignals[0] : "no major expense spike detected"} as a key driver.`,
      tone: snapshot.profitAndLoss.profitAfterTax >= 0 ? "positive" : "warning",
    },
    {
      label: "Operating Margin",
      value: operatingMargin ? formatPercent(operatingMargin.current) : "-",
      commentary: operatingMargin?.changePercent === null ? "No prior comparison available." : `Year-over-year change ${Math.round(operatingMargin?.changePercent ?? 0)}%.`,
      tone: (operatingMargin?.current ?? 0) >= 10 ? "positive" : "warning",
    },
  ];

  const liquidity: AiInsightMetric[] = [
    {
      label: "Current Ratio",
      value: currentRatio ? currentRatio.current.toFixed(2) : "-",
      commentary: currentRatio && currentRatio.current >= 1 ? "Working capital remains above near-term liabilities." : "Liquidity headroom needs close review.",
      tone: (currentRatio?.current ?? 0) >= 1 ? "positive" : "critical",
    },
    {
      label: "Receivable Position",
      value: formatCurrency(receivableBalance.current),
      commentary: receivableTurnover ? `Trade receivables turnover ${receivableTurnover.current.toFixed(2)}x based on the mapped note model.` : "Turnover not yet available from the current mapping basis.",
      tone: receivableBalance.current > 0 ? "neutral" : "warning",
    },
    {
      label: "Cash and Liquidity Signals",
      value: currentMetricDelta(snapshot, "Current ratio") || "Working capital signal unavailable",
      commentary: `Inventory at ${formatCurrency(inventoryBalance.current)} and payables at ${formatCurrency(payableBalance.current)} drive short-term funding needs.`,
      tone: reviewCount > 0 ? "warning" : "positive",
    },
  ];

  const solvency: AiInsightMetric[] = [
    {
      label: "Debt-to-Equity Ratio",
      value: debtEquity ? debtEquity.current.toFixed(2) : "-",
      commentary: debtEquity?.changePercent === null ? "No prior comparison available." : `Year-over-year movement ${Math.round(debtEquity?.changePercent ?? 0)}%.`,
      tone: (debtEquity?.current ?? 0) <= 2 ? "positive" : "warning",
    },
    {
      label: "Review Flags",
      value: `${reviewCount}`,
      commentary: "Open validation items are incorporated into solvency and issuance review.",
      tone: reviewCount === 0 ? "positive" : reviewCount <= 2 ? "warning" : "critical",
    },
    {
      label: "Balance Sheet Integrity",
      value: `${formatCurrency(snapshot.balanceSheet.totals.totalAssets)}`,
      commentary: `Assets versus equity and liabilities remain aligned in the current generated model.`,
      tone: "positive",
    },
  ];

  const efficiency: AiInsightMetric[] = [
    {
      label: "Inventory Turnover",
      value: inventoryTurnover ? inventoryTurnover.current.toFixed(2) : "-",
      commentary: `Inventory currently sits at ${formatCurrency(inventoryBalance.current)} across mapped stock-ledger patterns.`,
      tone: inventoryBalance.current > 0 ? "neutral" : "warning",
    },
    {
      label: "Receivable Turnover",
      value: receivableTurnover ? receivableTurnover.current.toFixed(2) : "-",
      commentary: "Useful for monitoring collection velocity and customer working capital exposure.",
      tone: "neutral",
    },
    {
      label: "Payable Turnover",
      value: payableTurnover ? payableTurnover.current.toFixed(2) : "-",
      commentary: "Supports vendor payment-cycle analysis and procurement pressure review.",
      tone: "neutral",
    },
  ];

  const executiveSummary = [
    `${companyName} ${versionLabel} for ${financialYear} is already producing a generated financial model with ${snapshot.rows.length} source ledgers, ${mappedCount} mapped lines, and export-ready statements.`,
    `Current performance highlights include revenue of ${currentMetricValue(snapshot, "Revenue from operations")} and profit after tax of ${currentMetricValue(snapshot, "Profit after tax")}.`,
    reviewCount > 0
      ? `${reviewCount} validation or classification items still need attention before final issue, with the current focus on ${snapshot.reviewFlags[0]?.title ?? "remaining review checks"}.`
      : "The current model is largely clean, with no material validation blockers visible in the latest review queue.",
  ];

  const varianceHighlights = [
    `Top balance movement currently sits in ${snapshot.topLedgers[0]?.glDescription ?? "the leading ledger cluster"} at ${formatCurrency(Math.abs(snapshot.topLedgers[0]?.currentYear ?? 0))}.`,
    expenseSignals.length > 0
      ? `Expense-side attention is concentrated in ${expenseSignals.join(", ")}.`
      : "No material expense outliers were detected in the leading current-year ledger set.",
    duplicateSignals
      ? "Potential duplicate GL coding patterns were detected and should be reviewed before final sign-off."
      : "No duplicate GL pattern signals were detected in the current imported model.",
  ];

  const riskAssessment = [
    (currentRatio?.current ?? 0) < 1 ? "Current ratio is below 1.0, indicating pressure on near-term liquidity coverage." : "Current ratio remains above 1.0, suggesting manageable short-term liquidity coverage.",
    (debtEquity?.current ?? 0) > 2 ? "Debt-to-equity is elevated and may warrant covenant or leverage review." : "Leverage remains within a more manageable range based on the current debt-to-equity profile.",
    reviewCount > 2 ? "Multiple validation flags remain open, increasing audit and issuance risk until they are cleared." : "Validation risk is present but limited to a manageable set of review points.",
    inventoryBalance.current > receivableBalance.current * 1.5 ? "Inventory concentration appears relatively high versus receivables and may warrant slower-moving stock analysis." : "Inventory concentration does not currently dominate the working capital profile.",
  ];

  const recommendations = [
    unmappedCount > 0
      ? `Resolve the remaining ${unmappedCount} unmapped ledgers so the AI classification engine can raise its balance-sheet and cash-flow confidence.`
      : "Lock the current company-specific mapping as a reusable template so future imports can move directly into model generation.",
    (currentRatio?.current ?? 0) < 1
      ? "Focus on receivable collections, inventory discipline, and payable planning to restore short-term liquidity resilience."
      : "Use the current liquidity position to benchmark working capital optimization opportunities company by company.",
    reviewCount > 0
      ? "Clear the highlighted validation flags before publishing board or audit-facing packs."
      : "Move from draft issue control into narrative generation, investor-style reporting, and automated CFO commentary.",
  ];

  const cfoNarrative = [
    `${companyName} has completed the latest financial model preparation cycle for ${financialYear} using the ${versionLabel} workspace. The current model is drawing from ${snapshot.sourceName} and is producing comparative statement outputs with governed version control.`,
    `From a performance perspective, revenue is currently reported at ${currentMetricValue(snapshot, "Revenue from operations")}, with profit after tax at ${currentMetricValue(snapshot, "Profit after tax")}. Liquidity indicators are signaling a current ratio of ${currentRatio ? currentRatio.current.toFixed(2) : "n/a"}, while leverage is reflected in a debt-to-equity ratio of ${debtEquity ? debtEquity.current.toFixed(2) : "n/a"}.`,
    reviewCount > 0
      ? `Before final issue, management should prioritize clearing the remaining ${reviewCount} review items, especially ${snapshot.reviewFlags[0]?.title ?? "the leading validation exception"}, and then use the cleaned model for board narrative, MD&A, and investor-style reporting.`
      : "With no material validation blockers visible, the workspace is well positioned to move into executive commentary, board reporting, and deeper AI-assisted financial analysis.",
  ];

  const copilotPrompts: AiCopilotPrompt[] = [
    {
      prompt: "Why has EBITDA reduced this year?",
      answer: `Based on the current financial model, the strongest downward pressure is coming from ${expenseSignals.length > 0 ? expenseSignals.join(", ") : "the major current-year expense ledgers"}. Pair that with operating margin at ${operatingMargin ? formatPercent(operatingMargin.current) : "n/a"} and review the top expense-ledger changes before finalizing commentary.`,
    },
    {
      prompt: "Show ledgers contributing to inventory growth.",
      answer: `Inventory-linked balances currently total ${formatCurrency(inventoryBalance.current)}. The strongest contributors are the mapped inventory and stock-ledger patterns in the imported trial balance, and you can validate them further through Mapping Studio and the note-level schedules.`,
    },
    {
      prompt: "Summarize major changes in fixed assets.",
      answer: `The latest model is already set up to reconcile fixed asset schedules in the fixed-asset workspace. From the current balance-sheet classification, non-current asset concentrations should be reviewed alongside the fixed asset register upload to explain year-over-year movement cleanly.`,
    },
    {
      prompt: "Identify unusual expense trends.",
      answer: expenseSignals.length > 0
        ? `The most visible expense-side movements are ${expenseSignals.join(", ")}. These should be reviewed for one-offs, classification leakage, or operating cost escalation before the CFO narrative is finalized.`
        : "No dominant expense spike stands out in the current top-ledger set, but a ratio-ledger review is still recommended for operating margin commentary.",
    },
    {
      prompt: "Explain why working capital increased.",
      answer: `Working capital commentary should center on current ratio ${currentRatio ? currentRatio.current.toFixed(2) : "n/a"}, receivables at ${formatCurrency(receivableBalance.current)}, payables at ${formatCurrency(payableBalance.current)}, and inventory at ${formatCurrency(inventoryBalance.current)}. These are the main working-capital buckets driving the latest model.`,
    },
    {
      prompt: "Generate a board meeting summary.",
      answer: executiveSummary.join(" "),
    },
    {
      prompt: "Prepare MD&A from the financial statements.",
      answer: cfoNarrative.join(" "),
    },
  ];

  return {
    uploadSources: ["Excel (.xlsx)", "CSV (.csv)", "SAP Export", "Tally Export", "Oracle Export", "Zoho Books", "QuickBooks", "Busy ERP"],
    workflowSteps,
    mappingSuggestions,
    validationHighlights: [
      { label: "Mapped Ledgers", value: `${mappedCount}`, tone: unmappedCount === 0 ? "positive" : "neutral" },
      { label: "Unmapped Ledgers", value: `${unmappedCount}`, tone: unmappedCount === 0 ? "positive" : "warning" },
      { label: "Validation Flags", value: `${reviewCount}`, tone: reviewCount === 0 ? "positive" : reviewCount <= 2 ? "warning" : "critical" },
      { label: "Duplicate GL Signal", value: duplicateSignals ? "Detected" : "Clear", tone: duplicateSignals ? "warning" : "positive" },
    ],
    classificationSummary,
    executiveSummary,
    profitability,
    liquidity,
    solvency,
    efficiency,
    varianceHighlights,
    riskAssessment,
    recommendations,
    cfoNarrative,
    copilotPrompts,
    reportThemes: ["Corporate", "Big Four Audit Style", "Board Presentation", "Investor Report"],
  } satisfies AiWorkflowInsights;
}
