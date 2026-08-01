import fs from "node:fs";
import path from "node:path";

import { getCompanyLogicPaths, getCompanyVersionPaths, resolveWorkspaceContext } from "@/lib/company-workspace";
import type { LedgerRow } from "@/lib/trial-balance";

export type GroupingBucket = LedgerRow["derivedBucket"];

export type LedgerGroupingOption = {
  key: string;
  label: string;
  statementArea: "balance-sheet" | "profit-and-loss" | "review";
};

export type LedgerSubgroupOption = {
  key: string;
  groupKey: string;
  label: string;
  noteNumber: string;
  noteTitle: string;
  statementArea: "balance-sheet" | "profit-and-loss" | "review";
  bucketOverride?: GroupingBucket;
};

export type LedgerGroupingOverride = {
  glNumber: string;
  glDescription: string;
  groupKey: string;
  subgroupKey: string;
  accountClass: LedgerRow["accountClass"];
  bucket: GroupingBucket;
  label: string;
  subgroupLabel: string;
  noteNumber: string;
  noteTitle: string;
  notes: string;
  updatedAt: string;
};

export type ResolvedLedgerGrouping = {
  key: string;
  label: string;
  accountClass: LedgerRow["accountClass"];
  bucket: GroupingBucket;
  statementArea: "balance-sheet" | "profit-and-loss" | "review";
  subgroupKey: string;
  subgroupLabel: string;
  noteNumber: string;
  noteTitle: string;
};

type GroupingStore = {
  updatedAt: string | null;
  overrides: Record<string, LedgerGroupingOverride>;
};

type RawGroupingStore = {
  updatedAt?: string | null;
  overrides?: Record<string, Partial<LedgerGroupingOverride> & { bucket?: string; subgroupKey?: string }>;
};

type MasterGroupingSource = {
  options: LedgerGroupingOption[];
  lookup: Record<string, { key: string; label: string }>;
};

type SubgroupCatalogEntry = LedgerSubgroupOption & {
  keywords: string[];
};

export type GroupingScope = {
  companyId?: string;
  versionId?: string;
};

const cachedMasterGroupingSource: Record<string, { version: number; source: MasterGroupingSource }> = {};

const noteTitleByNumber = {
  "3": "Share Capital",
  "4": "Reserves and Surplus",
  "5": "Long-term Borrowings",
  "6": "Deferred Tax Liabilities (Net)",
  "7": "Long-term Provisions",
  "8": "Short-term Borrowings",
  "9": "Trade Payables",
  "10": "Other Current Liabilities",
  "11": "Short-term Provisions",
  "12": "Property, Plant, Equipment and Intangible Assets",
  "13": "Other Non-current Assets",
  "14": "Inventories",
  "15": "Trade Receivables",
  "16": "Cash and Cash Equivalents",
  "17": "Short-term Loans and Advances",
  "18": "Other Current Assets",
  "19": "Revenue from Operations",
  "20": "Other Income",
  "21": "Cost of Materials and Manufacturing",
  "22": "Employee Benefits Expense",
  "23": "Finance Costs",
  "24": "Depreciation and Amortisation",
  "25": "Other Expenses",
  "26": "Tax Expense",
} as const;

const subgroupCatalog: SubgroupCatalogEntry[] = [
  { key: "equity-share-capital-main", groupKey: "equity-share-capital", label: "Equity share capital", noteNumber: "3", noteTitle: noteTitleByNumber["3"], statementArea: "balance-sheet", keywords: ["share capital", "equity share"] },
  { key: "equity-share-capital-ccps", groupKey: "equity-share-capital", label: "Preference shares / CCPS", noteNumber: "3", noteTitle: noteTitleByNumber["3"], statementArea: "balance-sheet", keywords: ["ccps", "preference"] },
  { key: "other-equity-securities-premium", groupKey: "other-equity", label: "Securities premium", noteNumber: "4", noteTitle: noteTitleByNumber["4"], statementArea: "balance-sheet", keywords: ["securities premium", "premium"] },
  { key: "other-equity-retained-earnings", groupKey: "other-equity", label: "Retained earnings", noteNumber: "4", noteTitle: noteTitleByNumber["4"], statementArea: "balance-sheet", keywords: ["retained", "profit & loss account", "profit and loss account", "surplus"] },
  { key: "other-equity-other-reserves", groupKey: "other-equity", label: "Other reserves", noteNumber: "4", noteTitle: noteTitleByNumber["4"], statementArea: "balance-sheet", keywords: ["reserve", "equity"] },
  { key: "borrowings-term-loans", groupKey: "borrowings", label: "Term loans", noteNumber: "5", noteTitle: noteTitleByNumber["5"], statementArea: "balance-sheet", bucketOverride: "non-current-liabilities", keywords: ["term loan", "tl_", "vehicle loan"] },
  { key: "borrowings-lease-liabilities", groupKey: "borrowings", label: "Lease liabilities", noteNumber: "5", noteTitle: noteTitleByNumber["5"], statementArea: "balance-sheet", bucketOverride: "non-current-liabilities", keywords: ["lease liability"] },
  { key: "borrowings-other-long-term", groupKey: "borrowings", label: "Other long-term borrowings", noteNumber: "5", noteTitle: noteTitleByNumber["5"], statementArea: "balance-sheet", bucketOverride: "non-current-liabilities", keywords: ["borrowing", "loan"] },
  { key: "borrowings-cash-credit", groupKey: "borrowings", label: "Cash credit", noteNumber: "8", noteTitle: noteTitleByNumber["8"], statementArea: "balance-sheet", bucketOverride: "current-liabilities", keywords: ["cash credit", "cc_"] },
  { key: "borrowings-working-capital-demand-loan", groupKey: "borrowings", label: "Working capital demand loan", noteNumber: "8", noteTitle: noteTitleByNumber["8"], statementArea: "balance-sheet", bucketOverride: "current-liabilities", keywords: ["wcdl"] },
  { key: "borrowings-buyers-credit", groupKey: "borrowings", label: "Buyer's credit", noteNumber: "8", noteTitle: noteTitleByNumber["8"], statementArea: "balance-sheet", bucketOverride: "current-liabilities", keywords: ["buyer", "buyers credit"] },
  { key: "borrowings-current-maturities", groupKey: "borrowings", label: "Current maturities and accrued interest", noteNumber: "8", noteTitle: noteTitleByNumber["8"], statementArea: "balance-sheet", bucketOverride: "current-liabilities", keywords: ["current maturity", "interest accrued"] },
  { key: "borrowings-other-short-term", groupKey: "borrowings", label: "Other short-term borrowings", noteNumber: "8", noteTitle: noteTitleByNumber["8"], statementArea: "balance-sheet", bucketOverride: "current-liabilities", keywords: ["borrowing", "loan"] },
  { key: "deferred-tax-main", groupKey: "deferred-tax-liabilities-net", label: "Deferred tax", noteNumber: "6", noteTitle: noteTitleByNumber["6"], statementArea: "balance-sheet", keywords: ["deferred tax"] },
  { key: "provisions-gratuity", groupKey: "provisions", label: "Gratuity and leave benefits", noteNumber: "7", noteTitle: noteTitleByNumber["7"], statementArea: "balance-sheet", bucketOverride: "non-current-liabilities", keywords: ["gratuity", "leave salary", "leave encashment", "compensated absences"] },
  { key: "provisions-other-long-term", groupKey: "provisions", label: "Other long-term provisions", noteNumber: "7", noteTitle: noteTitleByNumber["7"], statementArea: "balance-sheet", bucketOverride: "non-current-liabilities", keywords: ["provision"] },
  { key: "provisions-bonus", groupKey: "provisions", label: "Bonus and incentive provisions", noteNumber: "11", noteTitle: noteTitleByNumber["11"], statementArea: "balance-sheet", bucketOverride: "current-liabilities", keywords: ["bonus", "incentive"] },
  { key: "provisions-tax-and-statutory", groupKey: "provisions", label: "Tax and statutory provisions", noteNumber: "11", noteTitle: noteTitleByNumber["11"], statementArea: "balance-sheet", bucketOverride: "current-liabilities", keywords: ["tax", "statutory", "msme"] },
  { key: "provisions-other-short-term", groupKey: "provisions", label: "Other short-term provisions", noteNumber: "11", noteTitle: noteTitleByNumber["11"], statementArea: "balance-sheet", bucketOverride: "current-liabilities", keywords: ["provision", "salary payable"] },
  { key: "trade-payables-msme", groupKey: "trade-payables", label: "MSME trade payables", noteNumber: "9", noteTitle: noteTitleByNumber["9"], statementArea: "balance-sheet", keywords: ["msme"] },
  { key: "trade-payables-raw-material", groupKey: "trade-payables", label: "Trade creditors for materials", noteNumber: "9", noteTitle: noteTitleByNumber["9"], statementArea: "balance-sheet", keywords: ["creditor", "supplier", "material"] },
  { key: "trade-payables-services", groupKey: "trade-payables", label: "Trade creditors for services", noteNumber: "9", noteTitle: noteTitleByNumber["9"], statementArea: "balance-sheet", keywords: ["job work", "service", "expense payable"] },
  { key: "trade-payables-other", groupKey: "trade-payables", label: "Other trade payables", noteNumber: "9", noteTitle: noteTitleByNumber["9"], statementArea: "balance-sheet", keywords: ["payable", "payables", "creditor"] },
  { key: "other-financial-liabilities-employee", groupKey: "other-financial-liabilities", label: "Employee dues", noteNumber: "10", noteTitle: noteTitleByNumber["10"], statementArea: "balance-sheet", keywords: ["salary", "bonus", "employee", "pf", "esic"] },
  { key: "other-financial-liabilities-statutory", groupKey: "other-financial-liabilities", label: "Statutory dues payable", noteNumber: "10", noteTitle: noteTitleByNumber["10"], statementArea: "balance-sheet", keywords: ["gst", "tds", "tcs", "tax", "duty"] },
  { key: "other-financial-liabilities-security", groupKey: "other-financial-liabilities", label: "Security deposits and other balances", noteNumber: "10", noteTitle: noteTitleByNumber["10"], statementArea: "balance-sheet", keywords: ["deposit", "retention"] },
  { key: "other-financial-liabilities-other", groupKey: "other-financial-liabilities", label: "Other financial liabilities", noteNumber: "10", noteTitle: noteTitleByNumber["10"], statementArea: "balance-sheet", keywords: ["liability", "payable"] },
  { key: "other-current-liabilities-customer-advances", groupKey: "other-current-liabilities", label: "Advances from customers", noteNumber: "10", noteTitle: noteTitleByNumber["10"], statementArea: "balance-sheet", keywords: ["advance from customer", "customer advance"] },
  { key: "other-current-liabilities-statutory", groupKey: "other-current-liabilities", label: "Statutory liabilities", noteNumber: "10", noteTitle: noteTitleByNumber["10"], statementArea: "balance-sheet", keywords: ["gst", "tds", "tcs", "tax", "duty"] },
  { key: "other-current-liabilities-accrued-expenses", groupKey: "other-current-liabilities", label: "Accrued expenses", noteNumber: "10", noteTitle: noteTitleByNumber["10"], statementArea: "balance-sheet", keywords: ["accrued", "expense payable", "salary payable"] },
  { key: "other-current-liabilities-other", groupKey: "other-current-liabilities", label: "Other current liabilities", noteNumber: "10", noteTitle: noteTitleByNumber["10"], statementArea: "balance-sheet", keywords: ["liability", "payable"] },
  { key: "ppe-freehold-land", groupKey: "property-plant-and-equipment", label: "Freehold land", noteNumber: "12", noteTitle: noteTitleByNumber["12"], statementArea: "balance-sheet", keywords: ["freehold land", "land"] },
  { key: "ppe-building", groupKey: "property-plant-and-equipment", label: "Building", noteNumber: "12", noteTitle: noteTitleByNumber["12"], statementArea: "balance-sheet", keywords: ["building"] },
  { key: "ppe-plant-machinery", groupKey: "property-plant-and-equipment", label: "Plant and machinery", noteNumber: "12", noteTitle: noteTitleByNumber["12"], statementArea: "balance-sheet", keywords: ["plant", "machinery"] },
  { key: "ppe-office-equipment", groupKey: "property-plant-and-equipment", label: "Office equipment", noteNumber: "12", noteTitle: noteTitleByNumber["12"], statementArea: "balance-sheet", keywords: ["office equipment", "office equiment"] },
  { key: "ppe-computers", groupKey: "property-plant-and-equipment", label: "Computers", noteNumber: "12", noteTitle: noteTitleByNumber["12"], statementArea: "balance-sheet", keywords: ["computer"] },
  { key: "ppe-furniture-fixtures", groupKey: "property-plant-and-equipment", label: "Furniture and fixtures", noteNumber: "12", noteTitle: noteTitleByNumber["12"], statementArea: "balance-sheet", keywords: ["furniture", "fixture"] },
  { key: "ppe-electrical-fittings", groupKey: "property-plant-and-equipment", label: "Electrical fittings", noteNumber: "12", noteTitle: noteTitleByNumber["12"], statementArea: "balance-sheet", keywords: ["electrical"] },
  { key: "ppe-capital-work-in-progress", groupKey: "property-plant-and-equipment", label: "Capital work-in-progress", noteNumber: "12", noteTitle: noteTitleByNumber["12"], statementArea: "balance-sheet", keywords: ["capital work in progress", "cwip", "capital wip"] },
  { key: "ppe-leasehold-land", groupKey: "property-plant-and-equipment", label: "Leasehold land / right-of-use asset", noteNumber: "12", noteTitle: noteTitleByNumber["12"], statementArea: "balance-sheet", keywords: ["leasehold", "right of use", "rou"] },
  { key: "ppe-building-on-lease", groupKey: "property-plant-and-equipment", label: "Building on lease", noteNumber: "12", noteTitle: noteTitleByNumber["12"], statementArea: "balance-sheet", keywords: ["building on lease"] },
  { key: "ppe-intangible-assets", groupKey: "property-plant-and-equipment", label: "Intangible assets", noteNumber: "12", noteTitle: noteTitleByNumber["12"], statementArea: "balance-sheet", keywords: ["intangible", "software", "license"] },
  { key: "ppe-other", groupKey: "property-plant-and-equipment", label: "Other property, plant and equipment", noteNumber: "12", noteTitle: noteTitleByNumber["12"], statementArea: "balance-sheet", keywords: ["asset"] },
  { key: "non-current-assets-capital-advances", groupKey: "non-current-assets", label: "Capital advances", noteNumber: "13", noteTitle: noteTitleByNumber["13"], statementArea: "balance-sheet", keywords: ["capital advance"] },
  { key: "non-current-assets-long-term-advances", groupKey: "non-current-assets", label: "Long-term advances", noteNumber: "13", noteTitle: noteTitleByNumber["13"], statementArea: "balance-sheet", keywords: ["advance", "long term"] },
  { key: "non-current-assets-other", groupKey: "non-current-assets", label: "Other non-current assets", noteNumber: "13", noteTitle: noteTitleByNumber["13"], statementArea: "balance-sheet", keywords: ["asset"] },
  { key: "other-financial-assets-investments", groupKey: "other-financial-assets", label: "Investments", noteNumber: "13", noteTitle: noteTitleByNumber["13"], statementArea: "balance-sheet", keywords: ["investment"] },
  { key: "other-financial-assets-long-term-loans", groupKey: "other-financial-assets", label: "Loans and advances", noteNumber: "13", noteTitle: noteTitleByNumber["13"], statementArea: "balance-sheet", keywords: ["loan", "advance"] },
  { key: "other-financial-assets-security-deposits", groupKey: "other-financial-assets", label: "Security deposits", noteNumber: "13", noteTitle: noteTitleByNumber["13"], statementArea: "balance-sheet", keywords: ["deposit", "fd_", "security"] },
  { key: "other-financial-assets-other", groupKey: "other-financial-assets", label: "Other non-current financial assets", noteNumber: "13", noteTitle: noteTitleByNumber["13"], statementArea: "balance-sheet", keywords: ["financial"] },
  { key: "inventories-raw-materials", groupKey: "inventories", label: "Raw materials", noteNumber: "14", noteTitle: noteTitleByNumber["14"], statementArea: "balance-sheet", keywords: ["raw material"] },
  { key: "inventories-work-in-progress", groupKey: "inventories", label: "Work-in-progress", noteNumber: "14", noteTitle: noteTitleByNumber["14"], statementArea: "balance-sheet", keywords: ["work in progress", "wip"] },
  { key: "inventories-semi-finished-goods", groupKey: "inventories", label: "Semi-finished goods", noteNumber: "14", noteTitle: noteTitleByNumber["14"], statementArea: "balance-sheet", keywords: ["semi-finished", "sfg"] },
  { key: "inventories-finished-goods", groupKey: "inventories", label: "Finished goods", noteNumber: "14", noteTitle: noteTitleByNumber["14"], statementArea: "balance-sheet", keywords: ["finished goods"] },
  { key: "inventories-stores-and-spares", groupKey: "inventories", label: "Stores and spares", noteNumber: "14", noteTitle: noteTitleByNumber["14"], statementArea: "balance-sheet", keywords: ["stores", "spares"] },
  { key: "inventories-stock-in-transit", groupKey: "inventories", label: "Stock in transit", noteNumber: "14", noteTitle: noteTitleByNumber["14"], statementArea: "balance-sheet", keywords: ["transit"] },
  { key: "inventories-other", groupKey: "inventories", label: "Other inventories", noteNumber: "14", noteTitle: noteTitleByNumber["14"], statementArea: "balance-sheet", keywords: ["inventory", "stock"] },
  { key: "trade-receivables-domestic", groupKey: "trade-receivables", label: "Domestic trade receivables", noteNumber: "15", noteTitle: noteTitleByNumber["15"], statementArea: "balance-sheet", keywords: ["domestic"] },
  { key: "trade-receivables-export", groupKey: "trade-receivables", label: "Export trade receivables", noteNumber: "15", noteTitle: noteTitleByNumber["15"], statementArea: "balance-sheet", keywords: ["export"] },
  { key: "trade-receivables-related-party", groupKey: "trade-receivables", label: "Related party receivables", noteNumber: "15", noteTitle: noteTitleByNumber["15"], statementArea: "balance-sheet", keywords: ["related party"] },
  { key: "trade-receivables-other", groupKey: "trade-receivables", label: "Other trade receivables", noteNumber: "15", noteTitle: noteTitleByNumber["15"], statementArea: "balance-sheet", keywords: ["receivable", "debtor", "customer"] },
  { key: "cash-bank-balances", groupKey: "cash-cash-equivalents", label: "Balances with banks", noteNumber: "16", noteTitle: noteTitleByNumber["16"], statementArea: "balance-sheet", keywords: ["bank", "ca_"] },
  { key: "cash-cash-on-hand", groupKey: "cash-cash-equivalents", label: "Cash on hand", noteNumber: "16", noteTitle: noteTitleByNumber["16"], statementArea: "balance-sheet", keywords: ["cash in hand", "cash on hand"] },
  { key: "cash-other-bank-balances", groupKey: "cash-cash-equivalents", label: "Other bank balances", noteNumber: "16", noteTitle: noteTitleByNumber["16"], statementArea: "balance-sheet", keywords: ["margin", "fixed deposit", "earmark"] },
  { key: "cash-other", groupKey: "cash-cash-equivalents", label: "Other cash equivalents", noteNumber: "16", noteTitle: noteTitleByNumber["16"], statementArea: "balance-sheet", keywords: ["cash", "bank"] },
  { key: "other-current-assets-short-term-loans", groupKey: "other-current-assets", label: "Short-term loans and advances", noteNumber: "17", noteTitle: noteTitleByNumber["17"], statementArea: "balance-sheet", keywords: ["loan", "advance", "advance to", "prepaid rent"] },
  { key: "other-current-assets-prepaids", groupKey: "other-current-assets", label: "Prepaid expenses", noteNumber: "18", noteTitle: noteTitleByNumber["18"], statementArea: "balance-sheet", keywords: ["prepaid"] },
  { key: "other-current-assets-balances-with-authorities", groupKey: "other-current-assets", label: "Balances with authorities", noteNumber: "18", noteTitle: noteTitleByNumber["18"], statementArea: "balance-sheet", keywords: ["gst", "tds", "tcs", "tax", "duty"] },
  { key: "other-current-assets-other", groupKey: "other-current-assets", label: "Other current assets", noteNumber: "18", noteTitle: noteTitleByNumber["18"], statementArea: "balance-sheet", keywords: ["asset", "receivable"] },
  { key: "other-tax-assets-gst", groupKey: "other-tax-assets-net", label: "GST and indirect tax balances", noteNumber: "18", noteTitle: noteTitleByNumber["18"], statementArea: "balance-sheet", keywords: ["gst", "indirect tax"] },
  { key: "other-tax-assets-tds", groupKey: "other-tax-assets-net", label: "TDS / TCS receivable", noteNumber: "18", noteTitle: noteTitleByNumber["18"], statementArea: "balance-sheet", keywords: ["tds", "tcs"] },
  { key: "other-tax-assets-advance-tax", groupKey: "other-tax-assets-net", label: "Advance income tax", noteNumber: "18", noteTitle: noteTitleByNumber["18"], statementArea: "balance-sheet", keywords: ["advance tax", "income tax"] },
  { key: "other-tax-assets-other", groupKey: "other-tax-assets-net", label: "Other tax assets", noteNumber: "18", noteTitle: noteTitleByNumber["18"], statementArea: "balance-sheet", keywords: ["tax"] },
  { key: "revenue-sales", groupKey: "revenue-from-operations", label: "Sales of products", noteNumber: "19", noteTitle: noteTitleByNumber["19"], statementArea: "profit-and-loss", keywords: ["sales", "product"] },
  { key: "revenue-job-work", groupKey: "revenue-from-operations", label: "Job work income", noteNumber: "19", noteTitle: noteTitleByNumber["19"], statementArea: "profit-and-loss", keywords: ["job work"] },
  { key: "revenue-scrap", groupKey: "revenue-from-operations", label: "Scrap sales", noteNumber: "19", noteTitle: noteTitleByNumber["19"], statementArea: "profit-and-loss", keywords: ["scrap"] },
  { key: "revenue-export-incentive", groupKey: "revenue-from-operations", label: "Export incentives and duty benefits", noteNumber: "19", noteTitle: noteTitleByNumber["19"], statementArea: "profit-and-loss", keywords: ["export incentive", "duty drawback", "rodtep"] },
  { key: "revenue-other-operating", groupKey: "revenue-from-operations", label: "Other operating revenue", noteNumber: "19", noteTitle: noteTitleByNumber["19"], statementArea: "profit-and-loss", keywords: ["operating", "revenue"] },
  { key: "other-income-interest", groupKey: "other-income", label: "Interest income", noteNumber: "20", noteTitle: noteTitleByNumber["20"], statementArea: "profit-and-loss", keywords: ["interest"] },
  { key: "other-income-forex", groupKey: "other-income", label: "Foreign exchange gain", noteNumber: "20", noteTitle: noteTitleByNumber["20"], statementArea: "profit-and-loss", keywords: ["forex", "exchange"] },
  { key: "other-income-misc", groupKey: "other-income", label: "Miscellaneous income", noteNumber: "20", noteTitle: noteTitleByNumber["20"], statementArea: "profit-and-loss", keywords: ["income", "misc"] },
  { key: "materials-raw-material", groupKey: "cost-of-material-consumed", label: "Raw material consumed", noteNumber: "21", noteTitle: noteTitleByNumber["21"], statementArea: "profit-and-loss", keywords: ["raw material"] },
  { key: "materials-packing", groupKey: "cost-of-material-consumed", label: "Packing material", noteNumber: "21", noteTitle: noteTitleByNumber["21"], statementArea: "profit-and-loss", keywords: ["packing"] },
  { key: "materials-power-fuel", groupKey: "cost-of-material-consumed", label: "Power, fuel and utilities", noteNumber: "21", noteTitle: noteTitleByNumber["21"], statementArea: "profit-and-loss", keywords: ["power", "fuel", "steam", "utility"] },
  { key: "materials-job-work", groupKey: "cost-of-material-consumed", label: "Job work and processing charges", noteNumber: "21", noteTitle: noteTitleByNumber["21"], statementArea: "profit-and-loss", keywords: ["jobwork", "job work", "labour charges", "processing"] },
  { key: "materials-other", groupKey: "cost-of-material-consumed", label: "Other manufacturing consumption", noteNumber: "21", noteTitle: noteTitleByNumber["21"], statementArea: "profit-and-loss", keywords: ["material", "consumption", "cogm", "cogs"] },
  { key: "materials-change-fg-wip", groupKey: "changes-in-inventories-of-finished-goods-and-work-in-progress", label: "Changes in finished goods and work-in-progress", noteNumber: "21", noteTitle: noteTitleByNumber["21"], statementArea: "profit-and-loss", keywords: ["finished goods", "work in progress", "change in stock", "semi-finished"] },
  { key: "employee-salaries", groupKey: "employee-benefits-expense", label: "Salaries and wages", noteNumber: "22", noteTitle: noteTitleByNumber["22"], statementArea: "profit-and-loss", keywords: ["salary", "wages"] },
  { key: "employee-contributions", groupKey: "employee-benefits-expense", label: "Contribution to provident and other funds", noteNumber: "22", noteTitle: noteTitleByNumber["22"], statementArea: "profit-and-loss", keywords: ["pf", "esic", "provident", "fund"] },
  { key: "employee-bonus", groupKey: "employee-benefits-expense", label: "Bonus and incentives", noteNumber: "22", noteTitle: noteTitleByNumber["22"], statementArea: "profit-and-loss", keywords: ["bonus", "incentive"] },
  { key: "employee-staff-welfare", groupKey: "employee-benefits-expense", label: "Staff welfare", noteNumber: "22", noteTitle: noteTitleByNumber["22"], statementArea: "profit-and-loss", keywords: ["welfare", "medical", "training"] },
  { key: "employee-other", groupKey: "employee-benefits-expense", label: "Other employee benefits", noteNumber: "22", noteTitle: noteTitleByNumber["22"], statementArea: "profit-and-loss", keywords: ["employee", "staff"] },
  { key: "finance-interest", groupKey: "finance-costs", label: "Interest expense", noteNumber: "23", noteTitle: noteTitleByNumber["23"], statementArea: "profit-and-loss", keywords: ["interest"] },
  { key: "finance-bank-charges", groupKey: "finance-costs", label: "Bank charges", noteNumber: "23", noteTitle: noteTitleByNumber["23"], statementArea: "profit-and-loss", keywords: ["bank charges", "commission charges"] },
  { key: "finance-borrowing-costs", groupKey: "finance-costs", label: "Borrowing costs", noteNumber: "23", noteTitle: noteTitleByNumber["23"], statementArea: "profit-and-loss", keywords: ["cash credit", "loan", "borrowing", "buyer"] },
  { key: "finance-other", groupKey: "finance-costs", label: "Other finance costs", noteNumber: "23", noteTitle: noteTitleByNumber["23"], statementArea: "profit-and-loss", keywords: ["finance"] },
  { key: "depreciation-ppe", groupKey: "depreciation-and-amortisation-expense", label: "Depreciation on PPE", noteNumber: "24", noteTitle: noteTitleByNumber["24"], statementArea: "profit-and-loss", keywords: ["depreci"] },
  { key: "depreciation-rou", groupKey: "depreciation-and-amortisation-expense", label: "Depreciation on right-of-use assets", noteNumber: "24", noteTitle: noteTitleByNumber["24"], statementArea: "profit-and-loss", keywords: ["right of use", "rou"] },
  { key: "depreciation-amortisation", groupKey: "depreciation-and-amortisation-expense", label: "Amortisation of intangibles", noteNumber: "24", noteTitle: noteTitleByNumber["24"], statementArea: "profit-and-loss", keywords: ["amort", "software"] },
  { key: "other-expenses-rent", groupKey: "other-expenses", label: "Rent", noteNumber: "25", noteTitle: noteTitleByNumber["25"], statementArea: "profit-and-loss", keywords: ["rent"] },
  { key: "other-expenses-repairs", groupKey: "other-expenses", label: "Repairs and maintenance", noteNumber: "25", noteTitle: noteTitleByNumber["25"], statementArea: "profit-and-loss", keywords: ["repair", "maintenance"] },
  { key: "other-expenses-freight", groupKey: "other-expenses", label: "Freight and transport", noteNumber: "25", noteTitle: noteTitleByNumber["25"], statementArea: "profit-and-loss", keywords: ["freight", "transport", "carriage"] },
  { key: "other-expenses-selling", groupKey: "other-expenses", label: "Selling and distribution", noteNumber: "25", noteTitle: noteTitleByNumber["25"], statementArea: "profit-and-loss", keywords: ["selling", "distribution", "advertising"] },
  { key: "other-expenses-legal", groupKey: "other-expenses", label: "Legal and professional", noteNumber: "25", noteTitle: noteTitleByNumber["25"], statementArea: "profit-and-loss", keywords: ["legal", "professional", "consultancy", "audit"] },
  { key: "other-expenses-admin", groupKey: "other-expenses", label: "Administrative overheads", noteNumber: "25", noteTitle: noteTitleByNumber["25"], statementArea: "profit-and-loss", keywords: ["office", "admin", "travelling", "telephone"] },
  { key: "other-expenses-other", groupKey: "other-expenses", label: "Other expenses", noteNumber: "25", noteTitle: noteTitleByNumber["25"], statementArea: "profit-and-loss", keywords: ["expense"] },
  { key: "tax-current", groupKey: "current-income-tax", label: "Current tax", noteNumber: "26", noteTitle: noteTitleByNumber["26"], statementArea: "profit-and-loss", keywords: ["current tax", "income tax"] },
  { key: "tax-deferred", groupKey: "tax-expense", label: "Deferred tax expense", noteNumber: "26", noteTitle: noteTitleByNumber["26"], statementArea: "profit-and-loss", keywords: ["deferred tax"] },
  { key: "tax-prior-year", groupKey: "tax-expense", label: "Tax relating to earlier years", noteNumber: "26", noteTitle: noteTitleByNumber["26"], statementArea: "profit-and-loss", keywords: ["earlier year", "prior year"] },
  { key: "tax-other", groupKey: "tax-expense", label: "Other tax expense", noteNumber: "26", noteTitle: noteTitleByNumber["26"], statementArea: "profit-and-loss", keywords: ["tax"] },
  { key: "tax-current-expense", groupKey: "tax-expense", label: "Current tax", noteNumber: "26", noteTitle: noteTitleByNumber["26"], statementArea: "profit-and-loss", keywords: ["current tax", "income tax"] },
];

function resolveScopedWorkspace(scope?: GroupingScope) {
  const context = resolveWorkspaceContext({
    companyId: scope?.companyId,
    versionId: scope?.versionId,
  });

  return {
    companyId: scope?.companyId ?? context.company.id,
    versionId: scope?.versionId ?? context.currentVersion.id,
  };
}

function resolveGroupingStorePath(scope?: GroupingScope) {
  const resolvedScope = resolveScopedWorkspace(scope);
  return getCompanyVersionPaths(resolvedScope.companyId, resolvedScope.versionId).groupingOverridesPath;
}

function resolveMasterGroupingSourcePath(scope?: GroupingScope) {
  return getCompanyLogicPaths(resolveScopedWorkspace(scope).companyId).masterGroupingSourcePath;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function accountClassForBucket(bucket: GroupingBucket): LedgerRow["accountClass"] {
  if (bucket === "equity" || bucket === "non-current-liabilities" || bucket === "current-liabilities" || bucket === "clearing-liabilities") {
    return "equity-liability";
  }

  if (bucket === "non-current-assets" || bucket === "current-assets" || bucket === "clearing-assets") {
    return "asset";
  }

  if (bucket === "revenue-from-operations" || bucket === "other-income") {
    return "income";
  }

  if (
    bucket === "cost-of-materials" ||
    bucket === "employee-benefits" ||
    bucket === "finance-costs" ||
    bucket === "depreciation-amortisation" ||
    bucket === "other-expenses" ||
    bucket === "tax-expense"
  ) {
    return "expense";
  }

  if (bucket === "opening-balance-adjustments") {
    return "opening-balance";
  }

  return "other";
}

function loadMasterGroupingSource(scope?: GroupingScope): MasterGroupingSource {
  const masterGroupingSourcePath = resolveMasterGroupingSourcePath(scope);
  const version = fs.existsSync(masterGroupingSourcePath) ? fs.statSync(masterGroupingSourcePath).mtimeMs : 0;

  if (cachedMasterGroupingSource[masterGroupingSourcePath]?.version === version) {
    return cachedMasterGroupingSource[masterGroupingSourcePath].source;
  }

  if (version === 0) {
    return {
      options: [],
      lookup: {},
    };
  }

  const parsed = JSON.parse(fs.readFileSync(masterGroupingSourcePath, "utf8")) as {
    options?: LedgerGroupingOption[];
    lookup?: Record<string, { key: string; label: string }>;
  };

  const source = {
    options: [...(parsed.options ?? [])].sort((left, right) => left.label.localeCompare(right.label)),
    lookup: parsed.lookup ?? {},
  } satisfies MasterGroupingSource;

  cachedMasterGroupingSource[masterGroupingSourcePath] = {
    version,
    source,
  };

  return source;
}

export function getLedgerGroupingOptions(scope?: GroupingScope) {
  return loadMasterGroupingSource(scope).options;
}

export function getLedgerSubgroupOptions(scope?: GroupingScope, groupKey?: string) {
  void scope;
  return subgroupCatalog
    .filter((option) => (groupKey ? option.groupKey === groupKey : true))
    .map<LedgerSubgroupOption>((option) => {
      const { keywords, ...resolvedOption } = option;
      void keywords;
      return resolvedOption;
    });
}

export function getGroupingStorePath(scope?: GroupingScope) {
  return resolveGroupingStorePath(scope);
}

export function getMasterGroupingSourcePath(scope?: GroupingScope) {
  return resolveMasterGroupingSourcePath(scope);
}

export function getGroupingOption(groupKey: string, scope?: GroupingScope) {
  return getLedgerGroupingOptions(scope).find((option) => option.key === groupKey) ?? null;
}

export function getLedgerSubgroupOption(subgroupKey: string, groupKey?: string) {
  return (
    subgroupCatalog.find((option) => option.key === subgroupKey && (groupKey ? option.groupKey === groupKey : true)) ?? null
  );
}

function ensureGroupingStore(scope?: GroupingScope) {
  const groupingStorePath = resolveGroupingStorePath(scope);
  const directory = path.dirname(groupingStorePath);

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  if (!fs.existsSync(groupingStorePath)) {
    const initialStore: GroupingStore = {
      updatedAt: null,
      overrides: {},
    };

    fs.writeFileSync(groupingStorePath, `${JSON.stringify(initialStore, null, 2)}\n`, "utf8");
  }
}

function resolveGroupingSelection(input: {
  groupKey: string;
  label: string;
  glNumber: string;
  glDescription: string;
}): Omit<ResolvedLedgerGrouping, "subgroupKey" | "subgroupLabel" | "noteNumber" | "noteTitle"> {
  const normalizedLabel = normalizeText(input.label);
  const normalizedDescription = normalizeText(input.glDescription);
  const currentBorrowingKeywords = ["cash credit", "cc_", "ca_", "wcdl", "buyer", "interest accrued", "buyers credit"];
  const ppeKeywords = [
    "land",
    "building",
    "plant",
    "machinery",
    "office equiment",
    "office equipment",
    "computer",
    "furniture",
    "software",
    "electrical",
    "freehold",
    "leasehold",
    "capital work in progress",
    "capital advances",
    "acc_dep",
  ];

  if (normalizedLabel === "equity share capital" || normalizedLabel === "other equity") {
    return {
      key: input.groupKey,
      label: input.label,
      accountClass: "equity-liability",
      bucket: "equity",
      statementArea: "balance-sheet",
    };
  }

  if (normalizedLabel === "borrowings") {
    const isCurrentBorrowing =
      hasAny(normalizedDescription, currentBorrowingKeywords) ||
      input.glNumber.startsWith("106") ||
      input.glNumber.startsWith("208") ||
      input.glNumber === "11100000";

    return {
      key: input.groupKey,
      label: input.label,
      accountClass: "equity-liability",
      bucket: isCurrentBorrowing ? "current-liabilities" : "non-current-liabilities",
      statementArea: "balance-sheet",
    };
  }

  if (normalizedLabel === "deferred tax liabilities (net)") {
    return {
      key: input.groupKey,
      label: input.label,
      accountClass: "equity-liability",
      bucket: "non-current-liabilities",
      statementArea: "balance-sheet",
    };
  }

  if (normalizedLabel === "provisions") {
    return {
      key: input.groupKey,
      label: input.label,
      accountClass: "equity-liability",
      bucket: hasAny(normalizedDescription, ["gratuity", "leave salary"]) ? "non-current-liabilities" : "current-liabilities",
      statementArea: "balance-sheet",
    };
  }

  if (["trade payables", "other current liabilities", "other financial liabilities"].includes(normalizedLabel)) {
    return {
      key: input.groupKey,
      label: input.label,
      accountClass: "equity-liability",
      bucket: "current-liabilities",
      statementArea: "balance-sheet",
    };
  }

  if (normalizedLabel === "property, plant and equipment") {
    return {
      key: input.groupKey,
      label: input.label,
      accountClass: "asset",
      bucket: "non-current-assets",
      statementArea: "balance-sheet",
    };
  }

  if (normalizedLabel === "non current assets") {
    return {
      key: input.groupKey,
      label: input.label,
      accountClass: "asset",
      bucket: "non-current-assets",
      statementArea: "balance-sheet",
    };
  }

  if (normalizedLabel === "other financial assets") {
    const isNonCurrentFinancialAsset =
      hasAny(normalizedDescription, ["deposit", "fd_", "security", "capital advance", "investment", "finance lease"]) ||
      input.glNumber.startsWith("203") ||
      input.glNumber.startsWith("209");

    return {
      key: input.groupKey,
      label: input.label,
      accountClass: "asset",
      bucket: isNonCurrentFinancialAsset ? "non-current-assets" : "current-assets",
      statementArea: "balance-sheet",
    };
  }

  if (["other tax assets (net)", "inventories", "trade receivables", "cash & cash equivalents", "other current assets"].includes(normalizedLabel)) {
    return {
      key: input.groupKey,
      label: input.label,
      accountClass: "asset",
      bucket: "current-assets",
      statementArea: "balance-sheet",
    };
  }

  if (normalizedLabel === "revenue from operations") {
    return {
      key: input.groupKey,
      label: input.label,
      accountClass: "income",
      bucket: "revenue-from-operations",
      statementArea: "profit-and-loss",
    };
  }

  if (normalizedLabel === "other income") {
    return {
      key: input.groupKey,
      label: input.label,
      accountClass: "income",
      bucket: "other-income",
      statementArea: "profit-and-loss",
    };
  }

  if (["cost of material consumed", "changes in inventories of finished goods and work-in-progress"].includes(normalizedLabel)) {
    return {
      key: input.groupKey,
      label: input.label,
      accountClass: "expense",
      bucket: "cost-of-materials",
      statementArea: "profit-and-loss",
    };
  }

  if (normalizedLabel === "employee benefits expense") {
    return {
      key: input.groupKey,
      label: input.label,
      accountClass: "expense",
      bucket: "employee-benefits",
      statementArea: "profit-and-loss",
    };
  }

  if (normalizedLabel === "finance costs") {
    return {
      key: input.groupKey,
      label: input.label,
      accountClass: "expense",
      bucket: "finance-costs",
      statementArea: "profit-and-loss",
    };
  }

  if (normalizedLabel === "depreciation and amortisation expense") {
    return {
      key: input.groupKey,
      label: input.label,
      accountClass: "expense",
      bucket: "depreciation-amortisation",
      statementArea: "profit-and-loss",
    };
  }

  if (normalizedLabel === "other expenses") {
    return {
      key: input.groupKey,
      label: input.label,
      accountClass: "expense",
      bucket: "other-expenses",
      statementArea: "profit-and-loss",
    };
  }

  if (["current income tax", "tax expense"].includes(normalizedLabel)) {
    return {
      key: input.groupKey,
      label: input.label,
      accountClass: "expense",
      bucket: "tax-expense",
      statementArea: "profit-and-loss",
    };
  }

  if (hasAny(normalizedDescription, ppeKeywords)) {
    return {
      key: input.groupKey,
      label: input.label,
      accountClass: "asset",
      bucket: "non-current-assets",
      statementArea: "balance-sheet",
    };
  }

  return {
    key: input.groupKey,
    label: input.label,
    accountClass: "other",
    bucket: "unclassified",
    statementArea: "review",
  };
}

function resolveSubgroupSelection(input: {
  groupKey: string;
  glDescription: string;
  subgroupKey?: string;
}) {
  const candidates = subgroupCatalog.filter((option) => option.groupKey === input.groupKey);

  if (input.subgroupKey) {
    const explicit = candidates.find((option) => option.key === input.subgroupKey);

    if (explicit) {
      return explicit;
    }
  }

  const normalizedDescription = normalizeText(input.glDescription);
  const matched = candidates.find((option) => hasAny(normalizedDescription, option.keywords));

  return matched ?? candidates[0] ?? null;
}

function resolveLedgerGrouping(input: {
  groupKey: string;
  label: string;
  glNumber: string;
  glDescription: string;
  subgroupKey?: string;
}): ResolvedLedgerGrouping {
  const baseSelection = resolveGroupingSelection(input);
  const subgroup = resolveSubgroupSelection({
    groupKey: input.groupKey,
    glDescription: input.glDescription,
    subgroupKey: input.subgroupKey,
  });
  const bucket = subgroup?.bucketOverride ?? baseSelection.bucket;

  return {
    key: baseSelection.key,
    label: baseSelection.label,
    accountClass: subgroup?.bucketOverride ? accountClassForBucket(bucket) : baseSelection.accountClass,
    bucket,
    statementArea: baseSelection.statementArea,
    subgroupKey: subgroup?.key ?? "",
    subgroupLabel: subgroup?.label ?? "",
    noteNumber: subgroup?.noteNumber ?? "",
    noteTitle: subgroup?.noteTitle ?? "",
  };
}

function readGroupingStoreRaw(scope?: GroupingScope) {
  const groupingStorePath = resolveGroupingStorePath(scope);
  ensureGroupingStore(scope);
  const raw = fs.readFileSync(groupingStorePath, "utf8");

  try {
    return JSON.parse(raw) as RawGroupingStore;
  } catch {
    const fallbackStore: GroupingStore = {
      updatedAt: null,
      overrides: {},
    };

    fs.writeFileSync(groupingStorePath, `${JSON.stringify(fallbackStore, null, 2)}\n`, "utf8");
    return fallbackStore;
  }
}

export function readGroupingStore(scope?: GroupingScope) {
  const parsed = readGroupingStoreRaw(scope);
  const overrides: Record<string, LedgerGroupingOverride> = {};

  for (const [glNumber, candidate] of Object.entries(parsed.overrides ?? {})) {
    if (!candidate || typeof candidate.groupKey !== "string" || typeof candidate.glDescription !== "string") {
      continue;
    }

    const option = getGroupingOption(candidate.groupKey, scope);

    if (!option) {
      continue;
    }

    const resolved = resolveLedgerGrouping({
      groupKey: option.key,
      label: option.label,
      glNumber,
      glDescription: candidate.glDescription,
      subgroupKey: typeof candidate.subgroupKey === "string" ? candidate.subgroupKey : undefined,
    });

    overrides[glNumber] = {
      glNumber,
      glDescription: candidate.glDescription,
      groupKey: resolved.key,
      subgroupKey: resolved.subgroupKey,
      label: resolved.label,
      accountClass: resolved.accountClass,
      bucket: resolved.bucket,
      subgroupLabel: resolved.subgroupLabel,
      noteNumber: resolved.noteNumber,
      noteTitle: resolved.noteTitle,
      notes: typeof candidate.notes === "string" ? candidate.notes : "",
      updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : new Date(0).toISOString(),
    };
  }

  return {
    updatedAt: parsed.updatedAt ?? null,
    overrides,
  } satisfies GroupingStore;
}

function writeGroupingStoreScoped(store: GroupingStore, scope?: GroupingScope) {
  const groupingStorePath = resolveGroupingStorePath(scope);
  ensureGroupingStore(scope);
  fs.writeFileSync(groupingStorePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export function getLedgerGroupingOverrides(scope?: GroupingScope) {
  return readGroupingStore(scope).overrides;
}

export function getLedgerGroupingOverrideList(scope?: GroupingScope) {
  return Object.values(readGroupingStore(scope).overrides).sort((left, right) => left.glNumber.localeCompare(right.glNumber));
}

export function getMasterGroupingForLedger(glNumber: string, glDescription: string, scope?: GroupingScope) {
  const entry = loadMasterGroupingSource(scope).lookup[glNumber];

  if (!entry) {
    return null;
  }

  return resolveLedgerGrouping({
    groupKey: entry.key,
    label: entry.label,
    glNumber,
    glDescription,
  });
}

export function getSuggestedGroupingForLedger(input: {
  glNumber: string;
  glDescription: string;
  bucket: GroupingBucket;
}, scope?: GroupingScope) {
  const normalizedDescription = normalizeText(input.glDescription);
  const options = getLedgerGroupingOptions(scope);
  const optionsByKey = new Map(options.map((option) => [option.key, option]));
  const pick = (key: string) => {
    const option = optionsByKey.get(key);
    return option
      ? resolveLedgerGrouping({
          groupKey: option.key,
          label: option.label,
          glNumber: input.glNumber,
          glDescription: input.glDescription,
        })
      : null;
  };

  if (input.bucket === "equity") {
    return hasAny(normalizedDescription, ["share capital", "ccps"]) ? pick("equity-share-capital") : pick("other-equity");
  }

  if (input.bucket === "non-current-liabilities") {
    if (normalizedDescription.includes("deferred tax")) {
      return pick("deferred-tax-liabilities-net");
    }

    if (hasAny(normalizedDescription, ["gratuity", "leave salary", "provision"])) {
      return pick("provisions");
    }

    return pick("borrowings");
  }

  if (input.bucket === "current-liabilities") {
    if (hasAny(normalizedDescription, ["payable", "payables", "supplier", "creditor"])) {
      return pick("trade-payables");
    }

    if (hasAny(normalizedDescription, ["salary payable", "retention money", "bonus", "incentive", "pf", "esic", "employee"])) {
      return pick("other-financial-liabilities");
    }

    if (hasAny(normalizedDescription, ["cash credit", "cc_", "ca_", "wcdl", "buyer", "interest accrued"])) {
      return pick("borrowings");
    }

    return pick("other-current-liabilities");
  }

  if (input.bucket === "non-current-assets") {
    if (
      hasAny(normalizedDescription, [
        "land",
        "building",
        "plant",
        "machinery",
        "office equiment",
        "office equipment",
        "computer",
        "furniture",
        "software",
        "electrical",
        "freehold",
        "leasehold",
        "capital work in progress",
        "capital advances",
        "acc_dep",
      ])
    ) {
      return pick("property-plant-and-equipment");
    }

    if (hasAny(normalizedDescription, ["deposit", "security", "fd_", "investment", "finance lease"])) {
      return pick("other-financial-assets");
    }

    return pick("non-current-assets");
  }

  if (input.bucket === "current-assets") {
    if (hasAny(normalizedDescription, ["inventory", "stock", "raw material", "finished goods", "work in progress", "stores and spares", "sfg"])) {
      return pick("inventories");
    }

    if (hasAny(normalizedDescription, ["receivable", "receivables", "debtor", "git"])) {
      return pick("trade-receivables");
    }

    if (hasAny(normalizedDescription, ["cash", "bank", "ca_", "cc_"])) {
      return pick("cash-cash-equivalents");
    }

    if (hasAny(normalizedDescription, ["tds", "tcs", "gst", "tax"])) {
      return pick("other-tax-assets-net");
    }

    if (hasAny(normalizedDescription, ["advance", "prepaid"])) {
      return pick("other-current-assets");
    }

    return pick("other-current-assets");
  }

  if (input.bucket === "revenue-from-operations") {
    return pick("revenue-from-operations");
  }

  if (input.bucket === "other-income") {
    return pick("other-income");
  }

  if (input.bucket === "cost-of-materials") {
    return normalizedDescription.includes("change in stock")
      ? pick("changes-in-inventories-of-finished-goods-and-work-in-progress")
      : pick("cost-of-material-consumed");
  }

  if (input.bucket === "employee-benefits") {
    return pick("employee-benefits-expense");
  }

  if (input.bucket === "finance-costs") {
    return pick("finance-costs");
  }

  if (input.bucket === "depreciation-amortisation") {
    return pick("depreciation-and-amortisation-expense");
  }

  if (input.bucket === "other-expenses") {
    return pick("other-expenses");
  }

  if (input.bucket === "tax-expense") {
    return pick("current-income-tax") ?? pick("tax-expense");
  }

  return null;
}

export function saveLedgerGroupingOverride(input: {
  glNumber: string;
  glDescription: string;
  groupKey: string;
  subgroupKey?: string;
  notes?: string;
}, scope?: GroupingScope) {
  const option = getGroupingOption(input.groupKey, scope);

  if (!option) {
    throw new Error(`Unsupported grouping option: ${input.groupKey}`);
  }

  const resolved = resolveLedgerGrouping({
    groupKey: option.key,
    label: option.label,
    glNumber: input.glNumber,
    glDescription: input.glDescription,
    subgroupKey: input.subgroupKey,
  });

  const store = readGroupingStore(scope);
  const now = new Date().toISOString();

  store.overrides[input.glNumber] = {
    glNumber: input.glNumber,
    glDescription: input.glDescription,
    groupKey: resolved.key,
    subgroupKey: resolved.subgroupKey,
    label: resolved.label,
    accountClass: resolved.accountClass,
    bucket: resolved.bucket,
    subgroupLabel: resolved.subgroupLabel,
    noteNumber: resolved.noteNumber,
    noteTitle: resolved.noteTitle,
    notes: input.notes?.trim() ?? "",
    updatedAt: now,
  };
  store.updatedAt = now;

  writeGroupingStoreScoped(store, scope);

  return store.overrides[input.glNumber];
}

export function deleteLedgerGroupingOverride(glNumber: string, scope?: GroupingScope) {
  const store = readGroupingStore(scope);

  if (!(glNumber in store.overrides)) {
    return false;
  }

  delete store.overrides[glNumber];
  store.updatedAt = new Date().toISOString();
  writeGroupingStoreScoped(store, scope);
  return true;
}
