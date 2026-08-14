import { PageHeader, SectionCard, StatusPill } from "@/components/portal/cards";
import { assertRouteAccess } from "@/lib/navigation";
import { resolveWorkspaceContextFromSearchParams } from "@/lib/portal-context";
import { getTrialBalanceSnapshot } from "@/lib/trial-balance";
import { formatCurrency } from "@/lib/utils";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const context = await resolveWorkspaceContextFromSearchParams(searchParams ? await searchParams : undefined);
  assertRouteAccess(context.currentUser.role, "/clients");
  const snapshot = await getTrialBalanceSnapshot({
    companyId: context.company.id,
    versionId: context.currentVersion.id,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${context.company.name} | ${context.currentVersion.label}`}
        title="Company workspace and source preview"
        description="Review the active company, workbook source, and ledger sample before moving into mapping and financial statement preparation."
        meta={
          <>
            <StatusPill label={context.currentUser.role} tone="positive" />
            <StatusPill label={snapshot.sourceName} tone="neutral" />
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <SectionCard
        title="Company workspace"
        eyebrow="Selected company and version"
        action={<StatusPill label={context.currentUser.role} tone="positive" />}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { label: "Company", value: context.company.name },
            { label: "Active version", value: context.currentVersion.label },
            { label: "Trial balance workbook", value: snapshot.sourceName },
            { label: "Version count", value: context.versions.length.toString() },
          ].map((item) => (
            <div key={item.label} className="rounded-[1.3rem] border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm dark:border-white/10 dark:from-slate-950 dark:to-slate-900/70">
              <p className="text-sm text-slate-500 dark:text-slate-400">{item.label}</p>
              <p className="mt-2 break-all text-sm font-medium">{item.value}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Source ledger preview" eyebrow={`${context.currentVersion.financialYear} | First 20 workbook rows`}>
        <div className="enterprise-table">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3 font-medium">GL</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Current year</th>
                <th className="px-4 py-3 font-medium">Previous year</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.previewRows.map((row) => (
                <tr key={row.glNumber} className="border-t border-slate-200/70 dark:border-white/10">
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{row.glNumber}</td>
                  <td className="px-4 py-3 font-medium">{row.glDescription}</td>
                  <td className="px-4 py-3">{formatCurrency(row.currentYear)}</td>
                  <td className="px-4 py-3">{formatCurrency(row.previousYear)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
      </div>
    </div>
  );
}
