import { PageHeader, SectionCard, StatusPill } from "@/components/portal/cards";
import { VersionManager } from "@/components/portal/version-manager";
import { assertRouteAccess } from "@/lib/navigation";
import { resolveWorkspaceContextFromSearchParams } from "@/lib/portal-context";
import { getTrialBalanceSnapshot } from "@/lib/trial-balance";

export default async function ImportCenterPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const context = await resolveWorkspaceContextFromSearchParams(searchParams ? await searchParams : undefined);
  assertRouteAccess(context.currentUser.role, "/import-center");
  const snapshot = getTrialBalanceSnapshot({
    companyId: context.company.id,
    versionId: context.currentVersion.id,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${context.company.name} | ${context.currentVersion.label}`}
        title="Trial balance upload and version control"
        description="Manage workbook ingestion with a guided import sequence, current validation visibility, and version-aware storage for each company workspace."
        meta={
          <>
            <StatusPill label={`${context.versions.length} versions`} tone="positive" />
            <StatusPill label={`${snapshot.previewRows.length} preview rows`} tone="neutral" />
          </>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.9fr)] xl:items-start">
        <SectionCard
          title="Versioned trial balance uploads"
          eyebrow={`${context.company.name} | ${context.currentUser.role}`}
          action={<StatusPill label={`${context.versions.length} versions`} tone="positive" />}
        >
          <VersionManager context={context} />
        </SectionCard>

        <SectionCard title="Validation findings" eyebrow="Derived from workbook controls">
          <div className="space-y-4">
            {snapshot.reviewFlags.map((issue) => (
              <div key={issue.title} className="rounded-[1.35rem] border border-slate-200/70 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-900/60">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{issue.title}</p>
                  <StatusPill
                    label={issue.tone === "critical" ? "Critical" : issue.tone === "warning" ? "Review" : "OK"}
                    tone={issue.tone}
                  />
                </div>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{issue.detail}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
