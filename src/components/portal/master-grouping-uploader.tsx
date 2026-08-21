"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { AlertTriangle, CloudUpload, Upload } from "lucide-react";

import { PortalButton } from "@/components/ui/portal-button";
import { PortalSelect } from "@/components/ui/portal-select";
import { usePortalSnackbar } from "@/components/ui/portal-snackbar";

type ColumnPreview = {
  columns: string[];
  suggestedGlCodeColumn: string | null;
  suggestedGlGroupColumn: string | null;
};

export function MasterGroupingUploader({
  companyId,
  companyName,
}: {
  companyId: number;
  companyName: string;
}) {
  const router = useRouter();
  const { showSuccess, showError } = usePortalSnackbar();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [glCodeColumn, setGlCodeColumn] = useState("");
  const [glGroupColumn, setGlGroupColumn] = useState("");

  const resetColumnSelection = () => {
    setColumns([]);
    setGlCodeColumn("");
    setGlGroupColumn("");
  };

  const closeDialog = () => {
    if (isPending || isPreviewLoading) {
      return;
    }

    setOpen(false);
    setFile(null);
    resetColumnSelection();
  };

  useEffect(() => {
    if (!file) {
      resetColumnSelection();
      return;
    }

    let cancelled = false;

    const loadPreview = async () => {
      setIsPreviewLoading(true);
      resetColumnSelection();

      try {
        const formData = new FormData();
        formData.set("masterGroupingFile", file);

        const response = await fetch("/api/groupings/master-upload/preview", {
          method: "POST",
          body: formData,
        });

        const payload = (await response.json()) as ColumnPreview & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to read workbook columns.");
        }

        if (cancelled) {
          return;
        }

        setColumns(payload.columns);
        setGlCodeColumn(payload.suggestedGlCodeColumn ?? payload.columns[0] ?? "");
        setGlGroupColumn(
          payload.suggestedGlGroupColumn ??
            payload.columns.find((column) => column !== payload.suggestedGlCodeColumn) ??
            payload.columns[1] ??
            "",
        );
      } catch (previewError) {
        if (!cancelled) {
          setFile(null);
          showError(previewError instanceof Error ? previewError.message : "Unable to read workbook columns.");
        }
      } finally {
        if (!cancelled) {
          setIsPreviewLoading(false);
        }
      }
    };

    void loadPreview();

    return () => {
      cancelled = true;
    };
  }, [file, showError]);

  const columnOptions = columns.map((column) => ({
    value: column,
    label: column,
  }));

  const canUpload =
    Boolean(file) &&
    Boolean(glCodeColumn) &&
    Boolean(glGroupColumn) &&
    glCodeColumn !== glGroupColumn &&
    !isPreviewLoading;

  const upload = () => {
    if (!file) {
      showError("Please select a master grouping Excel workbook first.");
      return;
    }

    if (!glCodeColumn || !glGroupColumn) {
      showError("Select both the GL code column and the GL grouping column.");
      return;
    }

    if (glCodeColumn === glGroupColumn) {
      showError("GL code and GL grouping must use different columns.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("companyId", String(companyId));
        formData.set("masterGroupingFile", file);
        formData.set("glCodeColumn", glCodeColumn);
        formData.set("glGroupColumn", glGroupColumn);

        const response = await fetch("/api/groupings/master-upload", {
          method: "POST",
          body: formData,
        });

        const payload = (await response.json()) as {
          error?: string;
          message?: string;
          result?: {
            rowCount: number;
            groupsCreated: number;
            groupsUpdated: number;
            ledgersCreated: number;
            ledgersUpdated: number;
          };
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to upload master grouping workbook.");
        }

        const result = payload.result;
        showSuccess(
          payload.message ??
            (result
              ? `Uploaded ${result.rowCount} rows. Groups +${result.groupsCreated}/~${result.groupsUpdated}, GLs +${result.ledgersCreated}/~${result.ledgersUpdated}.`
              : "Master grouping uploaded."),
        );
        setFile(null);
        resetColumnSelection();
        setOpen(false);
        router.refresh();
      } catch (uploadError) {
        showError(uploadError instanceof Error ? uploadError.message : "Unable to upload master grouping workbook.");
      }
    });
  };

  return (
    <>
      <PortalButton
        variant="secondary"
        type="button"
        startIcon={<Upload className="h-4 w-4" />}
        onClick={() => setOpen(true)}
        sx={{ minHeight: 44, borderRadius: "1rem", textTransform: "none" }}
      >
        Master grouping upload
      </PortalButton>

      <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>Upload master grouping for {companyName}</DialogTitle>
        <DialogContent className="space-y-4">
          <div className="mt-1 rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">Applies only to {companyName}</p>
                <p>
                  This replaces this company&apos;s master grouping catalog. Matching GL codes are overridden. New codes
                  are inserted. Other companies are not changed.
                </p>
                <p>
                  After selecting a file, choose which columns contain the <span className="font-semibold">GL code</span>{" "}
                  and <span className="font-semibold">GL grouping</span>. Extra columns are ignored.
                </p>
              </div>
            </div>
          </div>

          <label className="flex h-12 min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-amber-300/80 bg-amber-50/65 px-3 text-sm text-amber-950 shadow-sm transition hover:border-amber-400 hover:bg-amber-50 dark:border-amber-400/30 dark:bg-amber-500/12 dark:text-amber-100 dark:hover:border-amber-300/50 dark:hover:bg-amber-500/18">
            <input
              className="sr-only"
              type="file"
              accept=".xlsx,.xls"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/18 dark:text-amber-200 dark:ring-amber-400/30">
              <CloudUpload className="h-4 w-4" />
            </span>
            <span className="min-w-0 truncate font-medium">{file ? file.name : "Select Master Grouping File.xlsx"}</span>
          </label>

          {isPreviewLoading ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">Reading workbook columns...</p>
          ) : null}

          {columns.length > 0 && !isPreviewLoading ? (
            <div className="space-y-3 rounded-xl border border-slate-200/80 bg-white/70 p-4 dark:border-slate-700/70 dark:bg-slate-900/40">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Map workbook columns</p>
              <PortalSelect
                label="GL code column"
                value={glCodeColumn}
                options={columnOptions}
                onChange={(value) => setGlCodeColumn(value)}
              />
              <PortalSelect
                label="GL grouping column"
                value={glGroupColumn}
                options={columnOptions}
                onChange={(value) => setGlGroupColumn(value)}
              />
              {glCodeColumn && glGroupColumn && glCodeColumn === glGroupColumn ? (
                <p className="text-sm text-rose-600 dark:text-rose-300">
                  GL code and GL grouping must use different columns.
                </p>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
        <DialogActions className="px-6 pb-4">
          <PortalButton variant="secondary" type="button" disabled={isPending || isPreviewLoading} onClick={closeDialog}>
            Cancel
          </PortalButton>
          <PortalButton variant="primary" type="button" disabled={isPending || !canUpload} onClick={upload}>
            {isPending ? "Uploading..." : "Upload and override"}
          </PortalButton>
        </DialogActions>
      </Dialog>
    </>
  );
}
