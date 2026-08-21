import fs from "node:fs";
import path from "node:path";

import { read, utils } from "xlsx";

import type { GroupingScope, LedgerGroupingOption, LedgerGroupingOverride } from "@/lib/ledger-groupings";
import { prisma } from "@/lib/prisma";
import { findStatementVersionRecord } from "@/lib/trial-balance-database";

type MasterGroupingSource = {
  options: LedgerGroupingOption[];
  lookup: Record<string, { key: string; label: string }>;
  stamp: string;
};

type ParsedMasterGroupingRow = {
  glNumber: string;
  label: string;
};

export type MasterGroupingUploadResult = {
  rowCount: number;
  groupsCreated: number;
  groupsUpdated: number;
  ledgersCreated: number;
  ledgersUpdated: number;
};

export type MasterGroupingColumnMapping = {
  glCodeColumn: string;
  glGroupColumn: string;
};

export type MasterGroupingColumnPreview = {
  columns: string[];
  suggestedGlCodeColumn: string | null;
  suggestedGlGroupColumn: string | null;
};

const GL_CODE_COLUMN_PATTERNS = [
  /^code$/i,
  /^gl\s*code$/i,
  /^gl\s*number$/i,
  /^gl\s*no\.?$/i,
  /^account\s*code$/i,
  /^ledger\s*code$/i,
];

const GL_GROUP_COLUMN_PATTERNS = [
  /^indas\s*head$/i,
  /^ind\s*as\s*head$/i,
  /^group(?:ing)?$/i,
  /^group\s*name$/i,
  /^label$/i,
  /^head$/i,
  /^ind\s*as\s*group$/i,
];

const statementAreaCatalogPath = path.join(process.cwd(), "data", "master-groupings.json");

const cachedMasterGroupingByCompany = new Map<number, MasterGroupingSource>();

function asStatementArea(value: string | undefined): LedgerGroupingOption["statementArea"] {
  if (value === "profit-and-loss" || value === "review") {
    return value;
  }

  return "balance-sheet";
}

function toGroupKey(label: string) {
  return label
    .toLowerCase()
    .replace(/&/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clearMasterGroupingCache(companyId?: number) {
  if (typeof companyId === "number") {
    cachedMasterGroupingByCompany.delete(companyId);
    return;
  }

  cachedMasterGroupingByCompany.clear();
}

function loadStatementAreaByLabel() {
  const byLabel = new Map<string, LedgerGroupingOption["statementArea"]>();

  if (!fs.existsSync(statementAreaCatalogPath)) {
    return byLabel;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(statementAreaCatalogPath, "utf8")) as {
      options?: Array<{ key?: string; label?: string; statementArea?: string }>;
    };

    for (const option of parsed.options ?? []) {
      const label = option.label?.trim();
      if (!label) {
        continue;
      }

      byLabel.set(label.toLowerCase(), asStatementArea(option.statementArea));
      if (option.key?.trim()) {
        byLabel.set(option.key.trim().toLowerCase(), asStatementArea(option.statementArea));
      }
    }
  } catch {
    return byLabel;
  }

  return byLabel;
}

function readMasterGroupingSheetRows(buffer: Buffer) {
  const workbook = read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("The master grouping workbook has no sheets.");
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });

  return { sheet, rows };
}

function matchColumn(columns: string[], patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = columns.find((column) => pattern.test(column.trim()));
    if (match) {
      return match;
    }
  }

  return null;
}

export function getMasterGroupingWorkbookColumns(buffer: Buffer): string[] {
  const { sheet, rows } = readMasterGroupingSheetRows(buffer);

  if (rows.length > 0) {
    return Object.keys(rows[0]!);
  }

  const range = sheet["!ref"];
  if (!range) {
    return [];
  }

  const decoded = utils.decode_range(range);
  const headers: string[] = [];

  for (let columnIndex = decoded.s.c; columnIndex <= decoded.e.c; columnIndex += 1) {
    const cellAddress = utils.encode_cell({ r: decoded.s.r, c: columnIndex });
    const cell = sheet[cellAddress];
    const header = String(cell?.v ?? "").trim();
    if (header) {
      headers.push(header);
    }
  }

  return headers;
}

export function suggestMasterGroupingColumns(columns: string[]) {
  const trimmed = columns.filter((column) => column.trim() !== "");
  const suggestedGlCodeColumn =
    matchColumn(trimmed, GL_CODE_COLUMN_PATTERNS) ??
    matchColumn(trimmed, [/code/i, /gl/i]) ??
    trimmed[0] ??
    null;
  const suggestedGlGroupColumn =
    matchColumn(trimmed, GL_GROUP_COLUMN_PATTERNS) ??
    matchColumn(trimmed, [/head/i, /group/i, /label/i]) ??
    trimmed.find((column) => column !== suggestedGlCodeColumn) ??
    null;

  return {
    suggestedGlCodeColumn,
    suggestedGlGroupColumn,
  };
}

export function previewMasterGroupingWorkbookColumns(buffer: Buffer): MasterGroupingColumnPreview {
  const columns = getMasterGroupingWorkbookColumns(buffer);

  if (columns.length === 0) {
    throw new Error("No column headers found in the first sheet of the workbook.");
  }

  return {
    columns,
    ...suggestMasterGroupingColumns(columns),
  };
}

function resolveMasterGroupingColumnMapping(
  mapping: MasterGroupingColumnMapping | undefined,
  availableColumns: string[],
): MasterGroupingColumnMapping | undefined {
  if (!mapping) {
    return undefined;
  }

  const glCodeColumn = mapping.glCodeColumn.trim();
  const glGroupColumn = mapping.glGroupColumn.trim();

  if (!glCodeColumn || !glGroupColumn) {
    throw new Error("GL code and GL grouping columns are required.");
  }

  if (!availableColumns.includes(glCodeColumn)) {
    throw new Error(`Column "${glCodeColumn}" was not found in the workbook.`);
  }

  if (!availableColumns.includes(glGroupColumn)) {
    throw new Error(`Column "${glGroupColumn}" was not found in the workbook.`);
  }

  if (glCodeColumn === glGroupColumn) {
    throw new Error("GL code and GL grouping must use different columns.");
  }

  return { glCodeColumn, glGroupColumn };
}

export function parseMasterGroupingWorkbook(
  buffer: Buffer,
  mapping?: MasterGroupingColumnMapping,
): ParsedMasterGroupingRow[] {
  const { rows } = readMasterGroupingSheetRows(buffer);
  const availableColumns = rows.length > 0 ? Object.keys(rows[0]!) : getMasterGroupingWorkbookColumns(buffer);
  const resolvedMapping = resolveMasterGroupingColumnMapping(mapping, availableColumns);

  const parsed = rows.flatMap((row) => {
    const codeValue = resolvedMapping
      ? row[resolvedMapping.glCodeColumn]
      : row.Code ?? row.code ?? row["GL Number"] ?? row["GL Code"];
    const labelValue = resolvedMapping
      ? row[resolvedMapping.glGroupColumn]
      : row["INDAS Head"] ?? row["Ind AS Head"] ?? row["IND AS Head"] ?? row.Label ?? row.label;
    const glNumber = String(codeValue ?? "").trim();
    const label = String(labelValue ?? "").trim();

    if (!glNumber || !label) {
      return [];
    }

    return [{ glNumber, label }];
  });

  if (parsed.length === 0) {
    throw new Error(
      resolvedMapping
        ? `No usable rows found for columns "${resolvedMapping.glCodeColumn}" and "${resolvedMapping.glGroupColumn}".`
        : 'No usable rows found. Expected columns "Code" and "INDAS Head", or select columns during upload.',
    );
  }

  return parsed;
}

export async function upsertMasterGroupingFromWorkbook(
  companyId: number,
  buffer: Buffer,
  mapping?: MasterGroupingColumnMapping,
): Promise<MasterGroupingUploadResult> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });

  if (!company) {
    throw new Error("Company not found.");
  }

  const rows = parseMasterGroupingWorkbook(buffer, mapping);
  const statementAreaByLabel = loadStatementAreaByLabel();
  const groupsByKey = new Map<string, { groupKey: string; label: string; statementArea: LedgerGroupingOption["statementArea"] }>();
  const ledgersByGl = new Map<string, string>();

  for (const row of rows) {
    const groupKey = toGroupKey(row.label);
    if (!groupKey) {
      continue;
    }

    groupsByKey.set(groupKey, {
      groupKey,
      label: row.label,
      statementArea: statementAreaByLabel.get(row.label.toLowerCase()) ?? statementAreaByLabel.get(groupKey) ?? "balance-sheet",
    });
    ledgersByGl.set(row.glNumber, groupKey);
  }

  const groupValues = [...groupsByKey.values()];
  const ledgerValues = [...ledgersByGl.entries()].map(([glNumber, groupKey]) => ({ glNumber, groupKey }));

  const [existingGroups, existingLedgers] = await Promise.all([
    prisma.masterGrouping.findMany({
      where: {
        companyId,
        groupKey: { in: groupValues.map((group) => group.groupKey) },
      },
      select: { groupKey: true },
    }),
    prisma.masterGroupingLedger.findMany({
      where: {
        companyId,
        glNumber: { in: ledgerValues.map((ledger) => ledger.glNumber) },
      },
      select: { glNumber: true },
    }),
  ]);

  const existingGroupKeys = new Set(existingGroups.map((group) => group.groupKey));
  const existingGlNumbers = new Set(existingLedgers.map((ledger) => ledger.glNumber));

  const groupsToCreate = groupValues.filter((group) => !existingGroupKeys.has(group.groupKey));
  const groupsToUpdate = groupValues.filter((group) => existingGroupKeys.has(group.groupKey));
  const ledgersToCreate = ledgerValues.filter((ledger) => !existingGlNumbers.has(ledger.glNumber));
  const ledgersToUpdate = ledgerValues.filter((ledger) => existingGlNumbers.has(ledger.glNumber));

  await prisma.$transaction(
    async (tx) => {
      if (groupsToCreate.length > 0) {
        await tx.masterGrouping.createMany({
          data: groupsToCreate.map((group) => ({
            companyId,
            groupKey: group.groupKey,
            label: group.label,
            statementArea: group.statementArea,
          })),
        });
      }

      for (const chunk of chunkItems(groupsToUpdate, 40)) {
        await Promise.all(
          chunk.map((group) =>
            tx.masterGrouping.update({
              where: {
                companyId_groupKey: {
                  companyId,
                  groupKey: group.groupKey,
                },
              },
              data: {
                label: group.label,
                statementArea: group.statementArea,
              },
            }),
          ),
        );
      }

      if (ledgersToCreate.length > 0) {
        await tx.masterGroupingLedger.createMany({
          data: ledgersToCreate.map((ledger) => ({
            companyId,
            glNumber: ledger.glNumber,
            groupKey: ledger.groupKey,
          })),
        });
      }

      for (const chunk of chunkItems(ledgersToUpdate, 40)) {
        await Promise.all(
          chunk.map((ledger) =>
            tx.masterGroupingLedger.update({
              where: {
                companyId_glNumber: {
                  companyId,
                  glNumber: ledger.glNumber,
                },
              },
              data: { groupKey: ledger.groupKey },
            }),
          ),
        );
      }
    },
    {
      maxWait: 15_000,
      timeout: 120_000,
    },
  );

  clearMasterGroupingCache(companyId);

  return {
    rowCount: rows.length,
    groupsCreated: groupsToCreate.length,
    groupsUpdated: groupsToUpdate.length,
    ledgersCreated: ledgersToCreate.length,
    ledgersUpdated: ledgersToUpdate.length,
  };
}

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function companyHasMasterGrouping(companyId: number) {
  const count = await prisma.masterGroupingLedger.count({
    where: { companyId },
  });

  return count > 0;
}

export const MASTER_GROUPING_REQUIRED_ERROR =
  "Upload a master grouping file for this company before continuing.";

export async function assertCompanyHasMasterGrouping(companyId: number) {
  if (!(await companyHasMasterGrouping(companyId))) {
    throw new Error(MASTER_GROUPING_REQUIRED_ERROR);
  }
}

export async function loadMasterGroupingSourceFromDb(companyId: number): Promise<MasterGroupingSource> {
  const cached = cachedMasterGroupingByCompany.get(companyId);
  if (cached) {
    return cached;
  }

  const groups = await prisma.masterGrouping.findMany({
    where: { companyId },
    include: {
      ledgers: {
        orderBy: { glNumber: "asc" },
      },
    },
    orderBy: { label: "asc" },
  });

  const options = groups.map((group) => ({
    key: group.groupKey,
    label: group.label,
    statementArea: asStatementArea(group.statementArea),
  }));

  const lookup: Record<string, { key: string; label: string }> = {};
  for (const group of groups) {
    for (const ledger of group.ledgers) {
      lookup[ledger.glNumber] = {
        key: group.groupKey,
        label: group.label,
      };
    }
  }

  const source: MasterGroupingSource = {
    options,
    lookup,
    stamp: `${companyId}:${groups.length}:${Object.keys(lookup).length}:${groups.map((group) => group.updatedAt.toISOString()).join(",")}`,
  };

  cachedMasterGroupingByCompany.set(companyId, source);
  return source;
}

function mapOverrideRow(row: {
  glNumber: string;
  glDescription: string;
  groupKey: string;
  subgroupKey: string;
  accountClass: string;
  bucket: string;
  label: string;
  subgroupLabel: string;
  noteNumber: string;
  noteTitle: string;
  notes: string;
  updatedAt: Date;
}): LedgerGroupingOverride {
  return {
    glNumber: row.glNumber,
    glDescription: row.glDescription,
    groupKey: row.groupKey,
    subgroupKey: row.subgroupKey,
    accountClass: row.accountClass as LedgerGroupingOverride["accountClass"],
    bucket: row.bucket as LedgerGroupingOverride["bucket"],
    label: row.label,
    subgroupLabel: row.subgroupLabel,
    noteNumber: row.noteNumber,
    noteTitle: row.noteTitle,
    notes: row.notes,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function loadLedgerGroupingOverridesFromDb(scope: Required<GroupingScope>) {
  const version = await findStatementVersionRecord(scope.companyId, scope.versionId);
  if (!version) {
    return {} as Record<string, LedgerGroupingOverride>;
  }

  const rows = await prisma.ledgerGroupingOverride.findMany({
    where: { versionId: version.id },
    orderBy: { glNumber: "asc" },
  });

  return Object.fromEntries(rows.map((row) => [row.glNumber, mapOverrideRow(row)]));
}

export async function saveLedgerGroupingOverrideToDb(
  scope: Required<GroupingScope>,
  override: LedgerGroupingOverride,
) {
  const version = await findStatementVersionRecord(scope.companyId, scope.versionId);
  if (!version) {
    throw new Error("This company version is not stored in the database. Re-upload the trial balance first.");
  }

  const saved = await prisma.ledgerGroupingOverride.upsert({
    where: {
      versionId_glNumber: {
        versionId: version.id,
        glNumber: override.glNumber,
      },
    },
    create: {
      versionId: version.id,
      glNumber: override.glNumber,
      glDescription: override.glDescription,
      groupKey: override.groupKey,
      subgroupKey: override.subgroupKey,
      accountClass: override.accountClass,
      bucket: override.bucket,
      label: override.label,
      subgroupLabel: override.subgroupLabel,
      noteNumber: override.noteNumber,
      noteTitle: override.noteTitle,
      notes: override.notes,
    },
    update: {
      glDescription: override.glDescription,
      groupKey: override.groupKey,
      subgroupKey: override.subgroupKey,
      accountClass: override.accountClass,
      bucket: override.bucket,
      label: override.label,
      subgroupLabel: override.subgroupLabel,
      noteNumber: override.noteNumber,
      noteTitle: override.noteTitle,
      notes: override.notes,
    },
  });

  return mapOverrideRow(saved);
}

export async function deleteLedgerGroupingOverrideFromDb(scope: Required<GroupingScope>, glNumber: string) {
  const version = await findStatementVersionRecord(scope.companyId, scope.versionId);
  if (!version) {
    return false;
  }

  const result = await prisma.ledgerGroupingOverride.deleteMany({
    where: {
      versionId: version.id,
      glNumber,
    },
  });

  return result.count > 0;
}
