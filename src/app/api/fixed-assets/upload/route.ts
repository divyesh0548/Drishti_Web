import { NextResponse } from "next/server";

import { requireRequestWorkspaceContext } from "@/lib/auth";
import { saveFixedAssetUpload } from "@/lib/fixed-assets";

export async function POST(request: Request) {
  const formData = await request.formData();
  const companyId = String(formData.get("companyId") ?? "");
  const versionId = String(formData.get("versionId") ?? "");
  const file = formData.get("file") as File | null;

  if (!companyId || !versionId || !file) {
    return NextResponse.json({ error: "companyId, versionId, and file are required." }, { status: 400 });
  }

  const context = await requireRequestWorkspaceContext(request, {
    companyId,
    versionId,
  });

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!context.permissions.canUploadTrialBalance) {
    return NextResponse.json({ error: "You do not have permission to upload the fixed asset register." }, { status: 403 });
  }

  const store = await saveFixedAssetUpload(
    {
      file,
    },
    {
      companyId: context.company.id,
      versionId: context.currentVersion.id,
    },
  );

  return NextResponse.json({ store });
}
