import { NextResponse } from "next/server";

import { requireRequestUser } from "@/lib/auth";
import { upsertMasterGroupingFromWorkbook } from "@/lib/grouping-database";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireRequestUser(request);

  if (!user || user.tempLogin) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (user.role !== "SITE_ADMIN") {
    return NextResponse.json({ error: "Only the site admin can upload the global master grouping workbook." }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("masterGroupingFile");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Master grouping Excel file is required." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await upsertMasterGroupingFromWorkbook(buffer);

    return NextResponse.json({
      result,
      message: `Master grouping updated for all companies. ${result.ledgersCreated} new GL codes, ${result.ledgersUpdated} overridden.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload master grouping workbook.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
