import { NextResponse } from "next/server";

import { authCookieName, getSessionCookieOptions } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set(authCookieName, "", {
    ...getSessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}
