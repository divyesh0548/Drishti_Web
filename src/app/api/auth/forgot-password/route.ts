import { NextResponse } from "next/server";

import { resetPasswordForWorkspaceUser } from "@/lib/auth";

function isStrongEnoughPassword(password: string) {
  return password.length >= 8;
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
    confirmPassword?: string;
  };

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password?.trim() ?? "";
  const confirmPassword = body.confirmPassword?.trim() ?? "";

  if (!email || !password || !confirmPassword) {
    return NextResponse.json({ error: "Email, new password, and confirm password are required." }, { status: 400 });
  }

  if (!isStrongEnoughPassword(password)) {
    return NextResponse.json({ error: "Password must be at least 8 characters long." }, { status: 400 });
  }

  if (password !== confirmPassword) {
    return NextResponse.json({ error: "New password and confirm password must match." }, { status: 400 });
  }

  const user = resetPasswordForWorkspaceUser(email, password);

  if (!user) {
    return NextResponse.json({ error: "No active account was found for this email." }, { status: 404 });
  }

  return NextResponse.json({
    message: "Password updated successfully. You can now sign in with your new password.",
  });
}
