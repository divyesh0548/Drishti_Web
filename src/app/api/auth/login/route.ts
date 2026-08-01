import { NextResponse } from "next/server";

import {
  attemptLogin,
  authCookieName,
  createSessionCookieValue,
  getSessionCookieOptions,
} from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
  };

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password?.trim() ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const user = attemptLogin(email, password);

  if (!user) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const response = NextResponse.json({
    user,
    redirectTo: user.companyId ? `/dashboard?company=${user.companyId}` : "/dashboard",
  });

  response.cookies.set(
    authCookieName,
    createSessionCookieValue({
      userId: user.id,
    }),
    getSessionCookieOptions(),
  );

  return response;
}
