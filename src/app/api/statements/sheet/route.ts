import { getV8WorkbookSheet } from "@/lib/v8-financials";
import { requireRequestWorkspaceContext } from "@/lib/auth";
import { getWorkspaceSelection } from "@/lib/portal-context";
import { parseStatementLineOverrides } from "@/lib/statement-line-overrides";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  const selection = getWorkspaceSelection(searchParams);

  if (!name) {
    return Response.json({ error: "Sheet name is required." }, { status: 400 });
  }

  const context = await requireRequestWorkspaceContext(request, selection);

  if (!context) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const sheet = await getV8WorkbookSheet(name, {
    companyId: context.company.id,
    versionId: context.currentVersion.id,
    statementLineOverrides: parseStatementLineOverrides(
      searchParams.get("statementOverrides"),
    ),
  });

  if (!sheet) {
    return Response.json({ error: "Sheet not found." }, { status: 404 });
  }

  return Response.json(sheet, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
