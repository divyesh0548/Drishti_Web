import { V8StatementsView } from "@/components/portal/v8-statements-view";
import { assertRouteAccess } from "@/lib/navigation";
import { resolveWorkspaceContextFromSearchParams } from "@/lib/portal-context";
import { getStatementPack } from "@/lib/statement-pack";
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
  const [model, initialSheet, pack] = await Promise.all([
    buildV8FinancialModel(scope),
    getV8WorkbookSheet("BS", scope),
    getStatementPack(scope),
  ]);

  if (!initialSheet) {
    return null;
  }

  return (
    <V8StatementsView
      model={model}
      initialSheet={initialSheet}
      balanceSheetRows={pack.balanceSheet.rows}
      profitAndLossRows={pack.profitAndLoss.rows}
      balanceSheetNotes={pack.notes
        .filter((note) => note.kind === "table" && note.statementArea === "balance-sheet")
        .map((note) => ({
          noteNumber: note.noteNumber,
          title: note.title,
        }))}
      profitAndLossNotes={pack.notes
        .filter((note) => note.kind === "table" && note.statementArea === "profit-and-loss")
        .map((note) => ({
          noteNumber: note.noteNumber,
          title: note.title,
        }))}
    />
  );
}
