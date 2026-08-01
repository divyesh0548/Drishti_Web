"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

type RatioTab = "ratios" | "ledgers";

export function RatioAnalysisTabs({
  ratioTable,
  ledgerSelection,
}: {
  ratioTable: React.ReactNode;
  ledgerSelection: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<RatioTab>("ratios");

  const tabs: Array<{ id: RatioTab; label: string }> = [
    { id: "ratios", label: "Ratio table" },
    { id: "ledgers", label: "Ratio Ledger Selection" },
  ];

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-slate-950">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "min-h-10 rounded-lg px-4 text-sm font-semibold text-slate-600 transition dark:text-slate-300",
              activeTab === tab.id
                ? "bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100 dark:bg-blue-500/12 dark:text-blue-300 dark:ring-blue-500/20"
                : "hover:bg-slate-50 dark:hover:bg-slate-900",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "ratios" ? ratioTable : ledgerSelection}
    </div>
  );
}
