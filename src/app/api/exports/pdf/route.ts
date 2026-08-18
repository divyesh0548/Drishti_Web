import { buildStatementPdf } from "@/lib/statement-export";
import { requireRequestWorkspaceContext } from "@/lib/auth";
import { getCompanyVersionPaths } from "@/lib/company-workspace";
import { companyHasMasterGrouping, MASTER_GROUPING_REQUIRED_ERROR } from "@/lib/grouping-database";
import { getWorkspaceSelection } from "@/lib/portal-context";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

async function ensurePdfKitAssets() {
  const sourcePath = path.join(process.cwd(), "node_modules", "pdfkit", "js", "data");
  const targetPaths = [
    path.join(process.cwd(), ".next", "server", "chunks", "data"),
    path.join(process.cwd(), ".next", "server", "vendor-chunks", "data"),
  ];

  await Promise.all(
    targetPaths.map(async (targetPath) => {
      try {
        await fs.access(path.join(targetPath, "Helvetica.afm"));
      } catch {
        await fs.mkdir(targetPath, { recursive: true });
        await fs.cp(sourcePath, targetPath, { recursive: true });
      }
    }),
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const selection = getWorkspaceSelection(searchParams);
  const context = await requireRequestWorkspaceContext(request, selection);

  if (!context) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!(await companyHasMasterGrouping(context.company.id))) {
    return Response.json({ error: MASTER_GROUPING_REQUIRED_ERROR }, { status: 409 });
  }

  const exportPath = getCompanyVersionPaths(context.company.id, context.currentVersion.id).exportedPdfPath;
  await ensurePdfKitAssets();
  const pdf = await buildStatementPdf({
    companyId: context.company.id,
    versionId: context.currentVersion.id,
  });
  await fs.mkdir(getCompanyVersionPaths(context.company.id, context.currentVersion.id).versionDirectory, { recursive: true });
  await fs.writeFile(exportPath, pdf);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="financial-statements-schedule-iii.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
