import { requireWorkspaceContext } from "@/lib/auth";

export type WorkspaceSelection = {
  companyId?: string;
  versionId?: string;
};

type SearchParamsInput =
  | Record<string, string | string[] | undefined>
  | URLSearchParams
  | undefined;

function readValue(input: SearchParamsInput, key: string) {
  if (!input) {
    return undefined;
  }

  if (input instanceof URLSearchParams) {
    return input.get(key) ?? undefined;
  }

  const value = input[key];
  return Array.isArray(value) ? value[0] : value;
}

export function getWorkspaceSelection(input?: SearchParamsInput): WorkspaceSelection {
  return {
    companyId: readValue(input, "company"),
    versionId: readValue(input, "version"),
  };
}

export async function resolveWorkspaceContextFromSearchParams(input?: SearchParamsInput) {
  return requireWorkspaceContext(getWorkspaceSelection(input));
}

export function buildWorkspaceQuery(selection: WorkspaceSelection) {
  const params = new URLSearchParams();

  if (selection.companyId) {
    params.set("company", selection.companyId);
  }

  if (selection.versionId) {
    params.set("version", selection.versionId);
  }

  return params.toString();
}
