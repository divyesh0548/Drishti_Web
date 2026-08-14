import type { Route } from "next";
import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await requireAuthenticatedUser();

  if (currentUser.tempLogin) {
    redirect("/change-password" as Route);
  }

  return <AppShell currentUser={currentUser}>{children}</AppShell>;
}
