import fs from "node:fs";
import path from "node:path";

import { getCompanyVersionPaths, resolveWorkspaceContext } from "@/lib/company-workspace";

export type RatioLedgerSelection = {
  excludedGlNumbers: string[];
  updatedAt: string;
};

export type RatioLedgerConfigStore = {
  updatedAt: string | null;
  ratios: Record<string, RatioLedgerSelection>;
};

export type RatioLedgerScope = {
  companyId?: string;
  versionId?: string;
};

function resolveScope(scope?: RatioLedgerScope) {
  if (scope?.companyId && scope?.versionId) {
    return scope;
  }

  const context = resolveWorkspaceContext();
  return {
    companyId: scope?.companyId ?? context.company.id,
    versionId: scope?.versionId ?? context.currentVersion.id,
  };
}

function getConfigPath(scope?: RatioLedgerScope) {
  const resolvedScope = resolveScope(scope);
  return getCompanyVersionPaths(resolvedScope.companyId!, resolvedScope.versionId!).ratioLedgerConfigPath;
}

function ensureStore(scope?: RatioLedgerScope) {
  const configPath = getConfigPath(scope);
  const directory = path.dirname(configPath);

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  if (!fs.existsSync(configPath)) {
    const initialStore: RatioLedgerConfigStore = {
      updatedAt: null,
      ratios: {},
    };
    fs.writeFileSync(configPath, `${JSON.stringify(initialStore, null, 2)}\n`, "utf8");
  }
}

export function readRatioLedgerConfig(scope?: RatioLedgerScope) {
  const configPath = getConfigPath(scope);
  ensureStore(scope);

  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as Partial<RatioLedgerConfigStore>;
    const ratios = Object.fromEntries(
      Object.entries(parsed.ratios ?? {}).map(([ratioId, selection]) => [
        ratioId,
        {
          excludedGlNumbers: Array.isArray(selection?.excludedGlNumbers)
            ? selection.excludedGlNumbers.filter((glNumber): glNumber is string => typeof glNumber === "string")
            : [],
          updatedAt: typeof selection?.updatedAt === "string" ? selection.updatedAt : new Date(0).toISOString(),
        } satisfies RatioLedgerSelection,
      ]),
    );

    return {
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      ratios,
    } satisfies RatioLedgerConfigStore;
  } catch {
    const fallback: RatioLedgerConfigStore = {
      updatedAt: null,
      ratios: {},
    };
    fs.writeFileSync(configPath, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
    return fallback;
  }
}

export function saveRatioLedgerSelection(
  input: {
    ratioId: string;
    excludedGlNumbers: string[];
  },
  scope?: RatioLedgerScope,
) {
  const store = readRatioLedgerConfig(scope);
  const now = new Date().toISOString();

  store.ratios[input.ratioId] = {
    excludedGlNumbers: [...new Set(input.excludedGlNumbers.map((value) => value.trim()).filter(Boolean))].sort((left, right) =>
      left.localeCompare(right),
    ),
    updatedAt: now,
  };
  store.updatedAt = now;

  fs.writeFileSync(getConfigPath(scope), `${JSON.stringify(store, null, 2)}\n`, "utf8");
  return store.ratios[input.ratioId];
}
