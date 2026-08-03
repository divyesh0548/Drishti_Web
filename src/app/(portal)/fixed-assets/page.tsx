import { FixedAssetManager } from "@/components/portal/fixed-asset-manager";
import { MiniStat, PageHeader, SectionCard, StatusPill } from "@/components/portal/cards";
import { hasFixedAssetUpload, readFixedAssetStore, sumFixedAssetLines } from "@/lib/fixed-assets";
import { assertRouteAccess } from "@/lib/navigation";
import { resolveWorkspaceContextFromSearchParams } from "@/lib/portal-context";
import { formatCurrency } from "@/lib/utils";
import { Bot, Link2, ShieldCheck, Sparkles } from "lucide-react";

function computeUsefulLifeSignals(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.filter((value) => value >= 0.8).length;
}

export default async function FixedAssetsPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const context = await resolveWorkspaceContextFromSearchParams(searchParams ? await searchParams : undefined);
  assertRouteAccess(context.currentUser.role, "/fixed-assets");

  const store = readFixedAssetStore({
    companyId: context.company.id,
    versionId: context.currentVersion.id,
  });
  const ppeTotal = sumFixedAssetLines(store.schedules.ppe);
  const cwipTotal = sumFixedAssetLines(store.schedules.cwip);
  const intangibleTotal = sumFixedAssetLines(store.schedules.intangible);
  const rouTotal = sumFixedAssetLines(store.schedules.rou);
  const allLines = [
    ...store.schedules.ppe,
    ...store.schedules.cwip,
    ...store.schedules.intangible,
    ...store.schedules.rou,
  ];
  const grossBlock = ppeTotal.closingGross + cwipTotal.closingGross + intangibleTotal.closingGross + rouTotal.closingGross;
  const netBlock = ppeTotal.netCurrent + cwipTotal.netCurrent + intangibleTotal.netCurrent + rouTotal.netCurrent;
  const annualDepreciation = ppeTotal.depCharge + intangibleTotal.depCharge + rouTotal.depCharge;
  const disposals = ppeTotal.deductions + cwipTotal.deductions + intangibleTotal.deductions + rouTotal.deductions;
  const fullyDepreciatedCount = allLines.filter((line) => line.closingGross > 0 && line.netCurrent <= 0).length;
  const nearingEndOfLifeCount = computeUsefulLifeSignals(
    allLines
      .filter((line) => line.closingGross > 0)
      .map((line) => (line.closingDep <= 0 ? 0 : line.closingDep / line.closingGross)),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Additional Module | ${context.company.name} | ${context.currentVersion.label}`}
        title="Fixed Asset Register & Perpetual Depreciation Calculator"
        description="Operate a standalone premium module for centralized fixed asset lifecycle management, perpetual depreciation, audit-ready schedules, and optional financial statement integration."
        meta={
          <>
            <StatusPill label="Premium Module" tone="positive" />
            <StatusPill label={hasFixedAssetUpload(store) ? "Standalone module active" : "Ready for onboarding"} tone={hasFixedAssetUpload(store) ? "positive" : "warning"} />
            <StatusPill label={context.permissions.canUploadTrialBalance ? "Editable workspace" : "View only"} tone="neutral" />
          </>
        }
        action={
          <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/12 dark:text-blue-300 dark:ring-blue-500/20">
            <Sparkles className="h-4 w-4" />
            Additional module positioning
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MiniStat label="Total Gross Block" value={formatCurrency(grossBlock)} accent="blue" />
        <MiniStat label="Net Block" value={formatCurrency(netBlock)} accent="emerald" />
        <MiniStat label="Depreciation for Period" value={formatCurrency(annualDepreciation)} accent="amber" />
        <MiniStat label="Asset Disposals" value={formatCurrency(disposals)} accent="indigo" />
        <MiniStat label="Fully Depreciated Assets" value={String(fullyDepreciatedCount)} accent="amber" />
        <MiniStat label="Near End of Useful Life" value={String(nearingEndOfLifeCount)} accent="indigo" />
      </section>

      <section className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <SectionCard title="Module objectives" eyebrow="Standalone product value">
          <div className="grid items-start gap-4 md:grid-cols-2">
            {[
              "Maintain a centralized fixed asset register with cloud-based control.",
              "Track the full asset lifecycle from acquisition to disposal.",
              "Calculate depreciation automatically under perpetual logic.",
              "Generate audit-ready schedules and compliance reports.",
              "Replace spreadsheet-based FAR and depreciation workbooks.",
              "Scale to large asset volumes with version-aware reporting.",
            ].map((item) => (
              <div key={item} className="rounded-[1.2rem] border border-slate-200/70 bg-slate-50/80 px-4 py-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
                {item}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Standalone and integrated mode"
          eyebrow="Configurable product strategy"
          action={
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/12 dark:text-emerald-300 dark:ring-emerald-500/20">
              <Link2 className="h-3.5 w-3.5" />
              Optional integration
            </div>
          }
        >
          <div className="space-y-4">
            <div className="rounded-[1.2rem] border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/60">
              <p className="font-semibold text-slate-950 dark:text-slate-50">Standalone module</p>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Organizations can subscribe to this module independently for asset register control, perpetual depreciation, asset movement tracking, and audit support without adopting the full financial statement workflow.
              </p>
            </div>
            <div className="rounded-[1.2rem] border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/60">
              <p className="font-semibold text-slate-950 dark:text-slate-50">Integrated mode</p>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                When enabled, this module can feed Property, Plant & Equipment balances, depreciation expense, note schedules, and balance sheet values into the broader Drishti reporting engine.
              </p>
            </div>
          </div>
        </SectionCard>
      </section>

      <section className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <SectionCard title="Lifecycle coverage" eyebrow="Asset register, movements, disposal, and compliance">
          <div className="grid items-start gap-4 md:grid-cols-2">
            {[
              "Asset register fields: code, name, category, tag, vendor, location, department, cost center, capitalization date, residual value, useful life, and status.",
              "Movement tracking: acquisitions, capitalization, transfer, impairment, sale, disposal, scrapping, revaluation, subsidy, and partial disposal.",
              "Perpetual depreciation: SLM and WDV with daily, monthly, quarterly, half-yearly, and yearly support.",
              "Compliance controls: Schedule II useful life, residual value, pro-rata depreciation, component accounting, and approved override history.",
            ].map((item) => (
              <div key={item} className="rounded-[1.2rem] border border-slate-200/70 bg-slate-50/80 px-4 py-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
                {item}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="AI insights and dashboards"
          eyebrow="Management and auditor support"
          action={
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/12 dark:text-blue-300 dark:ring-blue-500/20">
              <Bot className="h-3.5 w-3.5" />
              Drishti AI ready
            </div>
          }
        >
          <div className="space-y-3">
            {[
              `Total gross block stands at ${formatCurrency(grossBlock)} with net block at ${formatCurrency(netBlock)} for the active version.`,
              `${nearingEndOfLifeCount} asset classes appear to be approaching the end of useful life based on current depreciation-to-gross-block coverage.`,
              `${fullyDepreciatedCount} classes are already fully depreciated or near-zero net block and can be prioritized for replacement or verification planning.`,
              "The module can support AI commentary for idle assets, depreciation trends, CAPEX profiling, disposal profitability, and replacement recommendations.",
            ].map((item) => (
              <div key={item} className="rounded-[1.2rem] border border-slate-200/70 bg-white/80 px-4 py-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-300">
                {item}
              </div>
            ))}
          </div>
        </SectionCard>
      </section>

      <SectionCard
        title="Module workspace"
        eyebrow={`${context.company.name} | ${context.currentVersion.label} | Dedicated FAR and depreciation operations`}
        action={<StatusPill label={hasFixedAssetUpload(store) ? "Register uploaded" : "Upload pending"} tone={hasFixedAssetUpload(store) ? "positive" : "warning"} />}
      >
        <FixedAssetManager
          companyId={context.company.id}
          versionId={context.currentVersion.id}
          canEdit={context.permissions.canUploadTrialBalance}
          store={store}
        />
      </SectionCard>

      <section className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <SectionCard title="Professional reports" eyebrow="Standalone FAR outputs">
          <div className="grid items-start gap-4 md:grid-cols-2">
            {[
              "Fixed Asset Register",
              "Asset Movement Register",
              "Depreciation Register",
              "Gross Block Schedule",
              "Net Block Schedule",
              "Asset Disposal Report",
              "Revaluation Report",
              "Asset Verification Report",
            ].map((report) => (
              <div key={report} className="rounded-[1.2rem] border border-slate-200/70 bg-slate-50/80 px-4 py-4 text-sm font-medium text-slate-700 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
                {report}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Audit and governance controls" eyebrow="Schedule II and lifecycle assurance">
          <div className="space-y-3">
            {[
              "Apply put-to-use depreciation logic and component accounting under Schedule II of the Companies Act, 2013.",
              "Support authorized useful-life overrides with role-based approval and auditable history.",
              "Maintain cloud-ready audit trails for movement, transfer, disposal, revaluation, and subsidy events.",
              "Keep this module deployable either as a standalone subscription or as part of Drishti's integrated reporting stack.",
            ].map((item) => (
              <div key={item} className="flex gap-3 rounded-[1.2rem] border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/60">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300">
                  <ShieldCheck className="h-4.5 w-4.5" />
                </div>
                <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{item}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
