import { ConsolidationManager } from "@/components/portal/consolidation-manager";
import { SectionCard, StatusPill } from "@/components/portal/cards";
import { assertRouteAccess } from "@/lib/navigation";
import { buildConsolidationSnapshot } from "@/lib/consolidation";
import { resolveWorkspaceContextFromSearchParams } from "@/lib/portal-context";
import type { StatementDisplayRow } from "@/lib/statement-pack";

function formatCurrency(value: number | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function renderStatementTable(rows: StatementDisplayRow[]) {
  return (
    <div className="portal-scrollbar overflow-auto rounded-xl border border-slate-200/70 p-3 dark:border-white/10">
      <table className="min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
          <tr>
            <th className="px-4 py-3 font-medium">Particulars</th>
            <th className="px-4 py-3 font-medium">Note</th>
            <th className="px-4 py-3 font-medium">Current year</th>
            <th className="px-4 py-3 font-medium">Previous year</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.particulars}-${index}`}
              className={[
                "border-t border-slate-200/70 dark:border-white/10",
                row.emphasis === "section" ? "bg-slate-100 font-semibold text-slate-950 dark:bg-slate-800/80 dark:text-slate-50" : "",
                row.emphasis === "heading" ? "bg-slate-50 font-semibold text-slate-700 dark:bg-slate-900/80 dark:text-slate-200" : "",
                row.emphasis === "total" ? "bg-amber-50 font-semibold text-slate-950 dark:bg-amber-500/12 dark:text-amber-100" : "",
              ].join(" ")}
            >
              <td className="px-4 py-3">{row.particulars}</td>
              <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{row.note ?? ""}</td>
              <td className="px-4 py-3">{row.current !== undefined ? formatCurrency(row.current) : ""}</td>
              <td className="px-4 py-3">{row.previous !== undefined ? formatCurrency(row.previous) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ConsolidationPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const context = await resolveWorkspaceContextFromSearchParams(searchParams ? await searchParams : undefined);
  assertRouteAccess(context.currentUser.role, "/consolidation");
  const scope = {
    companyId: context.company.id,
    versionId: context.currentVersion.id,
  };
  const snapshot = buildConsolidationSnapshot(scope);

  return (
    <div className="space-y-6">
      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {snapshot.metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(90,104,147,0.08)] dark:border-white/10 dark:bg-slate-950/70">
            <p className="text-sm text-slate-500 dark:text-slate-400">{metric.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">{metric.value}</p>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{metric.detail}</p>
          </div>
        ))}
      </section>

      <SectionCard
        title="Consolidation Setup"
        eyebrow={`${snapshot.parentCompany.name} | ${snapshot.baseVersion.label} | ${snapshot.baseVersion.financialYear}`}
        action={<StatusPill label={context.permissions.canManageConsolidation ? "Editable" : "Read only"} tone="positive" />}
      >
        <ConsolidationManager
          parentCompanyId={context.company.id}
          parentCompanyName={context.company.name}
          versionId={context.currentVersion.id}
          companies={context.companies.map((company) => ({ id: company.id, name: company.name }))}
          config={snapshot.config}
          canEdit={context.permissions.canManageConsolidation}
        />
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <SectionCard title="Included Companies" eyebrow="Resolved versions used in consolidation">
          <div className="portal-scrollbar overflow-auto rounded-xl border border-slate-200/70 p-3 dark:border-white/10">
            <table className="min-w-[560px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Version</th>
                  <th className="px-4 py-3 font-medium">Financial year</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.members.map((member) => (
                  <tr key={member.companyId} className="border-t border-slate-200/70 dark:border-white/10">
                    <td className="px-4 py-3 font-medium text-slate-950 dark:text-slate-50">{member.companyName}</td>
                    <td className="px-4 py-3">{member.versionLabel}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{member.financialYear}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard title="Elimination Summary" eyebrow="Configured intercompany adjustment rules">
          <div className="space-y-3">
            {snapshot.eliminationSummaries.length === 0 ? (
              <p className="rounded-xl border border-slate-200/70 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-400">
                No elimination rules configured yet.
              </p>
            ) : (
              snapshot.eliminationSummaries.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-slate-900/60">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-medium text-slate-950 dark:text-slate-50">{entry.lineItem}</p>
                    <StatusPill label={entry.active ? "Active" : "Inactive"} tone={entry.active ? "warning" : "neutral"} />
                  </div>
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    {entry.fromCompanyName} to {entry.toCompanyName} | Note {entry.noteNumber} | {entry.statementArea}
                  </p>
                  <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
                    Current year {formatCurrency(entry.currentAmount)} | Previous year {formatCurrency(entry.previousAmount)} | {entry.direction === "decrease" ? "Reduce" : "Increase"}
                  </p>
                  {entry.description ? <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{entry.description}</p> : null}
                </div>
              ))
            )}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <SectionCard title="Consolidated Balance Sheet" eyebrow="Derived from aggregated notes and elimination impacts">
          {renderStatementTable(snapshot.balanceSheet.rows)}
        </SectionCard>

        <SectionCard title="Consolidated Profit and Loss" eyebrow="Derived from aggregated notes and elimination impacts">
          {renderStatementTable(snapshot.profitAndLoss.rows)}
        </SectionCard>
      </div>

      <SectionCard title="Notes Impact" eyebrow="Net consolidated note positions after eliminations">
        <div className="portal-scrollbar overflow-auto rounded-xl border border-slate-200/70 p-3 dark:border-white/10">
          <table className="min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Note</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Net adjustment current</th>
                <th className="px-4 py-3 font-medium">Net adjustment previous</th>
                <th className="px-4 py-3 font-medium">Consolidated current</th>
                <th className="px-4 py-3 font-medium">Consolidated previous</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.noteImpacts.map((note) => (
                <tr key={note.noteNumber} className="border-t border-slate-200/70 dark:border-white/10">
                  <td className="px-4 py-3 font-medium text-slate-950 dark:text-slate-50">{note.noteNumber}</td>
                  <td className="px-4 py-3">{note.title}</td>
                  <td className="px-4 py-3">{formatCurrency(note.adjustmentCurrent)}</td>
                  <td className="px-4 py-3">{formatCurrency(note.adjustmentPrevious)}</td>
                  <td className="px-4 py-3">{formatCurrency(note.current)}</td>
                  <td className="px-4 py-3">{formatCurrency(note.previous)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
