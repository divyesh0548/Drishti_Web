import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { getAuthenticatedUser, postAuthenticationPath } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getAuthenticatedUser();

  if (user) {
    redirect(postAuthenticationPath(user));
  }

  return <LoginForm />;
}
