import { prisma } from "@/lib/prisma";
import type { TrialBalanceSourceData, TrialBalanceSourceRow } from "@/lib/company-workspace";

export function parseFileVersionNumber(versionId: string) {
  const match = /^v(\d+)$/i.exec(versionId.trim());
  if (!match) {
    return null;
  }

  const versionNumber = Number(match[1]);
  return Number.isInteger(versionNumber) && versionNumber > 0 ? versionNumber : null;
}

function parseAmount(value: string | number | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(2);
  }

  const cleaned = String(value ?? "")
    .replace(/,/g, "")
    .replace(/[()]/g, "")
    .trim();

  if (!cleaned) {
    return "0.00";
  }

  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) {
    return "0.00";
  }

  const isNegative = String(value ?? "").includes("(") && String(value ?? "").includes(")");
  return (isNegative ? -Math.abs(parsed) : parsed).toFixed(2);
}

function mapLedgerRow(row: TrialBalanceSourceRow, lineNo: number) {
  return {
    lineNo,
    financialStatementItem: String(row["Financial Statement Item"] ?? "").trim(),
    glNumber: String(row["GL Number"] ?? "").trim(),
    glDescription: String(row["GL Description"] ?? "").trim(),
    currentYear: parseAmount(row["Current Year"]),
    previousYear: parseAmount(row["Previous Year"]),
  };
}

export async function persistTrialBalanceVersionToDb(input: {
  companyId: number;
  versionNumber: number;
  label: string;
  financialYear: string;
  createdByUserId?: string;
  trialBalanceFileName: string;
  trialBalanceFileKey: string;
  sourceData: TrialBalanceSourceData;
}) {
  const createdByUserId = input.createdByUserId?.trim() || null;
  const createdBy =
    createdByUserId
      ? await prisma.user.findUnique({
          where: { id: createdByUserId },
          select: { id: true },
        })
      : null;

  const ledgers = input.sourceData.rows.map((row, index) => mapLedgerRow(row, index + 1));

  try {
    await prisma.$transaction(async (tx) => {
    const existing = await tx.statementVersion.findUnique({
      where: {
        companyId_versionNumber: {
          companyId: input.companyId,
          versionNumber: input.versionNumber,
        },
      },
      select: { id: true },
    });

    const version = existing
      ? await tx.statementVersion.update({
          where: { id: existing.id },
          data: {
            label: input.label,
            financialYear: input.financialYear,
            trialBalanceFileName: input.trialBalanceFileName,
            trialBalanceFileKey: input.trialBalanceFileKey,
            createdByUserId: createdBy?.id ?? null,
          },
        })
      : await tx.statementVersion.create({
          data: {
            companyId: input.companyId,
            versionNumber: input.versionNumber,
            label: input.label,
            financialYear: input.financialYear,
            status: "DRAFT",
            createdByUserId: createdBy?.id ?? null,
            trialBalanceFileName: input.trialBalanceFileName,
            trialBalanceFileKey: input.trialBalanceFileKey,
          },
        });

    await tx.trialBalanceLedger.deleteMany({
      where: { versionId: version.id },
    });

    if (ledgers.length === 0) {
      return;
    }

    await tx.trialBalanceLedger.createMany({
      data: ledgers.map((ledger) => ({
        versionId: version.id,
        ...ledger,
      })),
    });
  });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown database error.";
    throw new Error(`Failed to save trial balance to the database: ${detail}`);
  }
}

export async function findStatementVersionRecord(companyId: number, versionId: string) {
  const versionNumber = parseFileVersionNumber(versionId);

  if (versionNumber != null) {
    return prisma.statementVersion.findUnique({
      where: {
        companyId_versionNumber: {
          companyId,
          versionNumber,
        },
      },
    });
  }

  return prisma.statementVersion.findUnique({
    where: { id: versionId },
  });
}

export async function loadTrialBalanceSourceFromDb(companyId: number, versionId: string): Promise<TrialBalanceSourceData | null> {
  const versionNumber = parseFileVersionNumber(versionId);
  const version =
    versionNumber != null
      ? await prisma.statementVersion.findUnique({
          where: {
            companyId_versionNumber: {
              companyId,
              versionNumber,
            },
          },
          include: {
            ledgers: {
              orderBy: { lineNo: "asc" },
            },
          },
        })
      : await prisma.statementVersion.findUnique({
          where: { id: versionId },
          include: {
            ledgers: {
              orderBy: { lineNo: "asc" },
            },
          },
        });

  if (!version) {
    return null;
  }

  return {
    sourceName: version.trialBalanceFileName ?? "Trial Balance.xlsx",
    sourcePath: version.trialBalanceFileKey ?? "",
    lastModifiedIso: version.createdAt.toISOString(),
    rows: version.ledgers.map((ledger) => ({
      "Financial Statement Item": ledger.financialStatementItem,
      "GL Number": ledger.glNumber,
      "GL Description": ledger.glDescription,
      "Current Year": Number(ledger.currentYear),
      "Previous Year": Number(ledger.previousYear),
    })),
  };
}
