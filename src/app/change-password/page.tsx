import { redirect } from "next/navigation";

import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { getAuthenticatedUser, postAuthenticationPath } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.tempLogin) {
    redirect(postAuthenticationPath(user));
  }

  return <ChangePasswordForm email={user.email} />;
}
