import fs from "node:fs";
import {
  findWorkspaceUserRecordByEmail,
  getWorkspaceUserRecordById,
  listAllWorkspaceUsers,
  listWorkspaceSiteUsers,
  listWorkspaceUsersByCompany,
  updateWorkspaceUserPasswordById,
  upsertWorkspaceUsers,
} from "@/lib/user-database";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { read, utils, writeFile } from "xlsx";

export type WorkspaceUserRole = "SITE_ADMIN" | "COMPANY_ADMIN" | "FINANCE" | "AUDITOR";

export type WorkspaceUser = {
  id: string;
  name: string;
  email: string;
  role: WorkspaceUserRole;
  companyId?: string;
  isActive: boolean;
  createdAt: string;
};

type WorkspaceUserRecord = WorkspaceUser & {
  password?: string;
};

export type CompanyRecord = {
  id: string;
  slug: string;
  name: string;
  code: string;
  defaultVersionId: string;
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
  companyId: string;
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

type WorkspaceIndex = {
  defaultCompanyId: string | null;
  siteUsers: WorkspaceUserRecord[];
  companies: CompanyRecord[];
};

export type WorkspaceContext = {
  companies: CompanyRecord[];
  company: CompanyRecord;
  companyUsers: WorkspaceUser[];
  selectableUsers: WorkspaceUser[];
  currentUser: WorkspaceUser;
  versions: StatementVersionRecord[];
  currentVersion: StatementVersionRecord;
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

const workspaceRoot = path.join(process.cwd(), "data", "companies");
const workspaceIndexPath = path.join(workspaceRoot, "workspace.json");
const defaultStatementWorkbookPath = path.join(process.cwd(), "V-8.xlsx");
const defaultGroupingJsonPath = path.join(process.cwd(), "data", "master-groupings.json");
const defaultGroupingWorkbookPath = path.join(process.cwd(), "Master Grouping File.xlsx");
const rolePasswordDefaults: Record<WorkspaceUserRole, string> = {
  SITE_ADMIN: "Admin@123",
  COMPANY_ADMIN: "Admin@123",
  FINANCE: "Finance@123",
  AUDITOR: "Audit@123",
};
let lastUserSyncStamp: string | null = null;

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

function withPassword(user: WorkspaceUserRecord): WorkspaceUserRecord {
  return {
    ...user,
    password: user.password?.trim() || rolePasswordDefaults[user.role],
  };
}

function withoutPassword(user: WorkspaceUserRecord): WorkspaceUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    companyId: user.companyId,
    isActive: user.isActive,
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

function getCompanyDirectory(companyId: string) {
  return path.join(workspaceRoot, companyId);
}

function getCompanyUsersPath(companyId: string) {
  return path.join(getCompanyDirectory(companyId), "users.json");
}

function getCompanySettingsPath(companyId: string) {
  return path.join(getCompanyDirectory(companyId), "settings.json");
}

function getCompanyVersionsIndexPath(companyId: string) {
  return path.join(getCompanyDirectory(companyId), "versions", "index.json");
}

function getCompanyLogicDirectory(companyId: string) {
  return path.join(getCompanyDirectory(companyId), "logic");
}

function getCompanyVersionDirectory(companyId: string, versionId: string) {
  return path.join(getCompanyDirectory(companyId), "versions", versionId);
}

export function getCompanyVersionPaths(companyId: string, versionId: string) {
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

export function getCompanyLogicPaths(companyId: string) {
  const logicDirectory = getCompanyLogicDirectory(companyId);
  ensureDirectory(logicDirectory);

  const masterGroupingSourcePath = path.join(logicDirectory, "master-groupings.json");
  const masterGroupingWorkbookPath = path.join(logicDirectory, "Master Grouping File.xlsx");

  copyFileIfMissing(defaultGroupingJsonPath, masterGroupingSourcePath);
  copyFileIfMissing(defaultGroupingWorkbookPath, masterGroupingWorkbookPath);

  return {
    logicDirectory,
    masterGroupingSourcePath,
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

function defaultSiteAdmin(): WorkspaceUser {
  return {
    id: "site-admin",
    name: "Shivam Chaturvedi",
    email: "siteadmin@fingen.local",
    role: "SITE_ADMIN",
    isActive: true,
    createdAt: new Date("2026-07-24T00:00:00.000Z").toISOString(),
  };
}

function defaultSiteAdminRecord(): WorkspaceUserRecord {
  return {
    ...defaultSiteAdmin(),
    password: rolePasswordDefaults.SITE_ADMIN,
  };
}

function readWorkspaceIndex() {
  ensureDirectory(workspaceRoot);
  return readJsonFile<WorkspaceIndex>(workspaceIndexPath, {
    defaultCompanyId: null,
    siteUsers: [defaultSiteAdminRecord()],
    companies: [],
  });
}

function writeWorkspaceIndex(index: WorkspaceIndex) {
  writeJsonFile(workspaceIndexPath, index);
}

function getUserSyncStamp(index: WorkspaceIndex) {
  const fileStamp = (filePath: string) => {
    try {
      const stats = fs.statSync(filePath);
      return `${filePath}:${stats.mtimeMs}:${stats.size}`;
    } catch {
      return `${filePath}:missing`;
    }
  };

  return [
    fileStamp(workspaceIndexPath),
    ...index.companies.map((company) => fileStamp(getCompanyUsersPath(company.id))),
  ].join("|");
}

function syncUsersDatabase(index: WorkspaceIndex) {
  const nextStamp = getUserSyncStamp(index);

  if (lastUserSyncStamp === nextStamp) {
    return;
  }

  const siteUsers = index.siteUsers.map(withPassword);
  const companyUsers = index.companies.flatMap((company) =>
    readJsonFile<WorkspaceUserRecord[]>(getCompanyUsersPath(company.id), []).map(withPassword),
  );

  upsertWorkspaceUsers([...siteUsers, ...companyUsers]);
  lastUserSyncStamp = nextStamp;
}

function readCompanyUsers(companyId: string) {
  const databaseUsers = listWorkspaceUsersByCompany(companyId).map(withPassword);

  if (databaseUsers.length > 0) {
    return databaseUsers;
  }

  const fileUsers = readJsonFile<WorkspaceUserRecord[]>(getCompanyUsersPath(companyId), []).map(withPassword);

  if (fileUsers.length > 0) {
    upsertWorkspaceUsers(fileUsers);
  }

  return fileUsers;
}

function writeCompanyUsers(companyId: string, users: WorkspaceUserRecord[]) {
  writeJsonFile(getCompanyUsersPath(companyId), users);
  upsertWorkspaceUsers(users.map(withPassword));
}

function readCompanySettings(companyId: string) {
  return readJsonFile<CompanySettings>(getCompanySettingsPath(companyId), defaultSettings());
}

function writeCompanySettings(companyId: string, settings: CompanySettings) {
  writeJsonFile(getCompanySettingsPath(companyId), settings);
}

function readCompanyVersions(companyId: string) {
  return readJsonFile<StatementVersionRecord[]>(getCompanyVersionsIndexPath(companyId), []);
}

function writeCompanyVersions(companyId: string, versions: StatementVersionRecord[]) {
  writeJsonFile(getCompanyVersionsIndexPath(companyId), versions);
}

function seedInitialVersion(companyId: string, createdByUserId: string) {
  const versionId = "v1";
  const versionDirectory = getCompanyVersionDirectory(companyId, versionId);
  const paths = getCompanyVersionPaths(companyId, versionId);

  ensureDirectory(versionDirectory);
  writeBlankTrialBalanceWorkbook(paths.trialBalanceWorkbookPath);
  copyFileIfMissing(defaultStatementWorkbookPath, paths.statementWorkbookPath);

  if (!fs.existsSync(paths.trialBalanceSourcePath)) {
    writeJsonFile(paths.trialBalanceSourcePath, buildEmptyTrialBalanceSourceData(paths.trialBalanceWorkbookPath));
  }

  if (!fs.existsSync(paths.groupingOverridesPath)) {
    writeJsonFile(paths.groupingOverridesPath, {
      updatedAt: null,
      overrides: {},
    });
  }

  if (!fs.existsSync(paths.consolidationConfigPath)) {
    writeJsonFile(paths.consolidationConfigPath, {
      updatedAt: null,
      members: [],
      eliminations: [],
    });
  }

  if (!fs.existsSync(paths.ratioLedgerConfigPath)) {
    writeJsonFile(paths.ratioLedgerConfigPath, {
      updatedAt: null,
      ratios: {},
    });
  }

  if (!fs.existsSync(paths.ageingConfigPath)) {
    writeJsonFile(paths.ageingConfigPath, {
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
  }

  if (!fs.existsSync(paths.fixedAssetRegisterConfigPath)) {
    writeJsonFile(paths.fixedAssetRegisterConfigPath, {
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
  }

  return {
    id: versionId,
    label: "Version 1",
    financialYear: "2025-26",
    versionNumber: 1,
    createdAt: new Date().toISOString(),
    createdByUserId,
    trialBalanceWorkbookName: "Trial Balance.xlsx",
    trialBalanceWorkbookPath: paths.trialBalanceWorkbookPath,
    trialBalanceSourcePath: paths.trialBalanceSourcePath,
    statementWorkbookName: "V-8.xlsx",
    statementWorkbookPath: paths.statementWorkbookPath,
    versionDetailsPath: paths.versionDetailsPath,
    groupingOverridesPath: paths.groupingOverridesPath,
    exportedPdfPath: paths.exportedPdfPath,
    status: "draft",
  } satisfies StatementVersionRecord;
}

export function ensureWorkspaceSeeded() {
  const index = readWorkspaceIndex();

  if (index.companies.length > 0) {
    syncUsersDatabase(index);
    return index;
  }

  const now = new Date().toISOString();
  const companyId = "xyz";
  const company: CompanyRecord = {
    id: companyId,
    slug: "xyz",
    name: "XYZ",
    code: "XYZ",
    defaultVersionId: "v1",
    createdAt: now,
    updatedAt: now,
  };

  ensureDirectory(getCompanyDirectory(companyId));
  ensureDirectory(path.join(getCompanyDirectory(companyId), "versions"));
  ensureDirectory(getCompanyLogicDirectory(companyId));

  copyFileIfMissing(defaultGroupingJsonPath, getCompanyLogicPaths(companyId).masterGroupingSourcePath);
  copyFileIfMissing(defaultGroupingWorkbookPath, getCompanyLogicPaths(companyId).masterGroupingWorkbookPath);

  const adminUser: WorkspaceUserRecord = {
    id: "company-admin",
    companyId,
    name: "Company Admin",
    email: "admin@xyz.local",
    role: "COMPANY_ADMIN",
    password: rolePasswordDefaults.COMPANY_ADMIN,
    isActive: true,
    createdAt: now,
  };
  const financeUser: WorkspaceUserRecord = {
    id: "finance-user",
    companyId,
    name: "Finance Person",
    email: "finance@xyz.local",
    role: "FINANCE",
    password: rolePasswordDefaults.FINANCE,
    isActive: true,
    createdAt: now,
  };
  const auditorUser: WorkspaceUserRecord = {
    id: "auditor-user",
    companyId,
    name: "Auditor",
    email: "auditor@xyz.local",
    role: "AUDITOR",
    password: rolePasswordDefaults.AUDITOR,
    isActive: true,
    createdAt: now,
  };

  writeCompanyUsers(companyId, [adminUser, financeUser, auditorUser]);
  writeCompanySettings(companyId, defaultSettings());
  writeCompanyVersions(companyId, [seedInitialVersion(companyId, adminUser.id)]);

  const seededIndex: WorkspaceIndex = {
    defaultCompanyId: companyId,
    siteUsers: [defaultSiteAdminRecord()],
    companies: [company],
  };
  writeWorkspaceIndex(seededIndex);
  syncUsersDatabase(seededIndex);
  return seededIndex;
}

export function listCompanies() {
  return ensureWorkspaceSeeded().companies;
}

export function listSiteUsers() {
  const index = ensureWorkspaceSeeded();
  const databaseUsers = listWorkspaceSiteUsers().map(withoutPassword);

  if (databaseUsers.length > 0) {
    return databaseUsers;
  }

  const fallbackUsers = index.siteUsers.map(withPassword);
  upsertWorkspaceUsers(fallbackUsers);
  return fallbackUsers.map(withoutPassword);
}

export function listCompanyUsers(companyId: string) {
  ensureWorkspaceSeeded();
  return readCompanyUsers(companyId).map(withoutPassword);
}

export function getCompanySettings(companyId: string) {
  ensureWorkspaceSeeded();
  return readCompanySettings(companyId);
}

export function listCompanyVersions(companyId: string) {
  ensureWorkspaceSeeded();
  return readCompanyVersions(companyId).sort((left, right) => right.versionNumber - left.versionNumber);
}

export function createCompany(input: {
  name: string;
  code: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}) {
  const index = ensureWorkspaceSeeded();
  const normalizedAdminEmail = input.adminEmail.trim().toLowerCase();

  if (findWorkspaceUserByEmail(normalizedAdminEmail)) {
    throw new Error("A user with this email already exists.");
  }

  const now = new Date().toISOString();
  const slugBase = slugify(input.name) || `company-${index.companies.length + 1}`;
  let companyId = slugBase;
  let suffix = 1;

  while (index.companies.some((company) => company.id === companyId)) {
    suffix += 1;
    companyId = `${slugBase}-${suffix}`;
  }

  const company: CompanyRecord = {
    id: companyId,
    slug: slugBase,
    name: input.name.trim(),
    code: input.code.trim().toUpperCase(),
    defaultVersionId: "v1",
    createdAt: now,
    updatedAt: now,
  };

  ensureDirectory(getCompanyDirectory(companyId));
  ensureDirectory(path.join(getCompanyDirectory(companyId), "versions"));
  ensureDirectory(getCompanyLogicDirectory(companyId));
  copyFileIfMissing(defaultGroupingJsonPath, getCompanyLogicPaths(companyId).masterGroupingSourcePath);
  copyFileIfMissing(defaultGroupingWorkbookPath, getCompanyLogicPaths(companyId).masterGroupingWorkbookPath);

  const companyAdmin: WorkspaceUserRecord = {
    id: randomUUID(),
    companyId,
    name: input.adminName.trim(),
    email: normalizedAdminEmail,
    role: "COMPANY_ADMIN",
    password: input.adminPassword.trim() || rolePasswordDefaults.COMPANY_ADMIN,
    isActive: true,
    createdAt: now,
  };

  writeCompanyUsers(companyId, [companyAdmin]);
  writeCompanySettings(companyId, defaultSettings());
  writeCompanyVersions(companyId, [seedInitialVersion(companyId, companyAdmin.id)]);

  const nextIndex: WorkspaceIndex = {
    ...index,
    defaultCompanyId: index.defaultCompanyId ?? companyId,
    companies: [...index.companies, company],
  };
  writeWorkspaceIndex(nextIndex);
  return company;
}

export function createCompanyUser(input: {
  companyId: string;
  name: string;
  email: string;
  role: Exclude<WorkspaceUserRole, "SITE_ADMIN">;
  password?: string;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();

  if (findWorkspaceUserByEmail(normalizedEmail)) {
    throw new Error("A user with this email already exists.");
  }

  const users = readCompanyUsers(input.companyId);
  const user: WorkspaceUserRecord = {
    id: randomUUID(),
    companyId: input.companyId,
    name: input.name.trim(),
    email: normalizedEmail,
    role: input.role,
    password: input.password?.trim() || rolePasswordDefaults[input.role],
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  writeCompanyUsers(input.companyId, [...users, user]);
  return withoutPassword(user);
}

export function updateCompanySettings(companyId: string, settings: CompanySettings) {
  writeCompanySettings(companyId, settings);
  return settings;
}

export async function createCompanyVersionFromFormData(input: {
  companyId: string;
  label: string;
  financialYear: string;
  createdByUserId: string;
  trialBalanceFile?: File | null;
  statementWorkbookFile?: File | null;
}) {
  ensureWorkspaceSeeded();
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

  if (trialBalanceFile.size > 0) {
    const buffer = Buffer.from(await trialBalanceFile.arrayBuffer());
    fs.writeFileSync(versionPaths.trialBalanceWorkbookPath, buffer);
    writeJsonFile(
      versionPaths.trialBalanceSourcePath,
      parseTrialBalanceWorkbookBuffer(buffer, trialBalanceFile.name, versionPaths.trialBalanceWorkbookPath),
    );
  } else if (activeVersion) {
    copyFileIfMissing(activeVersion.trialBalanceWorkbookPath, versionPaths.trialBalanceWorkbookPath);
    copyFileIfMissing(activeVersion.trialBalanceSourcePath, versionPaths.trialBalanceSourcePath);
  } else {
    writeBlankTrialBalanceWorkbook(versionPaths.trialBalanceWorkbookPath);
    writeJsonFile(versionPaths.trialBalanceSourcePath, buildEmptyTrialBalanceSourceData(versionPaths.trialBalanceWorkbookPath));
  }

  if (statementWorkbookFile && statementWorkbookFile.size > 0) {
    fs.writeFileSync(versionPaths.statementWorkbookPath, Buffer.from(await statementWorkbookFile.arrayBuffer()));
  } else if (activeVersion) {
    copyFileIfMissing(activeVersion.statementWorkbookPath, versionPaths.statementWorkbookPath);
  } else {
    copyFileIfMissing(defaultStatementWorkbookPath, versionPaths.statementWorkbookPath);
  }

  writeJsonFile(versionPaths.groupingOverridesPath, {
    updatedAt: null,
    overrides: {},
  });
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
  const index = readWorkspaceIndex();
  const updatedCompanies = index.companies.map((company) =>
    company.id === input.companyId
      ? {
          ...company,
          defaultVersionId: version.id,
          updatedAt: version.createdAt,
        }
      : company,
  );
  writeWorkspaceIndex({
    ...index,
    companies: updatedCompanies,
  });

  return version;
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

export function resolveWorkspaceContext(input?: {
  companyId?: string;
  userId?: string;
  versionId?: string;
}) {
  const index = ensureWorkspaceSeeded();
  const siteUsers = index.siteUsers.map(withoutPassword);
  const company =
    index.companies.find((entry) => entry.id === input?.companyId) ??
    index.companies.find((entry) => entry.id === index.defaultCompanyId) ??
    index.companies[0];

  if (!company) {
    throw new Error("No companies are configured in the workspace.");
  }

  const companyUsers = listCompanyUsers(company.id);
  const selectableUsers = [...siteUsers, ...companyUsers];
  const currentUser =
    selectableUsers.find((user) => user.id === input?.userId) ??
    siteUsers[0] ??
    companyUsers[0];

  if (!currentUser) {
    throw new Error("No active user is configured for the selected company.");
  }

  const versions = listCompanyVersions(company.id);
  const currentVersion =
    versions.find((version) => version.id === input?.versionId) ??
    versions.find((version) => version.id === company.defaultVersionId) ??
    versions[0];

  if (!currentVersion) {
    throw new Error("No statement versions are configured for the selected company.");
  }

  return {
    companies: index.companies,
    company,
    companyUsers,
    selectableUsers,
    currentUser,
    versions,
    currentVersion,
    settings: getCompanySettings(company.id),
    permissions: permissionsForRole(currentUser.role),
  } satisfies WorkspaceContext;
}

export function getTrialBalanceSourceForVersion(companyId: string, versionId: string) {
  return readJsonFile<TrialBalanceSourceData>(getCompanyVersionPaths(companyId, versionId).trialBalanceSourcePath, {
    sourceName: "Trial Balance.xlsx",
    sourcePath: getCompanyVersionPaths(companyId, versionId).trialBalanceWorkbookPath,
    lastModifiedIso: new Date().toISOString(),
    rows: [],
  });
}

export function findWorkspaceUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  ensureWorkspaceSeeded();
  return findWorkspaceUserRecordByEmail(normalizedEmail);
}

export function getWorkspaceUserById(userId: string) {
  ensureWorkspaceSeeded();
  return getWorkspaceUserRecordById(userId);
}

export function authenticateWorkspaceUser(email: string, password: string) {
  const user = findWorkspaceUserByEmail(email);

  if (!user || !user.isActive) {
    return null;
  }

  return user.password === password ? withoutPassword(user) : null;
}

export function resetWorkspaceUserPassword(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = findWorkspaceUserByEmail(normalizedEmail);

  if (!user || !user.isActive) {
    return null;
  }

  const nextPassword = password.trim();

  if (user.companyId) {
    const users = readCompanyUsers(user.companyId);
    const nextUsers = users.map((entry) =>
      entry.id === user.id
        ? {
            ...entry,
            password: nextPassword,
          }
        : entry,
    );

    writeCompanyUsers(user.companyId, nextUsers);
  } else {
    const index = readWorkspaceIndex();
    const nextSiteUsers = index.siteUsers.map((entry) =>
      entry.id === user.id
        ? {
            ...entry,
            password: nextPassword,
          }
        : entry,
    );

    writeWorkspaceIndex({
      ...index,
      siteUsers: nextSiteUsers,
    });
    upsertWorkspaceUsers(nextSiteUsers.map(withPassword));
  }

  updateWorkspaceUserPasswordById(user.id, nextPassword);

  return withoutPassword({
    ...user,
    password: nextPassword,
  });
}

export function getLoginDemoAccounts() {
  ensureWorkspaceSeeded();

  return listAllWorkspaceUsers().map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    password: user.password ?? rolePasswordDefaults[user.role],
    companyId: user.companyId,
  }));
}
