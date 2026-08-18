import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Clock3,
  DatabaseZap,
  FileSpreadsheet,
  Layers3,
  ListChecks,
  ShieldCheck,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";

import { PageHeader, SectionCard, StatusPill } from "@/components/portal/cards";
import { MasterGroupingUploader } from "@/components/portal/master-grouping-uploader";
import { VersionManager } from "@/components/portal/version-manager";
import { companyHasMasterGrouping } from "@/lib/grouping-database";
import { assertRouteAccess } from "@/lib/navigation";
import { resolveWorkspaceCompanyFromSearchParams } from "@/lib/portal-context";
import { getTrialBalanceSnapshot } from "@/lib/trial-balance";
import { cn } from "@/lib/utils";

type StatusTone = "neutral" | "positive" | "warning" | "critical";

const metricToneClasses: Record<StatusTone, { icon: string; glow: string }> = {
  neutral: {
    icon: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700",
    glow: "from-slate-500/10 to-transparent",
  },
  positive: {
    icon: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/12 dark:text-emerald-300 dark:ring-emerald-500/20",
    glow: "from-emerald-500/14 to-transparent",
  },
  warning: {
    icon: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/12 dark:text-amber-300 dark:ring-amber-500/20",
    glow: "from-amber-500/16 to-transparent",
  },
  critical: {
    icon: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/12 dark:text-rose-300 dark:ring-rose-500/20",
    glow: "from-rose-500/14 to-transparent",
  },
};

function ImportMetric({
  icon: Icon,
  label,
  value,
  detail,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone?: StatusTone;
}) {
  const toneClasses = metricToneClasses[tone];

  return (
    <div className="enterprise-shell-card relative min-h-[150px] overflow-hidden p-4">
      <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b", toneClasses.glow)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-3 truncate font-[var(--font-display)] text-[1.35rem] font-semibold text-slate-950 dark:text-slate-50">
            {value}
          </p>
        </div>
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1", toneClasses.icon)}>
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
      <p className="relative mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function ReadinessRow({
  icon: Icon,
  title,
  detail,
  label,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  label: string;
  tone: StatusTone;
}) {
  return (
    <div className="flex gap-3 rounded-[1.15rem] border border-slate-200/70 bg-slate-50/75 p-3.5 dark:border-white/10 dark:bg-slate-900/55">
      <span className={cn("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1", metricToneClasses[tone].icon)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-semibold text-slate-950 dark:text-slate-50">{title}</p>
          <StatusPill label={label} tone={tone} />
        </div>
        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{detail}</p>
      </div>
    </div>
  );
}

function ValidationFinding({
  issue,
}: {
  issue: { title: string; detail: string; tone: StatusTone };
}) {
  const Icon = issue.tone === "critical" ? AlertTriangle : issue.tone === "warning" ? CircleAlert : CheckCircle2;

  return (
    <div className="rounded-[1.15rem] border border-slate-200/70 bg-slate-50/75 p-4 dark:border-white/10 dark:bg-slate-900/55">
      <div className="flex items-start gap-3">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1", metricToneClasses[issue.tone].icon)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-semibold text-slate-950 dark:text-slate-50">{issue.title}</p>
            <StatusPill
              label={issue.tone === "critical" ? "Critical" : issue.tone === "warning" ? "Review" : "OK"}
              tone={issue.tone}
            />
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{issue.detail}</p>
        </div>
      </div>
    </div>
  );
}

export default async function ImportCenterPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const context = await resolveWorkspaceCompanyFromSearchParams(searchParams ? await searchParams : undefined);
  assertRouteAccess(context.currentUser.role, "/import-center");

  const hasMasterGrouping = await companyHasMasterGrouping(context.company.id);
  const hasVersion = Boolean(context.currentVersion);
  const snapshot = hasVersion
    ? await getTrialBalanceSnapshot({
        companyId: context.company.id,
        versionId: context.currentVersion!.id,
      })
    : null;
  const isSiteAdmin = context.currentUser.role === "SITE_ADMIN";
  const criticalFindings = snapshot?.reviewFlags.filter((issue) => issue.tone === "critical").length ?? 0;
  const warningFindings = snapshot?.reviewFlags.filter((issue) => issue.tone === "warning").length ?? 0;
  const validationTone: StatusTone = !snapshot
    ? "neutral"
    : criticalFindings > 0
      ? "critical"
      : warningFindings > 0
        ? "warning"
        : "positive";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${context.company.name} | ${context.currentVersion?.label ?? "No version"}`}
        title="Trial balance upload and version control"
        description={
          !hasMasterGrouping
            ? "A company master grouping file is required before a trial balance can be uploaded. Mapping, statements, and reports stay locked until then."
            : hasVersion
              ? "Manage workbook ingestion with a guided import sequence, current validation visibility, and version-aware storage for each company workspace."
              : "Upload the first trial balance workbook to create Version 1 for this company. Mapping, statements, and reports unlock after that."
        }
        action={isSiteAdmin ? <MasterGroupingUploader companyId={context.company.id} companyName={context.company.name} /> : undefined}
        meta={
          <>
            <StatusPill
              label={hasMasterGrouping ? "Master grouping ready" : "Master grouping required"}
              tone={hasMasterGrouping ? "positive" : "warning"}
            />
            <StatusPill label={`${context.versions.length} versions`} tone="positive" />
            <StatusPill label={`${snapshot?.previewRows.length ?? 0} preview rows`} tone="neutral" />
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ImportMetric
          icon={DatabaseZap}
          label="Master catalog"
          value={hasMasterGrouping ? "Ready" : "Required"}
          detail={hasMasterGrouping ? "Company grouping catalog is available for TB routing." : "Upload the company master grouping before TB import."}
          tone={hasMasterGrouping ? "positive" : "warning"}
        />
        <ImportMetric
          icon={Layers3}
          label="Active version"
          value={context.currentVersion?.label ?? "Not created"}
          detail={context.currentVersion ? `FY ${context.currentVersion.financialYear} is selected.` : "The first workbook upload will create Version 1."}
          tone={hasVersion ? "positive" : "neutral"}
        />
        <ImportMetric
          icon={FileSpreadsheet}
          label="Source preview"
          value={`${snapshot?.previewRows.length ?? 0} rows`}
          detail={snapshot ? `${snapshot.rowCount} source ledgers loaded in this version.` : "Preview appears after a trial balance is uploaded."}
          tone={snapshot ? "positive" : "neutral"}
        />
        <ImportMetric
          icon={ListChecks}
          label="Validation"
          value={snapshot ? `${snapshot.reviewFlags.length} findings` : "Pending"}
          detail={
            snapshot
              ? `${criticalFindings} critical and ${warningFindings} review items in the current workbook.`
              : "Workbook controls run when a version exists."
          }
          tone={validationTone}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.72fr)] xl:items-start">
        <VersionManager context={context} hasMasterGrouping={hasMasterGrouping} />

        <aside className="space-y-6">
          <SectionCard title="Import readiness" eyebrow="Workspace gates">
            <div className="space-y-3">
              <ReadinessRow
                icon={ShieldCheck}
                title="Master grouping"
                detail={
                  hasMasterGrouping
                    ? "Upload flow can use the company-specific GL catalog."
                    : isSiteAdmin
                      ? "Upload the company master grouping file to unlock TB import."
                      : "Waiting for a site admin to upload the company master grouping file."
                }
                label={hasMasterGrouping ? "Ready" : "Blocked"}
                tone={hasMasterGrouping ? "positive" : "warning"}
              />
              <ReadinessRow
                icon={UploadCloud}
                title="Trial balance upload"
                detail={
                  context.permissions.canUploadTrialBalance
                    ? hasMasterGrouping
                      ? "Finance users can create the next version from a workbook."
                      : "Upload control stays disabled until grouping is ready."
                    : "Your current role can review imports but cannot upload new files."
                }
                label={context.permissions.canUploadTrialBalance ? "Available" : "Read only"}
                tone={context.permissions.canUploadTrialBalance && hasMasterGrouping ? "positive" : "neutral"}
              />
              <ReadinessRow
                icon={Clock3}
                title="Version workspace"
                detail={
                  context.currentVersion
                    ? `${context.currentVersion.label} is the active workspace for downstream pages.`
                    : "Mapping, statements, and reports unlock after the first version is created."
                }
                label={context.currentVersion ? "Active" : "Waiting"}
                tone={context.currentVersion ? "positive" : "neutral"}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Validation findings"
            eyebrow="Workbook controls"
            action={<StatusPill label={snapshot ? `${snapshot.reviewFlags.length} checks` : "No workbook"} tone={validationTone} />}
          >
            <div className="space-y-3">
              {!snapshot ? (
                <div className="rounded-[1.15rem] border border-dashed border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-slate-900/55">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                      <Clock3 className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-semibold text-slate-950 dark:text-slate-50">Awaiting first workbook</p>
                      <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                        Validation findings appear after a trial balance upload creates a company version.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                snapshot.reviewFlags.map((issue) => <ValidationFinding key={issue.title} issue={issue} />)
              )}
            </div>
          </SectionCard>
        </aside>
      </section>
    </div>
  );
}
