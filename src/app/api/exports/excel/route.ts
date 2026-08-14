import { buildStatementWorkbookExport } from "@/lib/export/excel";
import { requireRequestWorkspaceContext } from "@/lib/auth";
import { getWorkspaceSelection } from "@/lib/portal-context";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const selection = getWorkspaceSelection(searchParams);
  const context = await requireRequestWorkspaceContext(request, selection);

  if (!context) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { buffer, fileName } = await buildStatementWorkbookExport({
    companyId: context.company.id,
    versionId: context.currentVersion.id,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
