import fs from "node:fs";
import type { Company } from "@prisma/client";
import { parseCompanyId } from "@/lib/company-id";
import { isRegisteredExcelProfileId } from "@/lib/export/excel/profile-options";
import { prisma } from "@/lib/prisma";
import { persistTrialBalanceVersionToDb, findStatementVersionRecord } from "@/lib/trial-balance-database";
import { assertCompanyHasMasterGrouping } from "@/lib/grouping-database";
import {
  changeWorkspaceUserPassword,
  createWorkspaceUser,
  createWorkspaceUserWithEmailedTempPassword,
  findWorkspaceUserRecordByEmail,
  getWorkspaceUserRecordById,
  getWorkspaceUserWithSecretByEmail,
  listAllWorkspaceUsers,
  listWorkspaceSiteUsers,
  listWorkspaceUsersByCompany,
  updateWorkspaceUserPasswordById,
  verifyPassword,
  type StoredWorkspaceUserRecord,
} from "@/lib/user-database";
import path from "node:path";

import { read, utils, writeFile } from "xlsx";

export type WorkspaceUserRole = "SITE_ADMIN" | "COMPANY_ADMIN" | "FINANCE" | "AUDITOR";

export type WorkspaceUser = {
  id: string;
  name: string;
  email: string;
  role: WorkspaceUserRole;
  companyId?: number;
  isActive: boolean;
  tempLogin: boolean;
  createdAt: string;
};

export type CompanyRecord = {
  id: number;
  slug: string;
  name: string;
  code: string;
  defaultVersionId: string;
  /** One Excel structural profile id, or empty for shared V-8. */
  excelProfileId?: string;
  createdAt: string;
  updatedAt: string;
};

export type CompanySignatory = {
  name: string;
  designation: string;
  firmName?: string;
  membershipNumber?: string;
};

export type CompanySettings = {
  reportingCurrency: string;
  unitsLabel: string;
  directors: CompanySignatory[];
  auditors: CompanySignatory[];
  footerNote: string;
  /** Optional Excel layout profile id. When unset/unknown, the shared V-8 fallback is used. PDF always stays common. */
  excelProfileId?: string;
};

export type StatementVersionRecord = {
  id: string;
  label: string;
  financialYear: string;
  versionNumber: number;
  createdAt: string;
  createdByUserId: string;
  trialBalanceWorkbookName: string;
  trialBalanceWorkbookPath: string;
  trialBalanceSourcePath: string;
  statementWorkbookName: string;
  statementWorkbookPath: string;
  versionDetailsPath?: string;
  groupingOverridesPath: string;
  exportedPdfPath: string;
  status: "draft" | "issued";
};

export type VersionDetailsRecord = {
  versionId: string;
  companyId: number;
  label: string;
  financialYear: string;
  versionNumber: number;
  createdAt: string;
  createdByUserId: string;
  uploads: {
    trialBalance: {
      originalFileName: string;
      storedFileName: string;
      workbookPath: string;
      sourceJsonPath: string;
      uploadedAt: string;
    };
    statementWorkbook: {
      originalFileName: string;
      storedFileName: string;
      workbookPath: string;
      uploadedAt: string;
    };
  };
};

export type TrialBalanceSourceRow = Record<string, string | number>;

export type TrialBalanceSourceData = {
  sourceName: string;
  sourcePath: string;
  lastModifiedIso: string;
  rows: TrialBalanceSourceRow[];
};

export type WorkspaceContext = {
  companies: CompanyRecord[];
  company: CompanyRecord | null;
  companyUsers: WorkspaceUser[];
  selectableUsers: WorkspaceUser[];
  currentUser: WorkspaceUser;
  versions: StatementVersionRecord[];
  currentVersion: StatementVersionRecord | null;
  settings: CompanySettings;
  permissions: {
    canManageCompanies: boolean;
    canManageCompanyUsers: boolean;
    canUploadTrialBalance: boolean;
    canManageGrouping: boolean;
    canManageConsolidation: boolean;
    canDownloadStatements: boolean;
    canEditSignatories: boolean;
  };
};

export type ActiveWorkspaceContext = WorkspaceContext & {
  company: CompanyRecord;
  currentVersion: StatementVersionRecord;
};

export type CompanyWorkspaceContext = WorkspaceContext & {
  company: CompanyRecord;
};

const workspaceRoot = path.join(process.cwd(), "data", "companies");
const defaultStatementWorkbookPath = path.join(process.cwd(), "V-8.xlsx");
const defaultGroupingWorkbookPath = path.join(process.cwd(), "Master Grouping File.xlsx");
const rolePasswordDefaults: Record<WorkspaceUserRole, string> = {
  SITE_ADMIN: "Admin@123",
  COMPANY_ADMIN: "Admin@123",
  FINANCE: "Finance@123",
  AUDITOR: "Audit@123",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function ensureDirectory(directoryPath: string) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function toWorkspaceUser(user: StoredWorkspaceUserRecord): WorkspaceUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    isActive: user.isActive,
    tempLogin: user.tempLogin,
    createdAt: user.createdAt,
  };
}

function writeJsonFile(filePath: string, data: unknown) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function copyFileIfMissing(sourcePath: string, targetPath: string) {
  ensureDirectory(path.dirname(targetPath));
  if (!fs.existsSync(targetPath)) {
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function buildEmptyTrialBalanceSourceData(sourcePathLabel: string): TrialBalanceSourceData {
  return {
    sourceName: "Trial Balance.xlsx",
    sourcePath: sourcePathLabel,
    lastModifiedIso: new Date().toISOString(),
    rows: [],
  };
}

function writeBlankTrialBalanceWorkbook(targetPath: string) {
  ensureDirectory(path.dirname(targetPath));

  const workbook = utils.book_new();
  const sheet = utils.aoa_to_sheet([
    ["Financial Statement Item", "GL Number", "GL Description", "Current Year", "Previous Year"],
  ]);

  utils.book_append_sheet(workbook, sheet, "Trial Balance");
  writeFile(workbook, targetPath);
}

function hasMeaningfulTrialBalanceRow(row: Record<string, string>) {
  return [
    row["Financial Statement Item"],
    row["GL Number"],
    row["GL Description"],
    row["Current Year"],
    row["Previous Year"],
  ].some((value) => String(value ?? "").trim() !== "");
}

function parseTrialBalanceWorkbookBuffer(buffer: Buffer, sourceName: string, sourcePathLabel: string): TrialBalanceSourceData {
  const workbook = read(buffer, { type: "buffer" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];

  if (!firstSheet) {
    throw new Error("Uploaded trial balance workbook does not contain a readable sheet.");
  }

  const rows = utils.sheet_to_json(firstSheet, {
    raw: false,
    defval: "",
  }) as Array<Record<string, string>>;

  return {
    sourceName,
    sourcePath: sourcePathLabel,
    lastModifiedIso: new Date().toISOString(),
    rows: rows
      .map((row) => ({
        "Financial Statement Item": row["Financial Statement Item"] ?? "",
        "GL Number": row["GL Number"] ?? "",
        "GL Description": row["GL Description"] ?? "",
        "Current Year": row["Current Year"] ?? "",
        "Previous Year": row["Previous Year"] ?? "",
      }))
      .filter(hasMeaningfulTrialBalanceRow),
  };
}

function getCompanyDirectoryBySlug(slug: string) {
  return path.join(workspaceRoot, slug);
}

let companyCache: CompanyRecord[] = [];

function mapCompany(row: Company): CompanyRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    code: row.code,
    defaultVersionId: row.defaultVersionId ?? "",
    excelProfileId: row.excelProfileId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function rememberCompanies(companies: CompanyRecord[]) {
  companyCache = companies;
  return companyCache;
}

export async function loadCompaniesFromDb() {
  const rows = await prisma.company.findMany({
    orderBy: { id: "asc" },
  });
  return rememberCompanies(rows.map(mapCompany));
}

function findCompanyRecord(companyId: number) {
  return companyCache.find((company) => company.id === companyId);
}

export function getCompanySlug(companyId: number) {
  const company = findCompanyRecord(companyId);
  if (!company) {
    throw new Error(`Unknown company id ${companyId}.`);
  }
  return company.slug;
}

function getCompanyDirectory(companyId: number) {
  return getCompanyDirectoryBySlug(getCompanySlug(companyId));
}

function getCompanySettingsPath(companyId: number) {
  return path.join(getCompanyDirectory(companyId), "settings.json");
}

function getCompanyVersionsIndexPath(companyId: number) {
  return path.join(getCompanyDirectory(companyId), "versions", "index.json");
}

function getCompanyLogicDirectory(companyId: number) {
  return path.join(getCompanyDirectory(companyId), "logic");
}

function getCompanyVersionDirectory(companyId: number, versionId: string) {
  return path.join(getCompanyDirectory(companyId), "versions", versionId);
}

export function getCompanyVersionPaths(companyId: number, versionId: string) {
  const versionDirectory = getCompanyVersionDirectory(companyId, versionId);

  return {
    versionDirectory,
    trialBalanceWorkbookPath: path.join(versionDirectory, "Trial Balance.xlsx"),
    trialBalanceSourcePath: path.join(versionDirectory, "trial-balance-source.json"),
    statementWorkbookPath: path.join(versionDirectory, "V-8.xlsx"),
    versionDetailsPath: path.join(versionDirectory, "version-details.json"),
    groupingOverridesPath: path.join(versionDirectory, "grouping-overrides.json"),
    consolidationConfigPath: path.join(versionDirectory, "consolidation-config.json"),
    ratioLedgerConfigPath: path.join(versionDirectory, "ratio-ledger-config.json"),
    ageingConfigPath: path.join(versionDirectory, "ageing-config.json"),
    fixedAssetRegisterWorkbookPath: path.join(versionDirectory, "Fixed Asset Register.xlsx"),
    fixedAssetRegisterConfigPath: path.join(versionDirectory, "fixed-asset-register.json"),
    exportedPdfPath: path.join(versionDirectory, "financial-statements-v8.pdf"),
  };
}

export function getSharedStatementWorkbookPath() {
  return defaultStatementWorkbookPath;
}

export function getCompanyLogicPaths(companyId: number) {
  const logicDirectory = getCompanyLogicDirectory(companyId);
  ensureDirectory(logicDirectory);

  const masterGroupingWorkbookPath = path.join(logicDirectory, "Master Grouping File.xlsx");

  copyFileIfMissing(defaultGroupingWorkbookPath, masterGroupingWorkbookPath);

  return {
    logicDirectory,
    masterGroupingWorkbookPath,
  };
}

function writeVersionDetails(detailsPath: string, details: VersionDetailsRecord) {
  writeJsonFile(detailsPath, details);
}

function defaultSettings(): CompanySettings {
  return {
    reportingCurrency: "INR",
    unitsLabel: "(Rs. in lakhs)",
    directors: [
      { name: "Rohan Mehta", designation: "Director" },
      { name: "Neha Kapoor", designation: "Director" },
    ],
    auditors: [
      { name: "Aman Gupta", designation: "Chartered Accountants", firmName: "PQR & Associates", membershipNumber: "Membership No. 999999" },
    ],
    footerNote: "These financial statements are company specific and version controlled within the portal workspace.",
  };
}

function readCompanySettings(companyId: number) {
  const fileSettings = readJsonFile<CompanySettings>(getCompanySettingsPath(companyId), defaultSettings());
  const company = findCompanyRecord(companyId);

  return {
    ...fileSettings,
    excelProfileId: company?.excelProfileId ?? fileSettings.excelProfileId,
  };
}

function writeCompanySettings(companyId: number, settings: CompanySettings) {
  writeJsonFile(getCompanySettingsPath(companyId), settings);
}

function readCompanyVersions(companyId: number) {
  return readJsonFile<StatementVersionRecord[]>(getCompanyVersionsIndexPath(companyId), []);
}

function writeCompanyVersions(companyId: number, versions: StatementVersionRecord[]) {
  writeJsonFile(getCompanyVersionsIndexPath(companyId), versions);
}

function provisionCompanyFiles(companyId: number, _createdByUserId: string) {
  ensureDirectory(getCompanyDirectory(companyId));
  ensureDirectory(path.join(getCompanyDirectory(companyId), "versions"));
  ensureDirectory(getCompanyLogicDirectory(companyId));
  copyFileIfMissing(defaultGroupingWorkbookPath, getCompanyLogicPaths(companyId).masterGroupingWorkbookPath);
  writeCompanySettings(companyId, defaultSettings());
  writeCompanyVersions(companyId, []);
}

export async function listCompanies() {
  return loadCompaniesFromDb();
}

export function getCachedCompanies() {
  return companyCache;
}

export async function listSiteUsers() {
  return (await listWorkspaceSiteUsers()).map(toWorkspaceUser);
}

export async function listCompanyUsers(companyId: number) {
  return (await listWorkspaceUsersByCompany(companyId)).map(toWorkspaceUser);
}

export function getCompanySettings(companyId: number) {
  return readCompanySettings(companyId);
}

export function listCompanyVersions(companyId: number) {
  return readCompanyVersions(companyId).sort((left, right) => right.versionNumber - left.versionNumber);
}

export async function createCompany(input: {
  name: string;
  code: string;
  adminName: string;
  adminEmail: string;
}) {
  const companies = await loadCompaniesFromDb();
  const normalizedAdminEmail = input.adminEmail.trim().toLowerCase();

  if (!normalizedAdminEmail.includes("@")) {
    throw new Error("Company admin email must be a valid email address.");
  }

  if (await findWorkspaceUserByEmail(normalizedAdminEmail)) {
    throw new Error("A user with this email already exists.");
  }

  const slugBase = slugify(input.name) || `company-${companies.length + 1}`;
  let slug = slugBase;
  let suffix = 1;

  while (companies.some((company) => company.slug === slug)) {
    suffix += 1;
    slug = `${slugBase}-${suffix}`;
  }

  const created = await prisma.company.create({
    data: {
      slug,
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      defaultVersionId: null,
    },
  });
  const company = mapCompany(created);
  rememberCompanies([...companies, company]);

  try {
    const companyAdmin = await createWorkspaceUserWithEmailedTempPassword({
      name: input.adminName.trim(),
      email: normalizedAdminEmail,
      role: "COMPANY_ADMIN",
      companyId: company.id,
    });

    provisionCompanyFiles(company.id, companyAdmin.id);
    return company;
  } catch (error) {
    await prisma.user.deleteMany({ where: { companyId: company.id } }).catch(() => undefined);
    await prisma.company.delete({ where: { id: company.id } }).catch(() => undefined);
    rememberCompanies(companies);
    throw error;
  }
}

export async function createCompanyUser(input: {
  companyId: number;
  name: string;
  email: string;
  role: Exclude<WorkspaceUserRole, "SITE_ADMIN">;
  password?: string;
}) {
  await loadCompaniesFromDb();
  if (!findCompanyRecord(input.companyId)) {
    throw new Error("Company was not found.");
  }

  return toWorkspaceUser(
    await createWorkspaceUser({
      companyId: input.companyId,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      role: input.role,
      password: input.password?.trim() || rolePasswordDefaults[input.role],
    }),
  );
}

export function updateCompanySettings(companyId: number, settings: CompanySettings) {
  const company = findCompanyRecord(companyId);
  writeCompanySettings(companyId, {
    ...settings,
    // Excel profile is owned by site admin / companies.excel_profile_id — keep in sync.
    excelProfileId: company?.excelProfileId ?? settings.excelProfileId,
  });
  return getCompanySettings(companyId);
}

export async function updateCompanyExcelProfile(companyId: number, excelProfileId: string | null) {
  await loadCompaniesFromDb();
  if (!findCompanyRecord(companyId)) {
    throw new Error("Company was not found.");
  }

  const normalized = excelProfileId?.trim() || null;
  if (normalized && !isRegisteredExcelProfileId(normalized)) {
    throw new Error("Unknown Excel structure profile.");
  }

  const updated = await prisma.company.update({
    where: { id: companyId },
    data: { excelProfileId: normalized },
  });
  const company = mapCompany(updated);
  rememberCompanies(companyCache.map((entry) => (entry.id === company.id ? company : entry)));

  const settings = getCompanySettings(companyId);
  writeCompanySettings(companyId, {
    ...settings,
    excelProfileId: company.excelProfileId,
  });

  return company;
}

export async function createCompanyVersionFromFormData(input: {
  companyId: number;
  label: string;
  financialYear: string;
  createdByUserId: string;
  trialBalanceFile?: File | null;
  statementWorkbookFile?: File | null;
}) {
  await loadCompaniesFromDb();
  const versions = listCompanyVersions(input.companyId);
  const nextVersionNumber = (versions[0]?.versionNumber ?? 0) + 1;
  const versionId = `v${nextVersionNumber}`;
  const versionPaths = getCompanyVersionPaths(input.companyId, versionId);
  ensureDirectory(versionPaths.versionDirectory);

  const activeVersion = versions[0];
  const trialBalanceFile = input.trialBalanceFile;
  const statementWorkbookFile = input.statementWorkbookFile;
  const createdAt = new Date().toISOString();

  if (!trialBalanceFile || trialBalanceFile.size === 0) {
    throw new Error("Trial balance workbook is required.");
  }

  await assertCompanyHasMasterGrouping(input.companyId);

  let sourceData: TrialBalanceSourceData | null = null;

  if (trialBalanceFile.size > 0) {
    const buffer = Buffer.from(await trialBalanceFile.arrayBuffer());
    fs.writeFileSync(versionPaths.trialBalanceWorkbookPath, buffer);
    sourceData = parseTrialBalanceWorkbookBuffer(buffer, trialBalanceFile.name, versionPaths.trialBalanceWorkbookPath);
  } else if (activeVersion) {
    copyFileIfMissing(activeVersion.trialBalanceWorkbookPath, versionPaths.trialBalanceWorkbookPath);
    sourceData = buildEmptyTrialBalanceSourceData(versionPaths.trialBalanceWorkbookPath);
  } else {
    writeBlankTrialBalanceWorkbook(versionPaths.trialBalanceWorkbookPath);
    sourceData = buildEmptyTrialBalanceSourceData(versionPaths.trialBalanceWorkbookPath);
  }

  if (statementWorkbookFile && statementWorkbookFile.size > 0) {
    fs.writeFileSync(versionPaths.statementWorkbookPath, Buffer.from(await statementWorkbookFile.arrayBuffer()));
  } else if (activeVersion) {
    copyFileIfMissing(activeVersion.statementWorkbookPath, versionPaths.statementWorkbookPath);
  } else {
    copyFileIfMissing(defaultStatementWorkbookPath, versionPaths.statementWorkbookPath);
  }

  writeJsonFile(versionPaths.consolidationConfigPath, {
    updatedAt: null,
    members: [],
    eliminations: [],
  });
  writeJsonFile(versionPaths.ratioLedgerConfigPath, {
    updatedAt: null,
    ratios: {},
  });
  writeJsonFile(versionPaths.ageingConfigPath, {
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
  });
  writeJsonFile(versionPaths.fixedAssetRegisterConfigPath, {
    updatedAt: null,
    upload: {
      sourceName: null,
      uploadedAt: null,
    },
    schedules: {
      ppe: [],
      cwip: [],
      intangible: [],
      rou: [],
    },
  });

  const version: StatementVersionRecord = {
    id: versionId,
    label: input.label.trim() || `Version ${nextVersionNumber}`,
    financialYear: input.financialYear.trim() || "2025-26",
    versionNumber: nextVersionNumber,
    createdAt,
    createdByUserId: input.createdByUserId,
    trialBalanceWorkbookName: trialBalanceFile.name,
    trialBalanceWorkbookPath: versionPaths.trialBalanceWorkbookPath,
    trialBalanceSourcePath: versionPaths.trialBalanceSourcePath,
    statementWorkbookName: statementWorkbookFile?.name?.trim() || activeVersion?.statementWorkbookName || path.basename(versionPaths.statementWorkbookPath),
    statementWorkbookPath: versionPaths.statementWorkbookPath,
    versionDetailsPath: versionPaths.versionDetailsPath,
    groupingOverridesPath: versionPaths.groupingOverridesPath,
    exportedPdfPath: versionPaths.exportedPdfPath,
    status: "draft",
  };

  if (!sourceData) {
    throw new Error("Unable to parse the trial balance workbook.");
  }

  await persistTrialBalanceVersionToDb({
    companyId: input.companyId,
    versionNumber: version.versionNumber,
    label: version.label,
    financialYear: version.financialYear,
    createdByUserId: input.createdByUserId,
    trialBalanceFileName: version.trialBalanceWorkbookName,
    trialBalanceFileKey: version.trialBalanceWorkbookPath,
    sourceData,
  });

  writeVersionDetails(versionPaths.versionDetailsPath, {
    versionId,
    companyId: input.companyId,
    label: version.label,
    financialYear: version.financialYear,
    versionNumber: version.versionNumber,
    createdAt,
    createdByUserId: input.createdByUserId,
    uploads: {
      trialBalance: {
        originalFileName: trialBalanceFile.name,
        storedFileName: path.basename(versionPaths.trialBalanceWorkbookPath),
        workbookPath: versionPaths.trialBalanceWorkbookPath,
        sourceJsonPath: versionPaths.trialBalanceSourcePath,
        uploadedAt: createdAt,
      },
      statementWorkbook: {
        originalFileName: statementWorkbookFile?.name?.trim() || activeVersion?.statementWorkbookName || path.basename(versionPaths.statementWorkbookPath),
        storedFileName: path.basename(versionPaths.statementWorkbookPath),
        workbookPath: versionPaths.statementWorkbookPath,
        uploadedAt: createdAt,
      },
    },
  });

  writeCompanyVersions(input.companyId, [...versions, version]);
  await prisma.company.update({
    where: { id: input.companyId },
    data: { defaultVersionId: version.id },
  });

  await loadCompaniesFromDb();

  return version;
}

export async function deleteCompanyVersion(input: { companyId: number; versionId: string }) {
  await loadCompaniesFromDb();
  const versionId = input.versionId.trim();
  const versions = listCompanyVersions(input.companyId);
  const version = versions.find((entry) => entry.id === versionId) ?? null;
  const dbVersion = await findStatementVersionRecord(input.companyId, versionId);

  if (!version && !dbVersion) {
    throw new Error("Version not found.");
  }

  if (dbVersion) {
    await prisma.statementVersion.delete({
      where: { id: dbVersion.id },
    });
  }

  const remaining = versions.filter((entry) => entry.id !== versionId);
  const earliest = [...remaining].sort((left, right) => left.versionNumber - right.versionNumber)[0] ?? null;
  const nextDefaultVersionId = earliest?.id ?? null;

  await prisma.company.update({
    where: { id: input.companyId },
    data: { defaultVersionId: nextDefaultVersionId },
  });

  writeCompanyVersions(input.companyId, remaining);

  try {
    fs.rmSync(getCompanyVersionDirectory(input.companyId, versionId), { recursive: true, force: true });
  } catch {
    // Folder may already be missing for a DB-only version.
  }

  await loadCompaniesFromDb();

  return {
    deletedVersionId: versionId,
    defaultVersionId: nextDefaultVersionId,
    remaining,
  };
}

function permissionsForRole(role: WorkspaceUserRole) {
  return {
    canManageCompanies: role === "SITE_ADMIN",
    canManageCompanyUsers: role === "COMPANY_ADMIN",
    canUploadTrialBalance: role === "SITE_ADMIN" || role === "COMPANY_ADMIN" || role === "FINANCE",
    canManageGrouping: role === "SITE_ADMIN" || role === "COMPANY_ADMIN" || role === "FINANCE",
    canManageConsolidation: role === "SITE_ADMIN" || role === "COMPANY_ADMIN" || role === "FINANCE",
    canDownloadStatements: true,
    canEditSignatories: role === "COMPANY_ADMIN",
  };
}

export function requireActiveCompany(context: WorkspaceContext): ActiveWorkspaceContext {
  if (!context.company || !context.currentVersion) {
    throw new Error("Select a company version before continuing. Upload a trial balance to create the first version.");
  }

  return context as ActiveWorkspaceContext;
}

export function requireCompanyContext(context: WorkspaceContext): CompanyWorkspaceContext {
  if (!context.company) {
    throw new Error("No company is selected.");
  }

  return context as CompanyWorkspaceContext;
}

export function resolveWorkspaceContext(input?: {
  companyId?: string | number;
  userId?: string;
  currentUser?: WorkspaceUser;
  versionId?: string;
}) {
  const requestedCompanyId = parseCompanyId(input?.companyId);
  const company =
    companyCache.find((entry) => entry.id === requestedCompanyId) ??
    companyCache[0] ??
    null;

  const currentUser =
    input?.currentUser ??
    ({
      id: input?.userId || "system",
      name: "System",
      email: "",
      role: "SITE_ADMIN",
      isActive: true,
      tempLogin: false,
      createdAt: new Date(0).toISOString(),
    } satisfies WorkspaceUser);

  if (!company) {
    if (currentUser.role === "SITE_ADMIN") {
      return {
        companies: companyCache,
        company: null,
        companyUsers: [],
        selectableUsers: currentUser ? [currentUser] : [],
        currentUser,
        versions: [],
        currentVersion: null,
        settings: defaultSettings(),
        permissions: permissionsForRole(currentUser.role),
      } satisfies WorkspaceContext;
    }

    throw new Error("No companies are configured in the workspace.");
  }

  const versions = listCompanyVersions(company.id);
  const currentVersion =
    versions.find((version) => version.id === input?.versionId) ??
    versions.find((version) => version.id === company.defaultVersionId) ??
    versions[0] ??
    null;

  return {
    companies: companyCache,
    company,
    companyUsers: input?.currentUser ? [input.currentUser] : [],
    selectableUsers: input?.currentUser ? [input.currentUser] : [],
    currentUser,
    versions,
    currentVersion,
    settings: getCompanySettings(company.id),
    permissions: permissionsForRole(currentUser.role),
  } satisfies WorkspaceContext;
}

export async function resolveAuthenticatedWorkspaceContext(input: {
  user: WorkspaceUser;
  companyId?: string | number;
  versionId?: string;
}) {
  await loadCompaniesFromDb();
  const context = resolveWorkspaceContext({
    companyId: input.user.role === "SITE_ADMIN" ? input.companyId : input.user.companyId,
    userId: input.user.id,
    currentUser: input.user,
    versionId: input.versionId,
  });

  const siteUsers = await listSiteUsers();
  const companyUsers = context.company ? await listCompanyUsers(context.company.id) : [];

  return {
    ...context,
    companyUsers,
    selectableUsers: [...siteUsers, ...companyUsers],
    currentUser: input.user,
    permissions: permissionsForRole(input.user.role),
  } satisfies WorkspaceContext;
}

export async function findWorkspaceUserByEmail(email: string) {
  const user = await findWorkspaceUserRecordByEmail(email.trim().toLowerCase());
  return user ? toWorkspaceUser(user) : null;
}

export async function getWorkspaceUserById(userId: string) {
  const user = await getWorkspaceUserRecordById(userId);
  return user ? toWorkspaceUser(user) : null;
}

export async function authenticateWorkspaceUser(email: string, password: string) {
  const record = await getWorkspaceUserWithSecretByEmail(email);

  if (!record || !record.isActive) {
    return null;
  }

  const matches = await verifyPassword(password, record.passwordHash);
  if (!matches) {
    return null;
  }

  return toWorkspaceUser({
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    companyId: record.companyId ?? undefined,
    isActive: record.isActive,
    tempLogin: record.tempLogin,
    createdAt: record.createdAt.toISOString(),
  });
}

export async function resetWorkspaceUserPassword(email: string, password: string) {
  const record = await getWorkspaceUserWithSecretByEmail(email.trim().toLowerCase());

  if (!record || !record.isActive) {
    return null;
  }

  return toWorkspaceUser(await updateWorkspaceUserPasswordById(record.id, password.trim()));
}

export async function changeAuthenticatedUserPassword(input: {
  userId: string;
  currentPassword: string;
  nextPassword: string;
}) {
  const updated = await changeWorkspaceUserPassword(input);
  return updated ? toWorkspaceUser(updated) : null;
}

export async function getLoginDemoAccounts() {
  return (await listAllWorkspaceUsers()).map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
  }));
}
