"use client";

import { useState, useTransition } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import {
  CalendarRange,
  CheckCircle2,
  CircleDot,
  CloudUpload,
  FileSpreadsheet,
  FileText,
  History,
  Info,
  Layers3,
  Sparkles,
  Trash2,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";

import { PortalButton } from "@/components/ui/portal-button";
import { usePortalSnackbar } from "@/components/ui/portal-snackbar";
import { StatusPill } from "@/components/portal/cards";
import type { CompanyWorkspaceContext, StatementVersionRecord } from "@/lib/company-workspace";
import { cn } from "@/lib/utils";

type UploadAccent = "blue" | "indigo";

const uploadAccentClasses: Record<UploadAccent, { icon: string; border: string; hover: string }> = {
  blue: {
    icon: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/18 dark:text-blue-200 dark:ring-blue-400/30",
    border: "border-blue-200/80 bg-blue-50/50 dark:border-blue-400/30 dark:bg-blue-500/12",
    hover: "hover:border-blue-300 hover:bg-blue-50/80 dark:hover:border-blue-300/50 dark:hover:bg-blue-500/18",
  },
  indigo: {
    icon: "bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/18 dark:text-indigo-200 dark:ring-indigo-400/30",
    border: "border-indigo-200/80 bg-indigo-50/50 dark:border-indigo-400/30 dark:bg-indigo-500/12",
    hover: "hover:border-indigo-300 hover:bg-indigo-50/80 dark:hover:border-indigo-300/50 dark:hover:bg-indigo-500/18",
  },
};

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  const kilobytes = size / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(kilobytes >= 100 ? 0 : 1)} KB`;
  }

  const megabytes = kilobytes / 1024;
  return `${megabytes.toFixed(megabytes >= 100 ? 0 : 1)} MB`;
}

function formatVersionDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function UploadFileField({
  icon: Icon,
  label,
  file,
  placeholder,
  disabled,
  accent,
  optional = false,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  file: File | null;
  placeholder: string;
  disabled: boolean;
  accent: UploadAccent;
  optional?: boolean;
  onChange: (file: File | null) => void;
}) {
  const accentClasses = uploadAccentClasses[accent];

  return (
    <label
      className={cn(
        "group flex min-h-[6.75rem] min-w-0 items-start gap-3 rounded-[1.15rem] border border-dashed p-4 transition",
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-100/75 text-slate-400 dark:border-white/10 dark:bg-slate-900/35 dark:text-slate-500"
          : cn("cursor-pointer text-slate-600 shadow-sm dark:text-slate-200", accentClasses.border, accentClasses.hover),
      )}
    >
      <input
        className="sr-only"
        type="file"
        accept=".xlsx,.xls"
        disabled={disabled}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <span
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1",
          disabled
            ? "bg-slate-200/80 text-slate-400 ring-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:ring-slate-700"
            : accentClasses.icon,
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-950 dark:text-slate-50">{label}</span>
        <span className="mt-1 block truncate text-sm text-slate-600 dark:text-slate-200">{file ? file.name : placeholder}</span>
        <span className="mt-2 block text-xs font-medium uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
          {file ? formatFileSize(file.size) : optional ? "Optional XLS/XLSX" : "Required XLS/XLSX"}
        </span>
      </span>
    </label>
  );
}

function ProcessStep({
  index,
  title,
  detail,
  complete,
  active,
}: {
  index: number;
  title: string;
  detail: string;
  complete: boolean;
  active: boolean;
}) {
  return (
    <div className="flex gap-3">
      <span
        className={cn(
          "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold ring-1",
          complete
            ? "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/12 dark:text-emerald-300 dark:ring-emerald-500/20"
            : active
              ? "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/12 dark:text-blue-300 dark:ring-blue-500/20"
              : "bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
        )}
      >
        {complete ? <CheckCircle2 className="h-4 w-4" /> : index}
      </span>
      <div className="min-w-0">
        <p className="font-semibold text-slate-950 dark:text-slate-50">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{detail}</p>
      </div>
    </div>
  );
}

function VersionHistoryItem({
  version,
  active,
  canDelete,
  isPending,
  onDelete,
}: {
  version: StatementVersionRecord;
  active: boolean;
  canDelete: boolean;
  isPending: boolean;
  onDelete: (version: StatementVersionRecord) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.15rem] border p-4 transition",
        active
          ? "border-blue-200/80 bg-blue-50/70 shadow-[0_12px_30px_rgba(37,99,235,0.08)] dark:border-blue-500/25 dark:bg-blue-500/10"
          : "border-slate-200/70 bg-slate-50/75 dark:border-white/10 dark:bg-slate-900/55",
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <span
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-semibold ring-1",
              active
                ? "bg-blue-600 text-white ring-blue-600 dark:bg-blue-500 dark:ring-blue-400"
                : "bg-white text-slate-700 ring-slate-200 dark:bg-slate-950 dark:text-slate-200 dark:ring-white/10",
            )}
          >
            v{version.versionNumber}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-semibold text-slate-950 dark:text-slate-50">{version.label}</p>
              <StatusPill label={active ? "Selected" : version.status === "issued" ? "Issued" : "Draft"} tone={active ? "positive" : "neutral"} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <CalendarRange className="h-3.5 w-3.5" />
                FY {version.financialYear}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Layers3 className="h-3.5 w-3.5" />
                {formatVersionDate(version.createdAt)}
              </span>
            </div>
          </div>
        </div>
        {canDelete ? (
          <PortalButton
            variant="secondary"
            type="button"
            disabled={isPending}
            startIcon={<Trash2 className="h-4 w-4" />}
            onClick={() => onDelete(version)}
          >
            Delete
          </PortalButton>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-300 md:grid-cols-2">
        <p className="flex min-w-0 items-center gap-2 rounded-xl bg-white/75 px-3 py-2 ring-1 ring-slate-200/70 dark:bg-slate-950/50 dark:ring-white/10">
          <FileSpreadsheet className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
          <span className="truncate" title={version.trialBalanceWorkbookName}>
            {version.trialBalanceWorkbookName}
          </span>
        </p>
        <p className="flex min-w-0 items-center gap-2 rounded-xl bg-white/75 px-3 py-2 ring-1 ring-slate-200/70 dark:bg-slate-950/50 dark:ring-white/10">
          <FileText className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />
          <span className="truncate" title={version.statementWorkbookName}>
            {version.statementWorkbookName}
          </span>
        </p>
      </div>
    </div>
  );
}

export function VersionManager({
  context,
  hasMasterGrouping,
}: {
  context: CompanyWorkspaceContext;
  hasMasterGrouping: boolean;
}) {
  const router = useRouter();
  const { showSuccess, showError } = usePortalSnackbar();
  const [isPending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [financialYear, setFinancialYear] = useState("");
  const [trialBalanceFile, setTrialBalanceFile] = useState<File | null>(null);
  const [statementWorkbookFile, setStatementWorkbookFile] = useState<File | null>(null);
  const nextVersionNumber = (context.versions[0]?.versionNumber ?? 0) + 1;
  const canUpload = context.permissions.canUploadTrialBalance;
  const canSubmit = !isPending && hasMasterGrouping && Boolean(trialBalanceFile);
  const selectedTrialBalanceName = trialBalanceFile?.name ?? "No trial balance selected";

  const readResponsePayload = async (response: Response) => {
    const text = await response.text();

    if (!text.trim()) {
      return {};
    }

    try {
      return JSON.parse(text) as {
        error?: string;
        version?: StatementVersionRecord;
        defaultVersionId?: string | null;
      };
    } catch {
      return {
        error: response.ok ? "Unexpected response from server." : text,
      };
    }
  };

  const createVersion = () => {
    if (!hasMasterGrouping) {
      showError("Upload a master grouping file for this company before uploading a trial balance.");
      return;
    }

    if (!trialBalanceFile) {
      showError("Please select a trial balance workbook to upload.");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("companyId", String(context.company.id));
      formData.set("label", label);
      formData.set("financialYear", financialYear);

      if (trialBalanceFile) {
        formData.set("trialBalanceFile", trialBalanceFile);
      }

      if (statementWorkbookFile) {
        formData.set("statementWorkbookFile", statementWorkbookFile);
      }

      const response = await fetch("/api/workspace/versions", {
        method: "POST",
        body: formData,
      });

      const payload = await readResponsePayload(response);

      if (!response.ok) {
        showError(payload.error ?? "Unable to create statement version.");
        return;
      }

      if (!payload.version) {
        showError("Upload finished but the version response was incomplete.");
        return;
      }

      showSuccess(`Trial balance uploaded to ${payload.version.label}.`);
      setLabel("");
      setFinancialYear("");
      setTrialBalanceFile(null);
      setStatementWorkbookFile(null);
      router.push(`/import-center?company=${context.company.id}&version=${payload.version.id}`);
      router.refresh();
    });
  };

  const deleteVersion = (version: StatementVersionRecord) => {
    const confirmed = window.confirm(
      `Delete ${version.label} for this company? Trial balance rows and mapping overrides for this version will be removed. This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/workspace/versions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyId: context.company.id,
          versionId: version.id,
        }),
      });

      const payload = await readResponsePayload(response);

      if (!response.ok) {
        showError(payload.error ?? "Unable to delete version.");
        return;
      }

      showSuccess(`Deleted ${version.label}.`);
      const nextVersionId = payload.defaultVersionId;
      const nextUrl = nextVersionId
        ? `/import-center?company=${context.company.id}&version=${nextVersionId}`
        : `/import-center?company=${context.company.id}`;
      router.push(nextUrl as Route);
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {canUpload ? (
        <section className="enterprise-shell-card overflow-hidden">
          <div className="grid xl:grid-cols-[0.95fr_1.25fr]">
            <div className="border-b border-slate-200/70 bg-gradient-to-br from-slate-50/95 via-white to-blue-50/70 p-5 dark:border-white/10 dark:from-slate-950/90 dark:via-slate-950/75 dark:to-blue-950/25 xl:border-b-0 xl:border-r">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200 dark:bg-blue-500/12 dark:text-blue-300 dark:ring-blue-500/20">
                <Sparkles className="h-3.5 w-3.5" />
                Version creation
              </div>
              <h2 className="mt-4 font-[var(--font-display)] text-[1.45rem] font-semibold text-slate-950 dark:text-slate-50">
                Upload trial balance
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {!hasMasterGrouping
                  ? context.currentUser.role === "SITE_ADMIN"
                    ? "Upload this company's master grouping file before creating a TB version."
                    : "A site admin must upload the company master grouping file before TB import."
                  : context.versions.length === 0
                    ? "Create Version 1 from the first trial balance workbook."
                    : `Create Version ${nextVersionNumber} without changing prior uploads.`}
              </p>

              <div className="mt-6 space-y-4">
                <ProcessStep
                  index={1}
                  title="Master grouping"
                  detail={hasMasterGrouping ? "Company catalog is ready." : "Required before upload."}
                  complete={hasMasterGrouping}
                  active={!hasMasterGrouping}
                />
                <ProcessStep
                  index={2}
                  title="Trial balance workbook"
                  detail={trialBalanceFile ? trialBalanceFile.name : "Select the source workbook."}
                  complete={Boolean(trialBalanceFile)}
                  active={hasMasterGrouping && !trialBalanceFile}
                />
                <ProcessStep
                  index={3}
                  title="Version workspace"
                  detail={`Next version label defaults to Version ${nextVersionNumber}.`}
                  complete={false}
                  active={hasMasterGrouping && Boolean(trialBalanceFile)}
                />
              </div>
            </div>

            <div className="p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Version label</span>
                  <input
                    className="field-input field-input-compact h-11 rounded-2xl text-sm"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder={`Version ${nextVersionNumber}`}
                    disabled={!hasMasterGrouping}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200">Financial year</span>
                  <input
                    className="field-input field-input-compact h-11 rounded-2xl text-sm"
                    value={financialYear}
                    onChange={(event) => setFinancialYear(event.target.value)}
                    placeholder="2025-26"
                    disabled={!hasMasterGrouping}
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <UploadFileField
                  icon={CloudUpload}
                  label="Trial balance workbook"
                  file={trialBalanceFile}
                  placeholder="Select trial balance workbook"
                  disabled={!hasMasterGrouping}
                  accent="blue"
                  onChange={setTrialBalanceFile}
                />
                <UploadFileField
                  icon={FileSpreadsheet}
                  label="Reference workbook"
                  file={statementWorkbookFile}
                  placeholder="Use current statement template"
                  disabled={!hasMasterGrouping}
                  accent="indigo"
                  optional
                  onChange={setStatementWorkbookFile}
                />
              </div>

              {!hasMasterGrouping ? (
                <div className="mt-4 flex items-start gap-3 rounded-[1.15rem] border border-amber-200/80 bg-amber-50/75 p-4 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Master grouping is required so every uploaded GL can be matched to the company catalog before downstream workflows open.
                  </p>
                </div>
              ) : null}

              <div className="mt-5 flex flex-col gap-3 border-t border-slate-200/70 pt-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                <p className="min-w-0 truncate text-sm text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Selected:</span> {selectedTrialBalanceName}
                </p>
                <PortalButton
                  variant="primary"
                  type="button"
                  disabled={!canSubmit}
                  onClick={createVersion}
                  startIcon={<UploadCloud className="h-4 w-4" />}
                  sx={{ minHeight: 44, borderRadius: "1rem", textTransform: "none", px: 2.5 }}
                >
                  {isPending ? "Uploading..." : hasMasterGrouping ? "Create version" : "Master grouping required"}
                </PortalButton>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="enterprise-shell-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200/70 bg-gradient-to-r from-white to-slate-50 px-5 py-4 dark:border-white/10 dark:from-slate-950 dark:to-slate-900/70">
          <div>
            <p className="font-[var(--font-display)] text-[1.35rem] font-semibold text-slate-950 dark:text-slate-50">Version history</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Every upload remains isolated to its own company version.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <History className="h-3.5 w-3.5" />
            {context.versions.length} versions
          </div>
        </div>
        <div className="space-y-3 px-5 py-5">
          {context.versions.length === 0 ? (
            <div className="rounded-[1.15rem] border border-dashed border-slate-200/80 bg-slate-50/70 px-4 py-6 dark:border-white/10 dark:bg-slate-900/55">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                  <CircleDot className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="font-semibold text-slate-950 dark:text-slate-50">No versions yet</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Upload a trial balance to create the first version for this company.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            context.versions.map((version: StatementVersionRecord) => (
              <VersionHistoryItem
                key={version.id}
                version={version}
                active={version.id === context.currentVersion?.id}
                canDelete={context.currentUser.role === "SITE_ADMIN"}
                isPending={isPending}
                onDelete={deleteVersion}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
