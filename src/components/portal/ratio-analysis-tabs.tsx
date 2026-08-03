"use client";

import { useState } from "react";

import { PortalButton } from "@/components/ui/portal-button";

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
      <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-white/10 dark:bg-slate-950">
        {tabs.map((tab) => (
          <PortalButton
            key={tab.id}
            variant="tab"
            active={activeTab === tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            sx={{
              borderRadius: "0.65rem",
              minHeight: 36,
              px: 2.5,
              boxShadow: "none",
            }}
          >
            {tab.label}
          </PortalButton>
        ))}
      </div>

      {activeTab === "ratios" ? ratioTable : ledgerSelection}
    </div>
  );
}
