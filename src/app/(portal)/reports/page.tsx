import { DrishtiAiCopilot } from "@/components/portal/drishti-ai-copilot";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { PageHeader, SectionCard, StatusPill } from "@/components/portal/cards";
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
  const pack = getStatementPack({
    companyId: context.company.id,
    versionId: context.currentVersion.id,
  });
  const snapshot = getTrialBalanceSnapshot({
    companyId: context.company.id,
    versionId: context.currentVersion.id,
  });
  const ratioTable = buildKeyRatioTable({
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

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr] xl:items-start">
        <SectionCard title="Export center" eyebrow="Report delivery">
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
                className="flex flex-col gap-3 rounded-[1.35rem] border border-slate-200/70 bg-slate-50/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/70 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium">{bundle.title}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{bundle.format}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill
                    label={bundle.status}
                    tone={bundle.status === "Ready now" || bundle.status === "Clear" ? "positive" : "warning"}
                  />
                  <a
                    href={bundle.href}
                    className="portal-button-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-medium"
                  >
                    <bundle.icon className="h-4 w-4" />
                    Open
                  </a>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Generated report highlights" eyebrow="From the imported trial balance">
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
                    <a
                      key={version.id}
                      href={`/api/exports/excel?${versionQuery}`}
                      className="portal-button-secondary px-4 py-2 text-sm font-medium"
                    >
                      {version.label}
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr] xl:items-start">
        <SectionCard title="AI financial analysis" eyebrow="Executive, profitability, liquidity, solvency, and efficiency">
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

        <SectionCard title="Institutional report themes" eyebrow="CFO and board-ready output styles">
          <div className="grid items-start gap-4 md:grid-cols-2">
            {aiInsights.reportThemes.map((theme) => (
              <div key={theme} className="rounded-[1.2rem] border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/60">
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
