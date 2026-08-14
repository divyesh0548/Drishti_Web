import { loadCompaniesFromDb } from "@/lib/company-workspace";
import { getTrialBalanceSnapshot } from "@/lib/trial-balance";
import { NextResponse } from "next/server";

export async function GET() {
  await loadCompaniesFromDb();
  const snapshot = await getTrialBalanceSnapshot();

  return NextResponse.json({
    source: {
      name: snapshot.sourceName,
      path: snapshot.sourcePath,
      lastModified: snapshot.lastModified,
      rowCount: snapshot.rowCount,
    },
    rows: snapshot.previewRows,
  });
}
