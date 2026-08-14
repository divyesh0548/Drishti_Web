import { requireRequestWorkspaceContext } from "@/lib/auth";
import { buildKeyRatioTable } from "@/lib/key-ratios";
import { getWorkspaceSelection } from "@/lib/portal-context";

export const runtime = "nodejs";

function escapeCsvValue(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function formatRatioValue(value: number, kind: "times" | "percent") {
  return kind === "percent" ? `${value.toFixed(2)}%` : value.toFixed(2);
}

function formatRatioChange(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }

  return `${Math.round(value)}%`;
}

function toFileToken(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const selection = getWorkspaceSelection(searchParams);
  const context = await requireRequestWorkspaceContext(request, selection);

  if (!context) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const ratioTable = await buildKeyRatioTable({
    financialYear: context.currentVersion.financialYear,
    scope: {
      companyId: context.company.id,
      versionId: context.currentVersion.id,
    },
  });

  const lines = [
    ["Particulars", "Formula", "Notes", ratioTable.currentYearLabel, ratioTable.previousYearLabel, "% Change"].map(escapeCsvValue).join(","),
    ...ratioTable.rows.map((row) =>
      [
        row.label,
        row.formula,
        row.notes,
        formatRatioValue(row.current, row.kind),
        formatRatioValue(row.previous, row.kind),
        formatRatioChange(row.changePercent),
      ]
        .map(escapeCsvValue)
        .join(","),
    ),
  ];

  const fileName = `${toFileToken(context.company.name)}-${toFileToken(context.currentVersion.label)}-ratio-analysis.csv`;

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
