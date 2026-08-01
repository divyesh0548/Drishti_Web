import { getTrialBalanceSnapshot } from "@/lib/trial-balance";
import { NextResponse } from "next/server";

export async function GET() {
  const snapshot = getTrialBalanceSnapshot();

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
