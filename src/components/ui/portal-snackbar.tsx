"use client";

import Alert from "@mui/material/Alert";
import Snackbar from "@mui/material/Snackbar";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from "react";

type SnackbarSeverity = "success" | "error";

type SnackbarApi = {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
};

const SnackbarContext = createContext<SnackbarApi | null>(null);

export function PortalSnackbarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<SnackbarSeverity>("success");
  const [snackbarKey, setSnackbarKey] = useState(0);

  const show = useCallback((nextSeverity: SnackbarSeverity, nextMessage: string) => {
    setSeverity(nextSeverity);
    setMessage(nextMessage);
    setSnackbarKey((current) => current + 1);
    setOpen(true);
  }, []);

  const handleClose = useCallback((_: Event | SyntheticEvent, reason?: string) => {
    if (reason === "clickaway") {
      return;
    }

    setOpen(false);
  }, []);

  const api = useMemo<SnackbarApi>(
    () => ({
      showSuccess: (nextMessage) => show("success", nextMessage),
      showError: (nextMessage) => show("error", nextMessage),
    }),
    [show],
  );

  return (
    <SnackbarContext.Provider value={api}>
      {children}
      <Snackbar
        key={snackbarKey}
        open={open}
        autoHideDuration={4000}
        onClose={handleClose}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={handleClose}
          severity={severity}
          variant="filled"
          sx={{ width: "100%", alignItems: "center" }}
        >
          {message}
        </Alert>
      </Snackbar>
    </SnackbarContext.Provider>
  );
}

export function usePortalSnackbar() {
  const context = useContext(SnackbarContext);

  if (!context) {
    throw new Error("usePortalSnackbar must be used within PortalSnackbarProvider.");
  }

  return context;
}
