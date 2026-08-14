"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { AlertTriangle, CloudUpload, Upload } from "lucide-react";

import { PortalButton } from "@/components/ui/portal-button";
import { usePortalSnackbar } from "@/components/ui/portal-snackbar";

export function MasterGroupingUploader() {
  const router = useRouter();
  const { showSuccess, showError } = usePortalSnackbar();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);

  const closeDialog = () => {
    if (isPending) {
      return;
    }

    setOpen(false);
    setFile(null);
  };

  const upload = () => {
    if (!file) {
      showError("Please select a master grouping Excel workbook first.");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("masterGroupingFile", file);

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
        setOpen(false);
        router.refresh();
      } catch (uploadError) {
        showError(uploadError instanceof Error ? uploadError.message : "Unable to upload master grouping workbook.");
      }
    });
  };

  return (
    <>
      <PortalButton variant="secondary" type="button" startIcon={<Upload className="h-4 w-4" />} onClick={() => setOpen(true)}>
        Master grouping upload
      </PortalButton>

      <Dialog open={open} onClose={closeDialog} fullWidth maxWidth="sm">
        <DialogTitle>Upload global master grouping</DialogTitle>
        <DialogContent className="space-y-4">
          <div className="mt-1 rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">Applies to every company</p>
                <p>
                  This updates the shared master grouping catalog in the database. Matching GL codes are overridden. New
                  codes are inserted. This is not limited to the company currently selected in Mapping Studio.
                </p>
                <p>
                  Expected Excel columns: <span className="font-semibold">Code</span> and{" "}
                  <span className="font-semibold">INDAS Head</span> (same layout as Master Grouping File.xlsx).
                </p>
              </div>
            </div>
          </div>

          <label className="flex h-11 min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 text-sm text-slate-600 transition hover:border-amber-300 hover:bg-amber-50/40 dark:border-white/10 dark:bg-slate-950/70 dark:text-slate-300">
            <input
              className="hidden"
              type="file"
              accept=".xlsx,.xls"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <CloudUpload className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
            <span className="truncate">{file ? file.name : "Select Master Grouping File.xlsx"}</span>
          </label>
        </DialogContent>
        <DialogActions className="px-6 pb-4">
          <PortalButton variant="secondary" type="button" disabled={isPending} onClick={closeDialog}>
            Cancel
          </PortalButton>
          <PortalButton variant="primary" type="button" disabled={isPending || !file} onClick={upload}>
            {isPending ? "Uploading..." : "Upload and override"}
          </PortalButton>
        </DialogActions>
      </Dialog>
    </>
  );
}
