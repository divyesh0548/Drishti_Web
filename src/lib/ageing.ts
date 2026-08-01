import fs from "node:fs";
import { randomUUID } from "node:crypto";

import { read, utils } from "xlsx";

import { getCompanyVersionPaths, resolveWorkspaceContext } from "@/lib/company-workspace";

export type AgeingKind = "receivables" | "payables";
export type AgeingCategory = "NORMAL" | "MSME";

export type AgeingGroup = {
  id: string;
  label: string;
  minDays: number | null;
  maxDays: number | null;
};

export type AgeingEntry = {
  id: string;
  ledgerName: string;
  partyName: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  dueDate: string | null;
  amount: number;
  category: AgeingCategory;
};

export type AgeingUpload = {
  sourceName: string | null;
  uploadedAt: string | null;
  entries: AgeingEntry[];
};

export type AgeingStore = {
  updatedAt: string | null;
  asOfDate: string;
  ageGroups: AgeingGroup[];
  uploads: Record<AgeingKind, AgeingUpload>;
};

export type AgeingScope = {
  companyId?: string;
  versionId?: string;
};

export type AgeingSummaryRow = {
  partyName: string;
  ledgerName: string;
  bucketValues: Record<string, number>;
  total: number;
};

export type AgeingSummary = {
  rows: AgeingSummaryRow[];
  totals: Record<string, number>;
  grandTotal: number;
};

function defaultAgeingStore(): AgeingStore {
  return {
    updatedAt: null,
    asOfDate: "2026-03-31",
    ageGroups: [
      { id: "not-due", label: "Not Due", minDays: null, maxDays: -1 },
      { id: "0-180", label: "0-180 days", minDays: 0, maxDays: 180 },
      { id: "181-365", label: "181-365 days", minDays: 181, maxDays: 365 },
      { id: "366-730", label: "366-730 days", minDays: 366, maxDays: 730 },
      { id: "731-plus", label: "More than 730 days", minDays: 731, maxDays: null },
    ],
    uploads: {
      receivables: {
        sourceName: null,
        uploadedAt: null,
        entries: [],
      },
      payables: {
        sourceName: null,
        uploadedAt: null,
        entries: [],
      },
    },
  };
}

function resolveScope(scope?: AgeingScope) {
  if (scope?.companyId && scope?.versionId) {
    return scope;
  }

  const context = resolveWorkspaceContext();
  return {
    companyId: scope?.companyId ?? context.company.id,
    versionId: scope?.versionId ?? context.currentVersion.id,
  };
}

function getAgeingPath(scope?: AgeingScope) {
  const resolvedScope = resolveScope(scope);
  return getCompanyVersionPaths(resolvedScope.companyId!, resolvedScope.versionId!).ageingConfigPath;
}

function ensureStore(scope?: AgeingScope) {
  const filePath = getAgeingPath(scope);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `${JSON.stringify(defaultAgeingStore(), null, 2)}\n`, "utf8");
  }
}

function parseNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    return normalized ? Number(normalized) : 0;
  }

  return 0;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function excelSerialToIso(value: number) {
  const utcDays = Math.floor(value - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  return `${dateInfo.getUTCFullYear()}-${pad(dateInfo.getUTCMonth() + 1)}-${pad(dateInfo.getUTCDate())}`;
}

function parseDateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  }

  if (typeof value === "number") {
    return excelSerialToIso(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    const timestamp = Date.parse(trimmed);

    if (!Number.isNaN(timestamp)) {
      const date = new Date(timestamp);
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }
  }

  return null;
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function findValue(row: Record<string, unknown>, aliases: string[]) {
  const normalizedAliases = new Set(aliases.map(normalizeKey));

  for (const [key, value] of Object.entries(row)) {
    if (normalizedAliases.has(normalizeKey(key))) {
      return value;
    }
  }

  return undefined;
}

function normalizeCategory(value: unknown): AgeingCategory {
  if (typeof value === "boolean") {
    return value ? "MSME" : "NORMAL";
  }

  if (typeof value === "number") {
    return value === 1 ? "MSME" : "NORMAL";
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["msme", "yes", "y", "true", "1", "micro", "small"].includes(normalized)) {
      return "MSME";
    }
  }

  return "NORMAL";
}

function parseSheetRows(buffer: Buffer) {
  const workbook = read(buffer, { type: "buffer", cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];

  if (!firstSheet) {
    return [];
  }

  return utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    raw: true,
    defval: "",
  });
}

export function readAgeingStore(scope?: AgeingScope) {
  const filePath = getAgeingPath(scope);
  ensureStore(scope);

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<AgeingStore>;
    const defaults = defaultAgeingStore();

    return {
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      asOfDate: typeof parsed.asOfDate === "string" ? parsed.asOfDate : defaults.asOfDate,
      ageGroups: Array.isArray(parsed.ageGroups) && parsed.ageGroups.length > 0
        ? parsed.ageGroups.map((group) => ({
            id: typeof group.id === "string" && group.id.trim() ? group.id : randomUUID(),
            label: typeof group.label === "string" && group.label.trim() ? group.label : "Age bucket",
            minDays: typeof group.minDays === "number" ? group.minDays : null,
            maxDays: typeof group.maxDays === "number" ? group.maxDays : null,
          }))
        : defaults.ageGroups,
      uploads: {
        receivables: {
          sourceName: parsed.uploads?.receivables?.sourceName ?? null,
          uploadedAt: parsed.uploads?.receivables?.uploadedAt ?? null,
          entries: Array.isArray(parsed.uploads?.receivables?.entries) ? parsed.uploads!.receivables!.entries : [],
        },
        payables: {
          sourceName: parsed.uploads?.payables?.sourceName ?? null,
          uploadedAt: parsed.uploads?.payables?.uploadedAt ?? null,
          entries: Array.isArray(parsed.uploads?.payables?.entries) ? parsed.uploads!.payables!.entries : [],
        },
      },
    } satisfies AgeingStore;
  } catch {
    const fallback = defaultAgeingStore();
    fs.writeFileSync(filePath, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
    return fallback;
  }
}

function writeAgeingStore(store: AgeingStore, scope?: AgeingScope) {
  fs.writeFileSync(getAgeingPath(scope), `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

export function saveAgeingGroups(
  input: {
    asOfDate: string;
    ageGroups: AgeingGroup[];
  },
  scope?: AgeingScope,
) {
  const store = readAgeingStore(scope);
  const now = new Date().toISOString();

  store.asOfDate = input.asOfDate;
  store.ageGroups = input.ageGroups.map((group) => ({
    id: group.id || randomUUID(),
    label: group.label.trim() || "Age bucket",
    minDays: typeof group.minDays === "number" ? group.minDays : null,
    maxDays: typeof group.maxDays === "number" ? group.maxDays : null,
  }));
  store.updatedAt = now;
  writeAgeingStore(store, scope);
  return store;
}

export async function saveAgeingUpload(
  input: {
    kind: AgeingKind;
    file: File;
  },
  scope?: AgeingScope,
) {
  const store = readAgeingStore(scope);
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const rows = parseSheetRows(buffer);
  const entries = rows
    .map<AgeingEntry | null>((row) => {
      const partyName = String(
        findValue(row, ["party name", "customer name", "vendor name", "party", "customer", "vendor", "name", "ledger name"]) ?? "",
      ).trim();
      const ledgerName = String(findValue(row, ["ledger", "ledger name", "account name", "party ledger"]) ?? partyName).trim();
      const amount = parseNumber(
        findValue(row, ["outstanding amount", "outstanding", "amount", "balance", "closing balance", "net amount"]),
      );

      if (!partyName || Math.abs(amount) < 0.000001) {
        return null;
      }

      return {
        id: randomUUID(),
        ledgerName: ledgerName || partyName,
        partyName,
        invoiceNumber: String(findValue(row, ["invoice number", "invoice no", "bill no", "document number", "doc no", "voucher number"]) ?? "").trim(),
        invoiceDate: parseDateValue(findValue(row, ["invoice date", "bill date", "document date", "date"])),
        dueDate: parseDateValue(findValue(row, ["due date", "expected due date"])),
        amount,
        category: normalizeCategory(findValue(row, ["category", "type", "vendor type", "customer type", "msme", "is msme", "classification"])),
      };
    })
    .filter((entry): entry is AgeingEntry => entry !== null);

  const now = new Date().toISOString();
  store.uploads[input.kind] = {
    sourceName: input.file.name,
    uploadedAt: now,
    entries,
  };
  store.updatedAt = now;
  writeAgeingStore(store, scope);
  return store.uploads[input.kind];
}

function getDaysDifference(asOfDate: string, baseDate: string | null) {
  if (!baseDate) {
    return 0;
  }

  const asOf = new Date(`${asOfDate}T00:00:00Z`);
  const base = new Date(`${baseDate}T00:00:00Z`);
  return Math.round((asOf.getTime() - base.getTime()) / 86400000);
}

function getBucketForAge(ageGroups: AgeingGroup[], ageDays: number) {
  return (
    ageGroups.find((group) => {
      const meetsMin = group.minDays === null || ageDays >= group.minDays;
      const meetsMax = group.maxDays === null || ageDays <= group.maxDays;
      return meetsMin && meetsMax;
    }) ?? ageGroups[ageGroups.length - 1]
  );
}

function buildSummary(entries: AgeingEntry[], ageGroups: AgeingGroup[], asOfDate: string): AgeingSummary {
  const byParty = new Map<string, AgeingSummaryRow>();
  const totals = Object.fromEntries(ageGroups.map((group) => [group.id, 0]));

  for (const entry of entries) {
    const ageDays = getDaysDifference(asOfDate, entry.dueDate ?? entry.invoiceDate);
    const bucket = getBucketForAge(ageGroups, ageDays);
    const rowKey = `${entry.partyName}::${entry.ledgerName}`;
    const row =
      byParty.get(rowKey) ??
      {
        partyName: entry.partyName,
        ledgerName: entry.ledgerName,
        bucketValues: Object.fromEntries(ageGroups.map((group) => [group.id, 0])),
        total: 0,
      };

    row.bucketValues[bucket.id] += entry.amount;
    row.total += entry.amount;
    totals[bucket.id] += entry.amount;
    byParty.set(rowKey, row);
  }

  const rows = [...byParty.values()].sort((left, right) => Math.abs(right.total) - Math.abs(left.total));
  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);

  return {
    rows,
    totals,
    grandTotal,
  };
}

export function getAgeingWorkspace(scope?: AgeingScope) {
  const store = readAgeingStore(scope);

  return {
    store,
    receivables: {
      normal: buildSummary(
        store.uploads.receivables.entries.filter((entry) => entry.category === "NORMAL"),
        store.ageGroups,
        store.asOfDate,
      ),
      msme: buildSummary(
        store.uploads.receivables.entries.filter((entry) => entry.category === "MSME"),
        store.ageGroups,
        store.asOfDate,
      ),
    },
    payables: {
      normal: buildSummary(
        store.uploads.payables.entries.filter((entry) => entry.category === "NORMAL"),
        store.ageGroups,
        store.asOfDate,
      ),
      msme: buildSummary(
        store.uploads.payables.entries.filter((entry) => entry.category === "MSME"),
        store.ageGroups,
        store.asOfDate,
      ),
    },
  };
}
