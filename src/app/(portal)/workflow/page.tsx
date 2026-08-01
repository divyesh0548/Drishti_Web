import { PageHeader, SectionCard, StatusPill } from "@/components/portal/cards";
import { assertRouteAccess } from "@/lib/navigation";
import { resolveWorkspaceContextFromSearchParams } from "@/lib/portal-context";
import { getTrialBalanceSnapshot } from "@/lib/trial-balance";

export default async function WorkflowPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const context = await resolveWorkspaceContextFromSearchParams(searchParams ? await searchParams : undefined);
  assertRouteAccess(context.currentUser.role, "/workflow");
  const snapshot = getTrialBalanceSnapshot({
    companyId: context.company.id,
    versionId: context.currentVersion.id,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${context.company.name} | ${context.currentVersion.label}`}
        title="Preparation workflow and accounting review"
        description="Track the maker-checker-reviewer flow, confirm stage readiness, and keep assumptions visible before statements move to final issue."
        meta={<StatusPill label={`${snapshot.workflowSteps.length} tracked stages`} tone="positive" />}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
      <SectionCard title="Preparation workflow" eyebrow={`${context.company.name} | ${context.currentVersion.label}`}>
        <div className="space-y-4">
          {snapshot.workflowSteps.map((task) => (
            <div
              key={task.step}
              className="rounded-[1.35rem] border border-slate-200/70 bg-slate-50/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium">{task.step}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{task.detail}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill label={task.status} tone={task.status === "Needs attention" ? "warning" : "neutral"} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Accounting assumptions" eyebrow="Review before issue">
        <div className="space-y-4">
          {snapshot.accountingAssumptions.map((entry) => (
            <div key={entry} className="rounded-[1.35rem] border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/60">
              <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{entry}</p>
            </div>
          ))}
        </div>
      </SectionCard>
      </div>
    </div>
  );
}
