import { parseCompanyId } from "@/lib/company-id";
import { loadCompaniesFromDb } from "@/lib/company-workspace";
import { getTrialBalanceSnapshot } from "@/lib/trial-balance";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = parseCompanyId(searchParams.get("company"));
  const versionId = searchParams.get("version");
  await loadCompaniesFromDb();
  const snapshot = await getTrialBalanceSnapshot(
    companyId && versionId
      ? {
          companyId,
          versionId,
        }
      : undefined,
  );
  const mappedCount = snapshot.rows.filter((row) => row.noteNumber).length;
  const pendingReviewCount = snapshot.reviewFlags.filter((flag) => flag.tone !== "neutral").length;

  return NextResponse.json({
    metrics: snapshot.dashboardMetrics,
    reviewFlags: snapshot.reviewFlags,
    balanceSheet: snapshot.balanceSheet,
    profitAndLoss: snapshot.profitAndLoss,
    summary: {
      mappedCount,
      pendingReviewCount,
      lastModified: snapshot.lastModified,
      rowCount: snapshot.rowCount,
    },
  });
}
