import Link from "next/link";

import { MetricTile, SectionCard, StatusPill } from "@/components/portal/cards";
import { companyHasMasterGrouping } from "@/lib/grouping-database";
import { assertRouteAccess, canAccessRoute } from "@/lib/navigation";
import { resolveWorkspaceCompanyFromSearchParams } from "@/lib/portal-context";
import { getTrialBalanceSnapshot } from "@/lib/trial-balance";
import { formatCurrency } from "@/lib/utils";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const context = await resolveWorkspaceCompanyFromSearchParams(searchParams ? await searchParams : undefined);
  assertRouteAccess(context.currentUser.role, "/dashboard");

  const canImport = canAccessRoute(context.currentUser.role, "/import-center");
  const hasMasterGrouping = await companyHasMasterGrouping(context.company.id);

  if (!context.currentVersion || !hasMasterGrouping) {
    const needsMasterGrouping = !hasMasterGrouping;

    return (
      <div className="space-y-6">
        <SectionCard
          title={needsMasterGrouping ? "Master grouping required" : "No version yet"}
          eyebrow={context.company.name}
        >
          <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
            {needsMasterGrouping
              ? canImport
                ? "This company does not have a master grouping file yet. Upload it in Imports before trial balance, mapping, statements, and reports can be used."
                : "This company does not have a master grouping file yet. Ask the site admin to upload it before work can continue."
              : canImport
                ? "This company does not have a trial balance version yet. Upload a workbook in Imports to create Version 1 and unlock mapping, statements, and reports."
                : "This company does not have a trial balance version yet. Ask a company admin or finance user to upload the first trial balance."}
          </p>
          {canImport ? (
            <Link
              href={`/import-center?company=${context.company.id}`}
              className="mt-4 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Go to Imports
            </Link>
          ) : null}
        </SectionCard>
      </div>
    );
  }

  const snapshot = await getTrialBalanceSnapshot({
    companyId: context.company.id,
    versionId: context.currentVersion.id,
  });
  const visibleDashboardMetrics = snapshot.dashboardMetrics.filter(
    (metric) => !["Total assets", "Revenue from operations", "Profit after tax"].includes(metric.label),
  );
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {visibleDashboardMetrics.map((metric) => (
          <MetricTile key={metric.label} metric={metric} />
        ))}
      </section>

      <section>
        <SectionCard title="Review queue" eyebrow="Flags and current focus">
          <div className="space-y-4">
            <div className="rounded-[1.4rem] border border-slate-200/70 bg-slate-50/80 px-5 py-4 dark:border-white/10 dark:bg-slate-900/60">
              <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">
                {new Intl.DateTimeFormat("en-IN", { dateStyle: "full" }).format(new Date("2026-07-29"))}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Role-aware workspace context for {context.currentUser.role}</p>
            </div>

            {snapshot.reviewFlags.map((flag) => (
              <div key={flag.title} className="rounded-[1.4rem] border border-slate-200/70 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-950/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950 dark:text-slate-50">{flag.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{flag.detail}</p>
                  </div>
                  <StatusPill
                    label={flag.tone === "critical" ? "Critical" : flag.tone === "warning" ? "Review" : "Stable"}
                    tone={flag.tone}
                  />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>

      <section>
        <SectionCard title="Balance sheet snapshot" eyebrow="Draft statement lines">
          <div className="enterprise-table">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-semibold">Line item</th>
                  <th className="px-4 py-3 font-semibold">Current year</th>
                  <th className="px-4 py-3 font-semibold">Previous year</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.balanceSheet.assets.map((line) => (
                  <tr key={line.label} className="border-t border-slate-200/70 dark:border-white/10">
                    <td className="px-4 py-3 font-medium text-slate-950 dark:text-slate-50">{line.label}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{formatCurrency(line.current)}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{formatCurrency(line.previous)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
