import { NextResponse } from "next/server";

import { saveAgeingUpload } from "@/lib/ageing";
import { requireRequestWorkspaceContext } from "@/lib/auth";

export async function POST(request: Request) {
  const formData = await request.formData();
  const companyId = String(formData.get("companyId") ?? "");
  const versionId = String(formData.get("versionId") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const file = formData.get("file") as File | null;

  if (!companyId || !versionId || (kind !== "receivables" && kind !== "payables") || !file) {
    return NextResponse.json({ error: "companyId, versionId, kind, and file are required." }, { status: 400 });
  }

  const context = await requireRequestWorkspaceContext(request, {
    companyId,
    versionId,
  });

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!context.permissions.canManageGrouping) {
    return NextResponse.json({ error: "You do not have permission to upload ageing ledgers." }, { status: 403 });
  }

  const upload = await saveAgeingUpload(
    {
      kind,
      file,
    },
    {
      companyId: context.company.id,
      versionId: context.currentVersion.id,
    },
  );

  return NextResponse.json({ upload });
}
