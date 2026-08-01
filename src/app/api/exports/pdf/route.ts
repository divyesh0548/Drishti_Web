import { buildStatementPdf } from "@/lib/statement-export";
import { requireRequestWorkspaceContext } from "@/lib/auth";
import { getCompanyVersionPaths } from "@/lib/company-workspace";
import { getWorkspaceSelection } from "@/lib/portal-context";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

async function ensurePdfKitAssets() {
  const sourcePath = path.join(process.cwd(), "node_modules", "pdfkit", "js", "data");
  const targetPath = path.join(process.cwd(), ".next", "server", "chunks", "data");

  try {
    await fs.access(path.join(targetPath, "Helvetica.afm"));
  } catch {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.cp(sourcePath, targetPath, { recursive: true });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const selection = getWorkspaceSelection(searchParams);
  const context = requireRequestWorkspaceContext(request, selection);

  if (!context) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
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
