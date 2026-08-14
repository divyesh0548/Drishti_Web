import { NextResponse } from "next/server";

import {
  attemptLogin,
  authCookieName,
  createSessionCookieValue,
  getSessionCookieOptions,
  postAuthenticationPath,
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

  const user = await attemptLogin(email, password);

  if (!user) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const response = NextResponse.json({
    user,
    redirectTo: postAuthenticationPath(user),
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
