import { V8StatementsView } from "@/components/portal/v8-statements-view";
import { assertRouteAccess } from "@/lib/navigation";
import { resolveWorkspaceContextFromSearchParams } from "@/lib/portal-context";
import { buildV8FinancialModel, getV8WorkbookSheet } from "@/lib/v8-financials";

export default async function StatementsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const context = await resolveWorkspaceContextFromSearchParams(searchParams ? await searchParams : undefined);
  assertRouteAccess(context.currentUser.role, "/statements");
  const scope = {
    companyId: context.company.id,
    versionId: context.currentVersion.id,
  };
  const model = buildV8FinancialModel(scope);
  const initialSheet = getV8WorkbookSheet(model.sheets[1]?.name ?? model.sheets[0]?.name ?? "README", scope);

  if (!initialSheet) {
    return null;
  }

  return <V8StatementsView model={model} initialSheet={initialSheet} />;
}
