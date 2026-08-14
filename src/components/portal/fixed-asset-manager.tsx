"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { StatusPill } from "@/components/portal/cards";
import { PortalButton } from "@/components/ui/portal-button";
import { usePortalSnackbar } from "@/components/ui/portal-snackbar";
import { formatCurrency } from "@/lib/utils";
import type { FixedAssetLine, FixedAssetStore } from "@/lib/fixed-assets";
import { Bot, Calculator, FileSpreadsheet, GitCompareArrows, Link2, Package2, ShieldCheck } from "lucide-react";

type FixedAssetTab = "register" | "depreciation" | "reports" | "integration";

function sumLines(lines: FixedAssetLine[]) {
  return lines.reduce(
    (accumulator, line) => ({
      openingGross: accumulator.openingGross + line.openingGross,
      additions: accumulator.additions + line.additions,
      deductions: accumulator.deductions + line.deductions,
      closingGross: accumulator.closingGross + line.closingGross,
      netCurrent: accumulator.netCurrent + line.netCurrent,
      netPrevious: accumulator.netPrevious + line.netPrevious,
      depCharge: accumulator.depCharge + line.depCharge,
    }),
    {
      openingGross: 0,
      additions: 0,
      deductions: 0,
      closingGross: 0,
      netCurrent: 0,
      netPrevious: 0,
      depCharge: 0,
    },
  );
}

function hasUpload(store: FixedAssetStore) {
  return Boolean(store.upload.sourceName);
}

function MovementTable({
  title,
  lines,
}: {
  title: string;
  lines: FixedAssetLine[];
}) {
  const total = sumLines(lines);

  return (
    <div className="enterprise-table">
      <div className="flex items-center justify-between border-b border-slate-200/70 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-slate-900/80">
        <p className="font-medium text-slate-950 dark:text-slate-50">{title}</p>
        <StatusPill label={`${lines.length} rows`} tone="positive" />
      </div>
      <div className="portal-scrollbar overflow-x-auto p-3">
        <table className="min-w-[1120px] table-fixed text-left text-sm">
          <thead>
            <tr>
              <th className="w-[300px] px-4 py-3 font-medium">Particulars</th>
              <th className="w-[135px] px-4 py-3 font-medium">Opening gross</th>
              <th className="w-[125px] px-4 py-3 font-medium">Additions</th>
              <th className="w-[125px] px-4 py-3 font-medium">Deductions</th>
              <th className="w-[135px] px-4 py-3 font-medium">Closing gross</th>
              <th className="w-[160px] px-4 py-3 font-medium">Depreciation for period</th>
              <th className="w-[140px] px-4 py-3 font-medium">Closing net block</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr className="border-t border-slate-200/70 dark:border-white/10">
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                  No fixed asset register has been uploaded for this module yet.
                </td>
              </tr>
            ) : (
              <>
                {lines.map((line) => (
                  <tr key={line.id} className="h-16 border-t border-slate-200/70 dark:border-white/10">
                    <td className="h-16 px-4 py-3 align-middle">
                      <p className="truncate font-medium text-slate-950 dark:text-slate-50" title={line.label}>{line.label}</p>
                      <p
                        className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400"
                        title={`Ledger ${line.ledgerAccounts.join(", ") || "-"} | Asset classes ${line.assetClasses.join(", ") || "-"}`}
                      >
                        Ledger {line.ledgerAccounts.join(", ") || "-"} | Asset classes {line.assetClasses.join(", ") || "-"}
                      </p>
                    </td>
                    <td className="h-16 whitespace-nowrap px-4 py-3 align-middle text-slate-700 dark:text-slate-200">{formatCurrency(line.openingGross)}</td>
                    <td className="h-16 whitespace-nowrap px-4 py-3 align-middle text-slate-700 dark:text-slate-200">{formatCurrency(line.additions)}</td>
                    <td className="h-16 whitespace-nowrap px-4 py-3 align-middle text-slate-700 dark:text-slate-200">{formatCurrency(line.deductions)}</td>
                    <td className="h-16 whitespace-nowrap px-4 py-3 align-middle text-slate-700 dark:text-slate-200">{formatCurrency(line.closingGross)}</td>
                    <td className="h-16 whitespace-nowrap px-4 py-3 align-middle text-slate-700 dark:text-slate-200">{formatCurrency(line.depCharge)}</td>
                    <td className="h-16 whitespace-nowrap px-4 py-3 align-middle font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(line.netCurrent)}</td>
                  </tr>
                ))}
                <tr className="h-16 border-t border-slate-200/70 bg-slate-50/80 dark:border-white/10 dark:bg-slate-900/80">
                  <td className="h-16 px-4 py-3 align-middle font-semibold text-slate-950 dark:text-slate-50">Total</td>
                  <td className="h-16 whitespace-nowrap px-4 py-3 align-middle font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(total.openingGross)}</td>
                  <td className="h-16 whitespace-nowrap px-4 py-3 align-middle font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(total.additions)}</td>
                  <td className="h-16 whitespace-nowrap px-4 py-3 align-middle font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(total.deductions)}</td>
                  <td className="h-16 whitespace-nowrap px-4 py-3 align-middle font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(total.closingGross)}</td>
                  <td className="h-16 whitespace-nowrap px-4 py-3 align-middle font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(total.depCharge)}</td>
                  <td className="h-16 whitespace-nowrap px-4 py-3 align-middle font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(total.netCurrent)}</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function FixedAssetManager({
  companyId,
  versionId,
  canEdit,
  store,
}: {
  companyId: number;
  versionId: string;
  canEdit: boolean;
  store: FixedAssetStore;
}) {
  const router = useRouter();
  const { showSuccess, showError } = usePortalSnackbar();
  const [activeTab, setActiveTab] = useState<FixedAssetTab>("register");
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);

  const ppeTotal = useMemo(() => sumLines(store.schedules.ppe), [store.schedules.ppe]);
  const cwipTotal = useMemo(() => sumLines(store.schedules.cwip), [store.schedules.cwip]);
  const intangibleTotal = useMemo(() => sumLines(store.schedules.intangible), [store.schedules.intangible]);
  const rouTotal = useMemo(() => sumLines(store.schedules.rou), [store.schedules.rou]);
  const moduleTotals = {
    grossBlock: ppeTotal.closingGross + cwipTotal.closingGross + intangibleTotal.closingGross + rouTotal.closingGross,
    depreciation: ppeTotal.depCharge + intangibleTotal.depCharge + rouTotal.depCharge,
    netBlock: ppeTotal.netCurrent + cwipTotal.netCurrent + intangibleTotal.netCurrent + rouTotal.netCurrent,
  };

  const uploadRegister = () => {
    if (!file) {
      showError("Select a fixed asset register before uploading.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("companyId", String(companyId));
      formData.set("versionId", versionId);
      formData.set("file", file);

      const response = await fetch("/api/fixed-assets/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        showError(payload.error ?? "Unable to upload the fixed asset register.");
        return;
      }

      showSuccess("Fixed asset register uploaded and perpetual depreciation schedules refreshed.");
      setFile(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {[
          { id: "register", label: "Register Workspace", icon: Package2 },
          { id: "depreciation", label: "Depreciation Engine", icon: Calculator },
          { id: "reports", label: "Reports & Audit", icon: FileSpreadsheet },
          { id: "integration", label: "Integration Controls", icon: Link2 },
        ].map((tab) => (
          <PortalButton
            key={tab.id}
            variant="tab"
            active={activeTab === tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as FixedAssetTab)}
            startIcon={<tab.icon className="h-4 w-4" />}
          >
            {tab.label}
          </PortalButton>
        ))}
      </div>

      {activeTab === "register" ? (
        <div className="space-y-6">
          <section className="grid gap-6 xl:grid-cols-2 xl:items-start">
            <div className="enterprise-shell-card p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-slate-950 dark:text-slate-50">Standalone register onboarding</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Upload the asset register independently of the financial statement automation flow. The module keeps its own depreciation engine, movement history, and audit-ready schedules.
                  </p>
                </div>
                <StatusPill label={canEdit ? "Upload enabled" : "View only"} tone="positive" />
              </div>

              <div className="mt-5 rounded-[1.2rem] border border-slate-200/70 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-slate-900/60">
                <p className="font-medium text-slate-950 dark:text-slate-50">Current file</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {hasUpload(store)
                    ? `${store.upload.sourceName} uploaded on ${new Intl.DateTimeFormat("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(store.upload.uploadedAt ?? new Date().toISOString()))}`
                    : "No fixed asset register uploaded yet for this module workspace."}
                </p>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="flex h-10 min-w-0 flex-1 cursor-pointer items-center rounded-xl border border-dashed border-slate-300 bg-white px-3 text-sm text-slate-600 transition hover:border-blue-200 hover:bg-blue-50/40 dark:border-white/10 dark:bg-slate-950 dark:text-slate-300">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      disabled={!canEdit}
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                      className="hidden"
                    />
                    <span className="truncate">{file?.name ?? "Choose fixed asset register"}</span>
                  </label>
                  <PortalButton variant="primary" type="button" disabled={!canEdit || isPending} onClick={uploadRegister}>
                    {isPending ? "Uploading..." : "Upload FAR"}
                  </PortalButton>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                { label: "Total gross block", value: moduleTotals.grossBlock },
                { label: "Net block", value: moduleTotals.netBlock },
                { label: "Depreciation for period", value: moduleTotals.depreciation },
                { label: "Asset movement classes", value: store.schedules.ppe.length + store.schedules.cwip.length + store.schedules.intangible.length + store.schedules.rou.length },
              ].map((item) => (
                <div key={item.label} className="enterprise-shell-card p-5">
                  <p className="text-sm text-slate-500 dark:text-slate-400">{item.label}</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                    {typeof item.value === "number" && item.label !== "Asset movement classes" ? formatCurrency(item.value) : item.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-6">
            <MovementTable title="Property, plant and equipment" lines={store.schedules.ppe} />
            <MovementTable title="Right of use assets" lines={store.schedules.rou} />
            <MovementTable title="Capital work-in-progress" lines={store.schedules.cwip} />
            <MovementTable title="Other intangible assets" lines={store.schedules.intangible} />
          </div>
        </div>
      ) : null}

      {activeTab === "depreciation" ? (
        <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
          <div className="enterprise-shell-card p-5">
            <div className="flex items-center gap-2">
              <Calculator className="h-4.5 w-4.5 text-blue-600 dark:text-blue-300" />
              <p className="text-lg font-semibold text-slate-950 dark:text-slate-50">Perpetual depreciation calculator</p>
            </div>
            <div className="mt-4 space-y-3">
              {[
                "Support Straight Line Method (SLM) and Written Down Value (WDV) logic.",
                "Handle daily, monthly, quarterly, half-yearly, and yearly depreciation views.",
                "Compute opening block, additions, disposals, transfers, depreciation charge, accumulated depreciation, and net block.",
                "Use put-to-use dates, pro-rata logic, and component-based depreciation policies under Schedule II.",
              ].map((item) => (
                <div key={item} className="rounded-[1.1rem] border border-slate-200/70 bg-slate-50/80 px-4 py-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="enterprise-shell-card p-5">
            <p className="text-lg font-semibold text-slate-950 dark:text-slate-50">Current depreciation outputs</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {[
                { label: "PPE depreciation", value: ppeTotal.depCharge },
                { label: "ROU depreciation", value: rouTotal.depCharge },
                { label: "Intangible depreciation", value: intangibleTotal.depCharge },
                { label: "Module total depreciation", value: moduleTotals.depreciation },
              ].map((item) => (
                <div key={item.label} className="rounded-[1.1rem] border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/60">
                  <p className="text-sm text-slate-500 dark:text-slate-400">{item.label}</p>
                  <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(item.value)}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[1.1rem] border border-dashed border-blue-300 bg-blue-50/70 p-4 dark:border-blue-500/20 dark:bg-blue-500/8">
              <p className="font-semibold text-slate-950 dark:text-slate-50">Schedule II controls</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Useful life overrides, residual value changes, revaluation adjustments, and capital subsidies can sit here as controlled approval events while keeping a complete audit trail.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "reports" ? (
        <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
          <div className="enterprise-shell-card p-5">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4.5 w-4.5 text-blue-600 dark:text-blue-300" />
              <p className="text-lg font-semibold text-slate-950 dark:text-slate-50">Audit-ready reports</p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                "Fixed Asset Register",
                "Asset Movement Register",
                "Depreciation Register",
                "Gross Block Schedule",
                "Net Block Schedule",
                "Asset Disposal Report",
                "Revaluation Report",
                "Asset Verification Report",
              ].map((item) => (
                <div key={item} className="rounded-[1.1rem] border border-slate-200/70 bg-slate-50/80 px-4 py-4 text-sm font-medium text-slate-700 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="enterprise-shell-card p-5">
            <div className="flex items-center gap-2">
              <Bot className="h-4.5 w-4.5 text-blue-600 dark:text-blue-300" />
              <p className="text-lg font-semibold text-slate-950 dark:text-slate-50">AI and management insights</p>
            </div>
            <div className="mt-4 space-y-3">
              {[
                hasUpload(store)
                  ? `${store.upload.sourceName} is now available for CAPEX, depreciation trend, and replacement analysis.`
                  : "Upload a register to unlock CAPEX, depreciation trend, and replacement insights.",
                moduleTotals.netBlock <= 0
                  ? "Net block is at or below zero, so the module would likely flag replacement and verification priorities."
                  : `Current net block stands at ${formatCurrency(moduleTotals.netBlock)}, supporting replacement and useful-life commentary.`,
                "Idle assets, near-end-of-life assets, and disposal profitability can be surfaced here as AI recommendations for finance teams and auditors.",
              ].map((item) => (
                <div key={item} className="rounded-[1.1rem] border border-slate-200/70 bg-white/80 px-4 py-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-300">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "integration" ? (
        <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
          <div className="enterprise-shell-card p-5">
            <div className="flex items-center gap-2">
              <Link2 className="h-4.5 w-4.5 text-blue-600 dark:text-blue-300" />
              <p className="text-lg font-semibold text-slate-950 dark:text-slate-50">Integration outputs</p>
            </div>
            <div className="mt-4 space-y-3">
              {[
                "Update Property, Plant & Equipment balances in statement outputs.",
                "Feed depreciation expense into the Profit & Loss Statement.",
                "Populate Notes to Accounts and supporting movement schedules.",
                "Support Balance Sheet and Cash Flow reporting when the module is integrated with Drishti reporting.",
              ].map((item) => (
                <div key={item} className="rounded-[1.1rem] border border-slate-200/70 bg-slate-50/80 px-4 py-4 text-sm leading-6 text-slate-600 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-300">
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="enterprise-shell-card p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-300" />
              <p className="text-lg font-semibold text-slate-950 dark:text-slate-50">Governance and audit trail</p>
            </div>
            <div className="mt-4 space-y-3">
              {[
                "Keep the FAR module deployable as a standalone subscription with its own controls and reporting stack.",
                "Maintain role-based approvals for useful life changes, component accounting, and depreciation overrides.",
                "Track acquisition, transfer, disposal, subsidy, revaluation, and impairment events through auditable movement history.",
                "Use the module as a single source of truth instead of Excel-based asset registers and depreciation workbooks.",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-[1.1rem] border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-slate-950/60">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/12 dark:text-emerald-300">
                    <GitCompareArrows className="h-4 w-4" />
                  </div>
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
