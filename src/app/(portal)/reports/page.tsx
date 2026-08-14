import { DrishtiAiCopilot } from "@/components/portal/drishti-ai-copilot";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { PageHeader, SectionCard, StatusPill } from "@/components/portal/cards";
import { PortalButton } from "@/components/ui/portal-button";
import { buildAiWorkflowInsights } from "@/lib/ai-workflow";
import { buildKeyRatioTable } from "@/lib/key-ratios";
import { assertRouteAccess } from "@/lib/navigation";
import { buildWorkspaceQuery, resolveWorkspaceContextFromSearchParams } from "@/lib/portal-context";
import { getStatementPack } from "@/lib/statement-pack";
import { getTrialBalanceSnapshot } from "@/lib/trial-balance";
import { formatCurrency } from "@/lib/utils";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const context = await resolveWorkspaceContextFromSearchParams(searchParams ? await searchParams : undefined);
  assertRouteAccess(context.currentUser.role, "/reports");
  const pack = await getStatementPack({
    companyId: context.company.id,
    versionId: context.currentVersion.id,
  });
  const snapshot = await getTrialBalanceSnapshot({
    companyId: context.company.id,
    versionId: context.currentVersion.id,
  });
  const ratioTable = await buildKeyRatioTable({
    financialYear: context.currentVersion.financialYear,
    scope: {
      companyId: context.company.id,
      versionId: context.currentVersion.id,
    },
  });
  const aiInsights = buildAiWorkflowInsights({
    snapshot,
    ratioRows: ratioTable.rows,
    companyName: context.company.name,
    versionLabel: context.currentVersion.label,
    financialYear: context.currentVersion.financialYear,
  });
  const baseQuery = buildWorkspaceQuery({
    companyId: context.company.id,
    versionId: context.currentVersion.id,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${context.company.name} | ${context.currentVersion.label}`}
        title="Export center and report delivery"
        description="Generate workbook and PDF outputs, review issue readiness, and compare prior statement versions from one distribution workspace."
        meta={
          <>
            <StatusPill label={`${context.versions.length} saved versions`} tone="positive" />
            <StatusPill label={`${pack.reviewFlags.length} review checks`} tone={pack.reviewFlags.length > 0 ? "warning" : "positive"} />
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <SectionCard title="Export center" eyebrow="Report delivery" className="h-fit w-full">
          <div className="space-y-4">
            {[
              {
                title: "Shared V-8 Excel workbook",
                status: "Ready now",
                format: "Common BS, PL, Cash Flow, SOCIE, and grouped note tabs for every company",
                href: `/api/exports/excel?${baseQuery}`,
                icon: FileSpreadsheet,
              },
              {
                title: "V-8 style PDF pack",
                status: "Ready now",
                format: "Statement pack with grouped notes to accounts",
                href: `/api/exports/pdf?${baseQuery}`,
                icon: FileText,
              },
              {
                title: "Review memo",
                status: pack.reviewFlags.length > 0 ? "Needs review" : "Clear",
                format: `${pack.reviewFlags.length} control checks carried into assumptions note`,
                href: `/statements?${baseQuery}`,
                icon: Download,
              },
            ].map((bundle) => (
              <div
                key={bundle.title}
                className="grid gap-3 rounded-[1.35rem] border border-slate-200/70 bg-slate-50/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              >
                <div className="min-w-0">
                  <p className="font-medium">{bundle.title}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{bundle.format}</p>
                </div>
                <div className="flex items-center gap-3 justify-self-start md:justify-self-end">
                  <StatusPill
                    label={bundle.status}
                    tone={bundle.status === "Ready now" || bundle.status === "Clear" ? "positive" : "warning"}
                    className="min-w-[6.75rem]"
                  />
                  <PortalButton
                    variant="primary"
                    href={bundle.href}
                    startIcon={<bundle.icon className="h-4 w-4" />}
                    sx={{ minWidth: "6.5rem" }}
                  >
                    Open
                  </PortalButton>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Generated report highlights" eyebrow="From the imported trial balance" className="h-fit w-full">
          <div className="space-y-4">
            {[
              `Balance sheet totals currently reconcile at ${formatCurrency(pack.balanceSheet.totalCurrent)} for the current year.`,
              `Profit after tax currently derives to ${formatCurrency(pack.profitAndLoss.profitAfterTax)} from the imported workbook.`,
              "The portal preview and exports now follow the shared V-8 statement layout with grouped notes sections.",
            ].map((item) => (
              <div key={item} className="rounded-[1.35rem] border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/60">
                <p className="font-medium">{item}</p>
              </div>
            ))}
            <div className="rounded-[1.35rem] border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/60">
              <p className="font-medium">
                Draft statement balance check: {formatCurrency(pack.balanceSheet.totalCurrent)} assets versus{" "}
                {formatCurrency(pack.balanceSheet.totalCurrent)} equity and liabilities.
              </p>
            </div>
            <div className="rounded-[1.35rem] border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/60">
              <p className="font-medium">Previous statement versions</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {context.versions.map((version) => {
                  const versionQuery = buildWorkspaceQuery({
                    companyId: context.company.id,
                    versionId: version.id,
                  });

                  return (
                    <PortalButton key={version.id} variant="secondary" href={`/api/exports/excel?${versionQuery}`}>
                      {version.label}
                    </PortalButton>
                  );
                })}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <section className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <SectionCard title="AI financial analysis" eyebrow="Executive, profitability, liquidity, solvency, and efficiency" className="h-fit w-full">
          <div className="space-y-5">
            {[
              { title: "Executive Summary", lines: aiInsights.executiveSummary },
              { title: "Variance Analysis", lines: aiInsights.varianceHighlights },
              { title: "Risk Assessment", lines: aiInsights.riskAssessment },
              { title: "AI Recommendations", lines: aiInsights.recommendations },
            ].map((section) => (
              <div key={section.title} className="rounded-[1.2rem] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-slate-900/60">
                <p className="font-semibold text-slate-950 dark:text-slate-50">{section.title}</p>
                <div className="mt-3 space-y-2">
                  {section.lines.map((line) => (
                    <p key={line} className="text-sm leading-6 text-slate-500 dark:text-slate-400">{line}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Institutional report themes" eyebrow="CFO and board-ready output styles" className="h-fit w-full">
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
            {aiInsights.reportThemes.map((theme) => (
              <div key={theme} className="h-full rounded-[1.2rem] border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/60">
                <p className="font-semibold text-slate-950 dark:text-slate-50">{theme}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Use this presentation direction for auditor packs, management discussion, investor updates, or board-ready reporting.
                </p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-[1.2rem] border border-dashed border-blue-300 bg-blue-50/70 p-4 dark:border-blue-500/20 dark:bg-blue-500/8">
            <p className="font-semibold text-slate-950 dark:text-slate-50">CFO narrative</p>
            <div className="mt-3 space-y-2">
              {aiInsights.cfoNarrative.map((line) => (
                <p key={line} className="text-sm leading-6 text-slate-600 dark:text-slate-300">{line}</p>
              ))}
            </div>
          </div>
        </SectionCard>
      </section>

      <SectionCard title="Drishti AI copilot" eyebrow="Ask questions about the current financial model">
        <DrishtiAiCopilot prompts={aiInsights.copilotPrompts} />
      </SectionCard>
    </div>
  );
}
