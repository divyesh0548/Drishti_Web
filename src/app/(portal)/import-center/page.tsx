import { PageHeader, SectionCard, StatusPill } from "@/components/portal/cards";
import { VersionManager } from "@/components/portal/version-manager";
import { assertRouteAccess } from "@/lib/navigation";
import { resolveWorkspaceCompanyFromSearchParams } from "@/lib/portal-context";
import { getTrialBalanceSnapshot } from "@/lib/trial-balance";

export default async function ImportCenterPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const context = await resolveWorkspaceCompanyFromSearchParams(searchParams ? await searchParams : undefined);
  assertRouteAccess(context.currentUser.role, "/import-center");

  const hasVersion = Boolean(context.currentVersion);
  const snapshot = hasVersion
    ? await getTrialBalanceSnapshot({
        companyId: context.company.id,
        versionId: context.currentVersion!.id,
      })
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${context.company.name} | ${context.currentVersion?.label ?? "No version"}`}
        title="Trial balance upload and version control"
        description={
          hasVersion
            ? "Manage workbook ingestion with a guided import sequence, current validation visibility, and version-aware storage for each company workspace."
            : "Upload the first trial balance workbook to create Version 1 for this company. Mapping, statements, and reports unlock after that."
        }
        meta={
          <>
            <StatusPill label={`${context.versions.length} versions`} tone="positive" />
            <StatusPill label={`${snapshot?.previewRows.length ?? 0} preview rows`} tone="neutral" />
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
            {!snapshot ? (
              <div className="rounded-[1.35rem] border border-dashed border-slate-200/80 bg-slate-50/70 p-4 text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-400">
                Validation findings appear after the first trial balance upload creates a version.
              </div>
            ) : (
              snapshot.reviewFlags.map((issue) => (
                <div key={issue.title} className="rounded-[1.35rem] border border-slate-200/70 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-900/60">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{issue.title}</p>
                    <StatusPill
                      label={issue.tone === "critical" ? "Critical" : issue.tone === "warning" ? "Review" : "OK"}
                      tone={issue.tone}
                    />
                  </div>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{issue.detail}</p>
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
