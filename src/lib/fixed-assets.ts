import fs from "node:fs";

import { read, utils, type CellObject, type WorkBook, type WorkSheet } from "xlsx";

import { getCompanyVersionPaths, resolveWorkspaceContext } from "@/lib/company-workspace";

export type FixedAssetScope = {
  companyId?: string;
  versionId?: string;
};

export type FixedAssetLine = {
  id: string;
  label: string;
  openingGross: number;
  additions: number;
  deductions: number;
  closingGross: number;
  openingDep: number;
  depCharge: number;
  depDeductions: number;
  closingDep: number;
  netCurrent: number;
  netPrevious: number;
  ledgerAccounts: string[];
  assetClasses: string[];
};

export type FixedAssetStore = {
  updatedAt: string | null;
  upload: {
    sourceName: string | null;
    uploadedAt: string | null;
  };
  schedules: {
    ppe: FixedAssetLine[];
    cwip: FixedAssetLine[];
    intangible: FixedAssetLine[];
    rou: FixedAssetLine[];
  };
};

type ParsedAssetRow = {
  ledgerAccount: string;
  assetClass: string;
  openingGross: number;
  additions: number;
  deductions: number;
  closingGross: number;
  openingDep: number;
  depCharge: number;
  depDeductions: number;
  closingDep: number;
  netCurrent: number;
  netPrevious: number;
};

type FixedAssetRule = {
  id: string;
  label: string;
  ledgerAccounts?: string[];
  assetClasses?: string[];
};

const ppeRules: FixedAssetRule[] = [
  { id: "factory-building", label: "Factory building", ledgerAccounts: ["20100"] },
  { id: "computers", label: "Computers", ledgerAccounts: ["20601"] },
  { id: "furniture-fixtures", label: "Furniture and fixtures", ledgerAccounts: ["20700"] },
  { id: "plant-machinery", label: "Plant and machinery", ledgerAccounts: ["20400"] },
  { id: "electrical-installation", label: "Electrical installation", ledgerAccounts: ["20500"] },
  { id: "office-equipment", label: "Office equipment", ledgerAccounts: ["20800"] },
];

const cwipRules: FixedAssetRule[] = [
  { id: "cwip-building", label: "Building", ledgerAccounts: ["26101"] },
  { id: "cwip-furniture-fixtures", label: "Furniture and fixtures", ledgerAccounts: ["26106", "26107"] },
  { id: "cwip-plant-machinery", label: "Plant and machinery", ledgerAccounts: ["26100", "26102"] },
  { id: "cwip-electrical-installation", label: "Electrical Installation", ledgerAccounts: ["26103"] },
  { id: "cwip-computers", label: "Computers", ledgerAccounts: ["26104"] },
];

const intangibleRules: FixedAssetRule[] = [
  { id: "technical-license-fees", label: "Technical license fees", ledgerAccounts: ["21103", "21105"] },
  { id: "software", label: "Software", ledgerAccounts: ["21102"] },
];

const rouRules: FixedAssetRule[] = [
  { id: "vehicles", label: "Vehicles", assetClasses: ["2060CG", "2060CL"] },
  { id: "land-building", label: "Land & building", assetClasses: ["2100RU"] },
];

function defaultStore(): FixedAssetStore {
  return {
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
  };
}

function resolveScope(scope?: FixedAssetScope) {
  if (scope?.companyId && scope?.versionId) {
    return scope;
  }

  const context = resolveWorkspaceContext();
  return {
    companyId: scope?.companyId ?? context.company.id,
    versionId: scope?.versionId ?? context.currentVersion.id,
  };
}

function getStorePath(scope?: FixedAssetScope) {
  const resolvedScope = resolveScope(scope);
  return getCompanyVersionPaths(resolvedScope.companyId!, resolvedScope.versionId!).fixedAssetRegisterConfigPath;
}

function getWorkbookPath(scope?: FixedAssetScope) {
  const resolvedScope = resolveScope(scope);
  return getCompanyVersionPaths(resolvedScope.companyId!, resolvedScope.versionId!).fixedAssetRegisterWorkbookPath;
}

function ensureStore(scope?: FixedAssetScope) {
  const filePath = getStorePath(scope);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `${JSON.stringify(defaultStore(), null, 2)}\n`, "utf8");
  }
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();

    if (!normalized || normalized === "-") {
      return 0;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function toAbsolute(value: number) {
  return Math.abs(value);
}

function parseFarRows(buffer: Buffer) {
  const workbook = read(buffer, {
    type: "buffer",
    cellDates: true,
  });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];

  if (!firstSheet) {
    return [] as ParsedAssetRow[];
  }

  const rows = utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    raw: false,
    defval: "",
  });

  return rows
    .map<ParsedAssetRow | null>((row) => {
      const ledgerAccount = String(row["Bal.Sh.Acct APC"] ?? "").trim();
      const assetClass = String(row["Asset Class"] ?? "").trim().toUpperCase();

      if (!ledgerAccount) {
        return null;
      }

      const openingGross = parseNumber(row["APC FY start"]);
      const closingGross = parseNumber(row["Current APC"]);
      const transfer = parseNumber(row["Transfer"]);
      const retirement = toAbsolute(parseNumber(row["Retirement"]));
      const deductions = retirement + Math.max(0, transfer * -1);
      const additions = Math.max(0, closingGross - openingGross + deductions);

      const openingDep = toAbsolute(parseNumber(row["Dep. FY start"]));
      const closingDep = toAbsolute(parseNumber(row["Accumul. dep."]));
      const depTransfer = parseNumber(row["Dep.transfer"]);
      const depRetirement = toAbsolute(parseNumber(row["Dep.retir."]));
      const depDeductions = depRetirement + Math.max(0, depTransfer * -1);
      const depCharge = Math.max(0, closingDep - openingDep + depDeductions);

      return {
        ledgerAccount,
        assetClass,
        openingGross,
        additions,
        deductions,
        closingGross,
        openingDep,
        depCharge,
        depDeductions,
        closingDep,
        netCurrent: parseNumber(row["Curr.bk.val."]),
        netPrevious: parseNumber(row["Bk.val.FY strt"]),
      };
    })
    .filter((row): row is ParsedAssetRow => row !== null);
}

function rowMatchesRule(row: ParsedAssetRow, rule: FixedAssetRule) {
  const ledgerMatch = rule.ledgerAccounts?.includes(row.ledgerAccount) ?? false;
  const classMatch = rule.assetClasses?.includes(row.assetClass) ?? false;
  return ledgerMatch || classMatch;
}

function buildLine(rule: FixedAssetRule, rows: ParsedAssetRow[]): FixedAssetLine {
  const matchedRows = rows.filter((row) => rowMatchesRule(row, rule));

  return matchedRows.reduce<FixedAssetLine>(
    (accumulator, row) => ({
      ...accumulator,
      openingGross: accumulator.openingGross + row.openingGross,
      additions: accumulator.additions + row.additions,
      deductions: accumulator.deductions + row.deductions,
      closingGross: accumulator.closingGross + row.closingGross,
      openingDep: accumulator.openingDep + row.openingDep,
      depCharge: accumulator.depCharge + row.depCharge,
      depDeductions: accumulator.depDeductions + row.depDeductions,
      closingDep: accumulator.closingDep + row.closingDep,
      netCurrent: accumulator.netCurrent + row.netCurrent,
      netPrevious: accumulator.netPrevious + row.netPrevious,
      ledgerAccounts: unique([...accumulator.ledgerAccounts, row.ledgerAccount]),
      assetClasses: unique([...accumulator.assetClasses, row.assetClass]),
    }),
    {
      id: rule.id,
      label: rule.label,
      openingGross: 0,
      additions: 0,
      deductions: 0,
      closingGross: 0,
      openingDep: 0,
      depCharge: 0,
      depDeductions: 0,
      closingDep: 0,
      netCurrent: 0,
      netPrevious: 0,
      ledgerAccounts: [],
      assetClasses: [],
    },
  );
}

function buildStoreFromRows(rows: ParsedAssetRow[], sourceName: string, uploadedAt: string): FixedAssetStore {
  return {
    updatedAt: uploadedAt,
    upload: {
      sourceName,
      uploadedAt,
    },
    schedules: {
      ppe: ppeRules.map((rule) => buildLine(rule, rows)),
      cwip: cwipRules.map((rule) => buildLine(rule, rows)),
      intangible: intangibleRules.map((rule) => buildLine(rule, rows)),
      rou: rouRules.map((rule) => buildLine(rule, rows)),
    },
  };
}

export function readFixedAssetStore(scope?: FixedAssetScope) {
  const filePath = getStorePath(scope);
  ensureStore(scope);

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<FixedAssetStore>;
    const fallback = defaultStore();

    return {
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      upload: {
        sourceName: parsed.upload?.sourceName ?? null,
        uploadedAt: parsed.upload?.uploadedAt ?? null,
      },
      schedules: {
        ppe: Array.isArray(parsed.schedules?.ppe) ? parsed.schedules!.ppe : fallback.schedules.ppe,
        cwip: Array.isArray(parsed.schedules?.cwip) ? parsed.schedules!.cwip : fallback.schedules.cwip,
        intangible: Array.isArray(parsed.schedules?.intangible) ? parsed.schedules!.intangible : fallback.schedules.intangible,
        rou: Array.isArray(parsed.schedules?.rou) ? parsed.schedules!.rou : fallback.schedules.rou,
      },
    } satisfies FixedAssetStore;
  } catch {
    const fallback = defaultStore();
    fs.writeFileSync(filePath, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
    return fallback;
  }
}

export async function saveFixedAssetUpload(
  input: {
    file: File;
  },
  scope?: FixedAssetScope,
) {
  const workbookPath = getWorkbookPath(scope);
  const storePath = getStorePath(scope);
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const uploadedAt = new Date().toISOString();
  const rows = parseFarRows(buffer);
  const store = buildStoreFromRows(rows, input.file.name, uploadedAt);

  fs.writeFileSync(workbookPath, buffer);
  fs.writeFileSync(storePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");

  return store;
}

export function sumFixedAssetLines(lines: FixedAssetLine[]) {
  return lines.reduce(
    (accumulator, line) => ({
      openingGross: accumulator.openingGross + line.openingGross,
      additions: accumulator.additions + line.additions,
      deductions: accumulator.deductions + line.deductions,
      closingGross: accumulator.closingGross + line.closingGross,
      openingDep: accumulator.openingDep + line.openingDep,
      depCharge: accumulator.depCharge + line.depCharge,
      depDeductions: accumulator.depDeductions + line.depDeductions,
      closingDep: accumulator.closingDep + line.closingDep,
      netCurrent: accumulator.netCurrent + line.netCurrent,
      netPrevious: accumulator.netPrevious + line.netPrevious,
    }),
    {
      openingGross: 0,
      additions: 0,
      deductions: 0,
      closingGross: 0,
      openingDep: 0,
      depCharge: 0,
      depDeductions: 0,
      closingDep: 0,
      netCurrent: 0,
      netPrevious: 0,
    },
  );
}

export function hasFixedAssetUpload(store: FixedAssetStore) {
  return Boolean(store.upload.sourceName);
}

function setNumericCell(sheet: WorkSheet | undefined, address: string, value: number) {
  if (!sheet) {
    return;
  }

  const nextCell: CellObject = {
    ...(sheet[address] ?? {}),
    t: "n",
    v: value,
  };

  delete nextCell.w;
  sheet[address] = nextCell;
}

function setMovementRow(sheet: WorkSheet | undefined, rowNumber: number, line: FixedAssetLine) {
  setNumericCell(sheet, `B${rowNumber}`, line.openingGross);
  setNumericCell(sheet, `C${rowNumber}`, line.additions);
  setNumericCell(sheet, `D${rowNumber}`, line.deductions);
  setNumericCell(sheet, `E${rowNumber}`, line.closingGross);
  setNumericCell(sheet, `F${rowNumber}`, line.openingDep);
  setNumericCell(sheet, `G${rowNumber}`, line.depCharge);
  setNumericCell(sheet, `H${rowNumber}`, line.depDeductions);
  setNumericCell(sheet, `I${rowNumber}`, line.closingDep);
  setNumericCell(sheet, `J${rowNumber}`, line.netCurrent);
  setNumericCell(sheet, `K${rowNumber}`, line.netPrevious);
}

function setCwipRow(sheet: WorkSheet | undefined, rowNumber: number, line: FixedAssetLine) {
  const capitalised = Math.max(0, line.openingGross + line.additions - line.deductions - line.closingGross);
  setNumericCell(sheet, `B${rowNumber}`, line.openingGross);
  setNumericCell(sheet, `C${rowNumber}`, line.additions);
  setNumericCell(sheet, `D${rowNumber}`, line.deductions);
  setNumericCell(sheet, `E${rowNumber}`, capitalised);
  setNumericCell(sheet, `F${rowNumber}`, line.closingGross);
}

export function applyFixedAssetSchedulesToWorkbook(workbook: WorkBook, scope?: FixedAssetScope) {
  const store = readFixedAssetStore(scope);

  if (!hasFixedAssetUpload(store)) {
    return store;
  }

  const ppeSheet = workbook.Sheets[" 2"];
  const cwipSheet = workbook.Sheets["3 CWIP"];
  const intangibleSheet = workbook.Sheets[" 4"];

  if (ppeSheet) {
    store.schedules.ppe.forEach((line, index) => setMovementRow(ppeSheet, 10 + index, line));
    setMovementRow(ppeSheet, 17, {
      id: "ppe-total",
      label: "Total",
      ...sumFixedAssetLines(store.schedules.ppe),
      ledgerAccounts: [],
      assetClasses: [],
    });

    store.schedules.rou.forEach((line, index) => setMovementRow(ppeSheet, 24 + index, line));
    setMovementRow(ppeSheet, 27, {
      id: "rou-total",
      label: "Total",
      ...sumFixedAssetLines(store.schedules.rou),
      ledgerAccounts: [],
      assetClasses: [],
    });
  }

  if (cwipSheet) {
    store.schedules.cwip.forEach((line, index) => setCwipRow(cwipSheet, 8 + index, line));
    const total = sumFixedAssetLines(store.schedules.cwip);
    setCwipRow(cwipSheet, 13, {
      id: "cwip-total",
      label: "Total",
      ...total,
      ledgerAccounts: [],
      assetClasses: [],
    });
    setNumericCell(cwipSheet, "B20", total.closingGross);
    setNumericCell(cwipSheet, "F20", total.closingGross);
    setNumericCell(cwipSheet, "B22", total.closingGross);
    setNumericCell(cwipSheet, "F22", total.closingGross);
  }

  if (intangibleSheet) {
    store.schedules.intangible.forEach((line, index) => setMovementRow(intangibleSheet, 10 + index, line));
    setMovementRow(intangibleSheet, 13, {
      id: "intangible-total",
      label: "Total",
      ...sumFixedAssetLines(store.schedules.intangible),
      ledgerAccounts: [],
      assetClasses: [],
    });
  }

  return store;
}
