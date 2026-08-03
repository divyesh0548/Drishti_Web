import { GroupingManager } from "@/components/portal/grouping-manager";
import { PageHeader, SectionCard, StatusPill, SummaryLabel } from "@/components/portal/cards";
import { buildAiWorkflowInsights } from "@/lib/ai-workflow";
import { buildKeyRatioTable } from "@/lib/key-ratios";
import { assertRouteAccess } from "@/lib/navigation";
import { resolveWorkspaceContextFromSearchParams } from "@/lib/portal-context";
import { getLedgerGroupingOptions, getLedgerGroupingOverrideList, getLedgerSubgroupOptions } from "@/lib/ledger-groupings";
import { getTrialBalanceSnapshot } from "@/lib/trial-balance";

export default async function MappingStudioPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const context = await resolveWorkspaceContextFromSearchParams(searchParams ? await searchParams : undefined);
  assertRouteAccess(context.currentUser.role, "/mapping-studio");
  const scope = {
    companyId: context.company.id,
    versionId: context.currentVersion.id,
  };
  const snapshot = getTrialBalanceSnapshot(scope);
  const groupingOptions = getLedgerGroupingOptions(scope);
  const subgroupOptions = getLedgerSubgroupOptions(scope);
  const savedOverrides = getLedgerGroupingOverrideList(scope);
  const mappedCount = snapshot.rows.filter((row) => row.groupingKey && row.noteNumber).length;
  const unmappedCount = snapshot.rows.length - mappedCount;
  const ratioTable = buildKeyRatioTable({
    financialYear: context.currentVersion.financialYear,
    scope,
  });
  const aiInsights = buildAiWorkflowInsights({
    snapshot,
    ratioRows: ratioTable.rows,
    companyName: context.company.name,
    versionLabel: context.currentVersion.label,
    financialYear: context.currentVersion.financialYear,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${context.company.name} | ${context.currentVersion.label}`}
        title="Ledger mapping studio"
        description="Review grouping confidence, override ledger routing, and keep company-version mapping logic clean before statement generation."
        meta={
          <>
            <StatusPill label={`${savedOverrides.length} saved overrides`} tone="positive" />
            <span className="inline-flex items-center text-sm font-medium text-slate-500 dark:text-slate-400">
              {snapshot.rows.length} source ledgers
            </span>
          </>
        }
      />

      <SectionCard
        title="Ledger Grouping"
        eyebrow="View the current selection and change ledger grouping for this version"
        action={
          <div className="flex flex-wrap gap-2">
            <SummaryLabel label={`${mappedCount} mapped`} tone="positive" width="10rem" />
            <SummaryLabel label={`${unmappedCount} unmapped`} tone={unmappedCount > 0 ? "warning" : "neutral"} width="10rem" />
          </div>
        }
      >
        <GroupingManager
          key={`${context.company.id}-${context.currentVersion.id}`}
          rows={snapshot.rows}
          options={groupingOptions}
          subgroupOptions={subgroupOptions}
          savedOverrides={savedOverrides}
          companyId={context.company.id}
          versionId={context.currentVersion.id}
          canEdit={context.permissions.canManageGrouping}
        />
      </SectionCard>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr] xl:items-start">
        <SectionCard title="AI GL classification engine" eyebrow="Confidence-driven account routing">
          <div className="space-y-4">
            {aiInsights.classificationSummary.map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-slate-900/60">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-slate-950 dark:text-slate-50">{item.label}</p>
                  <StatusPill
                    label={`${item.confidence} confidence`}
                    tone={item.confidence === "High" ? "positive" : item.confidence === "Medium" ? "warning" : "neutral"}
                  />
                </div>
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{item.count} ledgers currently contribute to this classification layer.</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Mapping templates and AI suggestions" eyebrow="Company-wise and industry-ready mapping">
          <div className="space-y-4">
            {aiInsights.mappingSuggestions.map((suggestion) => (
              <div key={suggestion.field} className="rounded-xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/60">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-semibold text-slate-950 dark:text-slate-50">{suggestion.field}</p>
                  <StatusPill
                    label={`${suggestion.confidence} confidence`}
                    tone={suggestion.confidence === "High" ? "positive" : suggestion.confidence === "Medium" ? "warning" : "neutral"}
                  />
                </div>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Suggested source: {suggestion.detectedFrom}</p>
                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{suggestion.detail}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
