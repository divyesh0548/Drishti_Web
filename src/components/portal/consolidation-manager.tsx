"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { StatusPill } from "@/components/portal/cards";
import { PortalButton } from "@/components/ui/portal-button";
import { PortalSelect } from "@/components/ui/portal-select";
import type { ConsolidationConfig, ConsolidationElimination } from "@/lib/consolidation";

type CompanyOption = {
  id: string;
  name: string;
};

type DraftElimination = ConsolidationElimination;

const noteOptions = [
  ["3", "Share Capital"],
  ["4", "Reserves and Surplus"],
  ["5", "Long-term Borrowings"],
  ["6", "Deferred Tax Liabilities (Net)"],
  ["7", "Long-term Provisions"],
  ["8", "Short-term Borrowings"],
  ["9", "Trade Payables"],
  ["10", "Other Current Liabilities"],
  ["11", "Short-term Provisions"],
  ["12", "Property, Plant, Equipment and Intangible Assets"],
  ["13", "Other Non-current Assets"],
  ["14", "Inventories"],
  ["15", "Trade Receivables"],
  ["16", "Cash and Cash Equivalents"],
  ["17", "Short-term Loans and Advances"],
  ["18", "Other Current Assets"],
  ["19", "Revenue from Operations"],
  ["20", "Other Income"],
  ["21", "Cost of Materials and Manufacturing"],
  ["22", "Employee Benefits Expense"],
  ["23", "Finance Costs"],
  ["24", "Depreciation and Amortisation"],
  ["25", "Other Expenses"],
  ["26", "Tax Expense"],
] as const;

function createDraftElimination(parentCompanyId: string, firstMemberCompanyId?: string): DraftElimination {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fromCompanyId: parentCompanyId,
    toCompanyId: firstMemberCompanyId ?? parentCompanyId,
    description: "",
    statementArea: "balance-sheet",
    noteNumber: "9",
    lineItem: "Intercompany balance elimination",
    direction: "decrease",
    currentAmount: 0,
    previousAmount: 0,
    active: true,
  };
}

export function ConsolidationManager({
  parentCompanyId,
  parentCompanyName,
  versionId,
  config,
  companies,
  canEdit,
}: {
  parentCompanyId: string;
  parentCompanyName: string;
  versionId: string;
  config: ConsolidationConfig;
  companies: CompanyOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"scope" | "eliminations">("scope");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>(config.members.map((member) => member.companyId));
  const [eliminations, setEliminations] = useState<DraftElimination[]>(config.eliminations);

  const availableCompanies = companies.filter((company) => company.id !== parentCompanyId);
  const includedCompanyIds = [parentCompanyId, ...selectedMembers];
  const includedCompanies = companies.filter((company) => includedCompanyIds.includes(company.id));
  const firstMemberCompanyId = selectedMembers[0];

  const saveConfig = () => {
    setMessage(null);
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/consolidation", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            companyId: parentCompanyId,
            versionId,
            members: selectedMembers.map((companyId) => ({
              companyId,
            })),
            eliminations,
          }),
        });

        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? "Unable to save consolidation setup.");
        }

        setMessage("Saved consolidation setup.");
        router.refresh();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Unable to save consolidation setup.");
      }
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-900">Group consolidation workspace</p>
          <p className="mt-1 text-sm text-slate-500">
            Set the companies included in the group and configure intercompany eliminations for the selected version.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill label={`${selectedMembers.length + 1} companies`} tone="positive" />
          <StatusPill label={`${eliminations.filter((entry) => entry.active).length} active eliminations`} tone="warning" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { key: "scope", label: "Group Scope" },
          { key: "eliminations", label: "Intercompany Eliminations" },
        ].map((tab) => (
          <PortalButton
            key={tab.key}
            variant="tab"
            active={activeTab === tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as "scope" | "eliminations")}
          >
            {tab.label}
          </PortalButton>
        ))}
      </div>

      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {activeTab === "scope" ? (
        <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
          <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-slate-900/60">
            <p className="text-xs uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Parent company</p>
            <p className="mt-3 text-lg font-semibold text-slate-950 dark:text-slate-50">{parentCompanyName}</p>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">The selected workspace version is always included in consolidation.</p>
          </div>

          <div className="rounded-xl border border-slate-200/70 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-slate-900/60">
            <p className="text-xs uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Group companies</p>
            <div className="mt-4 space-y-4">
              {availableCompanies.map((company) => {
                const selected = selectedMembers.includes(company.id);

                return (
                  <label key={company.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-slate-950/70">
                    <span>
                      <span className="block font-medium text-slate-950 dark:text-slate-50">{company.name}</span>
                      <span className="mt-2 block text-sm text-slate-500 dark:text-slate-400">Include this company in the consolidated financial statements.</span>
                    </span>
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      checked={selected}
                      onChange={(event) =>
                        setSelectedMembers((current) =>
                          event.target.checked ? [...current, company.id] : current.filter((companyId) => companyId !== company.id),
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Configure optional elimination entries for intercompany balances, revenue, expenses, and other internal movements.
            </p>
            <PortalButton
              variant="secondary"
              type="button"
              disabled={!canEdit}
              onClick={() => setEliminations((current) => [...current, createDraftElimination(parentCompanyId, firstMemberCompanyId)])}
            >
              Add elimination
            </PortalButton>
          </div>

          <div className="portal-scrollbar overflow-auto rounded-xl border border-slate-200/70 p-3 dark:border-white/10">
            <table className="min-w-[1180px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">From</th>
                  <th className="px-4 py-3 font-medium">To</th>
                  <th className="px-4 py-3 font-medium">Note</th>
                  <th className="px-4 py-3 font-medium">Area</th>
                  <th className="px-4 py-3 font-medium">Statement line</th>
                  <th className="px-4 py-3 font-medium">Current year</th>
                  <th className="px-4 py-3 font-medium">Previous year</th>
                  <th className="px-4 py-3 font-medium">Direction</th>
                  <th className="px-4 py-3 font-medium">Active</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {eliminations.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-200/70 align-top dark:border-white/10">
                    <td className="px-4 py-3">
                      <PortalSelect
                        value={entry.fromCompanyId}
                        disabled={!canEdit}
                        onChange={(value) =>
                          setEliminations((current) =>
                            current.map((candidate) => (candidate.id === entry.id ? { ...candidate, fromCompanyId: value } : candidate)),
                          )
                        }
                        fullWidth={false}
                        formControlProps={{ sx: { minWidth: 170 } }}
                        options={includedCompanies.map((company) => ({ value: company.id, label: company.name }))}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <PortalSelect
                        value={entry.toCompanyId}
                        disabled={!canEdit}
                        onChange={(value) =>
                          setEliminations((current) =>
                            current.map((candidate) => (candidate.id === entry.id ? { ...candidate, toCompanyId: value } : candidate)),
                          )
                        }
                        fullWidth={false}
                        formControlProps={{ sx: { minWidth: 170 } }}
                        options={includedCompanies.map((company) => ({ value: company.id, label: company.name }))}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <PortalSelect
                        value={entry.noteNumber}
                        disabled={!canEdit}
                        onChange={(value) =>
                          setEliminations((current) =>
                            current.map((candidate) => (candidate.id === entry.id ? { ...candidate, noteNumber: value } : candidate)),
                          )
                        }
                        fullWidth={false}
                        formControlProps={{ sx: { minWidth: 220 } }}
                        options={noteOptions.map(([noteNumber, title]) => ({
                          value: noteNumber,
                          label: `Note ${noteNumber} - ${title}`,
                        }))}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <PortalSelect
                        value={entry.statementArea}
                        disabled={!canEdit}
                        onChange={(value) =>
                          setEliminations((current) =>
                            current.map((candidate) =>
                              candidate.id === entry.id
                                ? { ...candidate, statementArea: value === "profit-and-loss" ? "profit-and-loss" : "balance-sheet" }
                                : candidate,
                            ),
                          )
                        }
                        fullWidth={false}
                        formControlProps={{ sx: { minWidth: 170 } }}
                        options={[
                          { value: "balance-sheet", label: "Balance sheet" },
                          { value: "profit-and-loss", label: "Profit and loss" },
                        ]}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={entry.lineItem}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setEliminations((current) =>
                            current.map((candidate) => (candidate.id === entry.id ? { ...candidate, lineItem: event.target.value } : candidate)),
                          )
                        }
                        className="field-input min-w-[240px]"
                        placeholder="Intercompany sales / receivable / payable..."
                      />
                      <textarea
                        value={entry.description}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setEliminations((current) =>
                            current.map((candidate) => (candidate.id === entry.id ? { ...candidate, description: event.target.value } : candidate)),
                          )
                        }
                        rows={2}
                        className="field-input mt-2 min-w-[240px] resize-y"
                        placeholder="Why this elimination is required..."
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={entry.currentAmount}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setEliminations((current) =>
                            current.map((candidate) =>
                              candidate.id === entry.id ? { ...candidate, currentAmount: Number(event.target.value || 0) } : candidate,
                            ),
                          )
                        }
                        className="field-input min-w-[130px]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        value={entry.previousAmount}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setEliminations((current) =>
                            current.map((candidate) =>
                              candidate.id === entry.id ? { ...candidate, previousAmount: Number(event.target.value || 0) } : candidate,
                            ),
                          )
                        }
                        className="field-input min-w-[130px]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <PortalSelect
                        value={entry.direction}
                        disabled={!canEdit}
                        onChange={(value) =>
                          setEliminations((current) =>
                            current.map((candidate) =>
                              candidate.id === entry.id ? { ...candidate, direction: value === "increase" ? "increase" : "decrease" } : candidate,
                            ),
                          )
                        }
                        fullWidth={false}
                        formControlProps={{ sx: { minWidth: 120 } }}
                        options={[
                          { value: "decrease", label: "Reduce" },
                          { value: "increase", label: "Increase" },
                        ]}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={entry.active}
                        disabled={!canEdit}
                        onChange={(event) =>
                          setEliminations((current) =>
                            current.map((candidate) => (candidate.id === entry.id ? { ...candidate, active: event.target.checked } : candidate)),
                          )
                        }
                        className="mt-3 h-4 w-4 rounded border-slate-300 text-indigo-600"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <PortalButton
                        variant="secondary"
                        type="button"
                        disabled={!canEdit}
                        onClick={() => setEliminations((current) => current.filter((candidate) => candidate.id !== entry.id))}
                      >
                        Remove
                      </PortalButton>
                    </td>
                  </tr>
                ))}
                {eliminations.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-6 text-center text-sm text-slate-500">
                      No elimination rules configured yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-xl border border-slate-200/70 bg-slate-50/80 p-5 dark:border-white/10 dark:bg-slate-900/60 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="font-medium text-slate-950 dark:text-slate-50">Included in this consolidation</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {includedCompanies.map((company) => company.name).join(", ")}
          </p>
        </div>
        <PortalButton variant="primary" type="button" disabled={!canEdit || isPending} onClick={saveConfig}>
          {isPending ? "Saving..." : "Save consolidation setup"}
        </PortalButton>
      </div>
    </div>
  );
}
