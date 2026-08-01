import { requireAuthenticatedUser } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await requireAuthenticatedUser();

  return <AppShell currentUser={currentUser}>{children}</AppShell>;
}
