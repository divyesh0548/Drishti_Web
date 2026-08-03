import { Download } from "lucide-react";

import { PageHeader, SectionCard, StatusPill } from "@/components/portal/cards";
import { RatioAnalysisTabs } from "@/components/portal/ratio-analysis-tabs";
import { RatioLedgerSelectionManager } from "@/components/portal/ratio-ledger-selection-manager";
import { PortalButton } from "@/components/ui/portal-button";
import { buildKeyRatioTable, ratioDefinitions } from "@/lib/key-ratios";
import { assertRouteAccess } from "@/lib/navigation";
import { buildWorkspaceQuery, resolveWorkspaceContextFromSearchParams } from "@/lib/portal-context";
import { readRatioLedgerConfig } from "@/lib/ratio-ledger-config";
import { getTrialBalanceSnapshot } from "@/lib/trial-balance";

function formatRatioValue(value: number, kind: "times" | "percent") {
  return kind === "percent" ? `${value.toFixed(2)}%` : value.toFixed(2);
}

function formatRatioChange(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }

  return `${Math.round(value)}%`;
}

export default async function RatioAnalysisPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const context = await resolveWorkspaceContextFromSearchParams(searchParams ? await searchParams : undefined);
  assertRouteAccess(context.currentUser.role, "/ratio-analysis");
  const scope = {
    companyId: context.company.id,
    versionId: context.currentVersion.id,
  };
  const snapshot = getTrialBalanceSnapshot(scope);
  const ratioConfig = readRatioLedgerConfig(scope);

  const ratioTable = buildKeyRatioTable({
    financialYear: context.currentVersion.financialYear,
    scope,
  });
  const baseQuery = buildWorkspaceQuery({
    companyId: context.company.id,
    versionId: context.currentVersion.id,
  });
  const positiveCount = ratioTable.rows.filter((row) => row.changePercent !== null && row.changePercent >= 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`${context.company.name} | ${context.currentVersion.label}`}
        title="Ratio analysis"
        description="Review the full ratio table for the active version and export it directly for audit, management, or review use."
        action={
          <PortalButton
            variant="primary"
            href={`/api/exports/ratios?${baseQuery}`}
            startIcon={<Download className="h-4 w-4" />}
          >
            Export ratios
          </PortalButton>
        }
        meta={
          <>
            <StatusPill label={`${ratioTable.rows.length} ratios`} tone="neutral" />
            <StatusPill label={`${positiveCount} improving`} tone="positive" />
            <StatusPill label={`${ratioTable.currentYearLabel} vs ${ratioTable.previousYearLabel}`} tone="warning" />
          </>
        }
      />

      <RatioAnalysisTabs
        ratioTable={
          <SectionCard title="Ratio table" eyebrow="Comparative analysis">
            <div className="enterprise-table">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="w-[8%] px-4 py-3 font-semibold">Sr. No</th>
                    <th className="w-[30%] px-4 py-3 font-semibold">Particulars</th>
                    <th className="w-[18%] px-4 py-3 font-semibold">Notes</th>
                    <th className="w-[14%] px-4 py-3 font-semibold">{ratioTable.currentYearLabel}</th>
                    <th className="w-[14%] px-4 py-3 font-semibold">{ratioTable.previousYearLabel}</th>
                    <th className="w-[16%] px-4 py-3 font-semibold">% Change</th>
                  </tr>
                </thead>
                <tbody>
                  {ratioTable.rows.map((row, index) => (
                    <tr key={row.id} className="border-t border-slate-200/70 align-top dark:border-white/10">
                      <td className="px-4 py-3 font-semibold text-slate-400">{index + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-950 dark:text-slate-50">{row.label}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{row.formula}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{row.notes}</td>
                      <td className="px-4 py-3 font-semibold text-slate-950 dark:text-slate-50">{formatRatioValue(row.current, row.kind)}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{formatRatioValue(row.previous, row.kind)}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{formatRatioChange(row.changePercent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        }
        ledgerSelection={
          <SectionCard
            title="Ratio Ledger Selection"
            eyebrow="Choose which mapped ledgers feed each ratio"
            action={
              <StatusPill
                label={context.permissions.canManageGrouping ? "Editable for this version" : "Read only"}
                tone={context.permissions.canManageGrouping ? "positive" : "neutral"}
              />
            }
          >
            <RatioLedgerSelectionManager
              rows={snapshot.rows}
              ratioDefinitions={ratioDefinitions}
              ratioConfig={ratioConfig}
              companyId={context.company.id}
              versionId={context.currentVersion.id}
              canEdit={context.permissions.canManageGrouping}
            />
          </SectionCard>
        }
      />
    </div>
  );
}
