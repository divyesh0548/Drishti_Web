import { redirect } from "next/navigation";

import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getAuthenticatedUser();
  redirect(user ? (user.companyId ? `/dashboard?company=${user.companyId}` : "/dashboard") : "/login");
}
