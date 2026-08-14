import { redirect } from "next/navigation";

import { getAuthenticatedUser, postAuthenticationPath } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getAuthenticatedUser();
  redirect(user ? postAuthenticationPath(user) : "/login");
}
