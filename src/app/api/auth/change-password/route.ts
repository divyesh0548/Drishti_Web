import { NextResponse } from "next/server";

import {
  changePasswordForAuthenticatedUser,
  postAuthenticationPath,
  requireRequestUser,
} from "@/lib/auth";

function isStrongEnoughPassword(password: string) {
  return password.length >= 8;
}

export async function POST(request: Request) {
  const user = await requireRequestUser(request);

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const body = (await request.json()) as {
    currentPassword?: string;
    password?: string;
    confirmPassword?: string;
  };

  const currentPassword = body.currentPassword?.trim() ?? "";
  const password = body.password?.trim() ?? "";
  const confirmPassword = body.confirmPassword?.trim() ?? "";

  if (!currentPassword || !password || !confirmPassword) {
    return NextResponse.json(
      { error: "Current password, new password, and confirm password are required." },
      { status: 400 },
    );
  }

  if (!isStrongEnoughPassword(password)) {
    return NextResponse.json({ error: "Password must be at least 8 characters long." }, { status: 400 });
  }

  if (password !== confirmPassword) {
    return NextResponse.json({ error: "New password and confirm password must match." }, { status: 400 });
  }

  if (password === currentPassword) {
    return NextResponse.json({ error: "New password must be different from the temporary password." }, { status: 400 });
  }

  const updated = await changePasswordForAuthenticatedUser({
    userId: user.id,
    currentPassword,
    nextPassword: password,
  });

  if (!updated) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }

  return NextResponse.json({
    user: updated,
    redirectTo: postAuthenticationPath(updated),
    message: "Password updated successfully.",
  });
}
