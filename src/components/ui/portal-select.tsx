"use client";

import FormControl, { type FormControlProps } from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent, type SelectProps } from "@mui/material/Select";
import { useEffect, useRef, useState, type ReactNode } from "react";

export type PortalSelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

export type PortalSelectProps = Omit<SelectProps<string>, "onChange" | "variant"> & {
  label?: string;
  options: PortalSelectOption[];
  onChange?: (value: string, event: SelectChangeEvent<string>) => void;
  formControlProps?: FormControlProps;
  fullWidth?: boolean;
  /** Delay before menu items accept clicks (avoids accidental select on open). */
  selectionDelayMs?: number;
};

const DEFAULT_SELECTION_DELAY_MS = 280;

export function PortalSelect({
  label,
  options,
  value,
  onChange,
  formControlProps,
  fullWidth = true,
  displayEmpty = true,
  size = "small",
  sx,
  selectionDelayMs = DEFAULT_SELECTION_DELAY_MS,
  MenuProps,
  onOpen,
  onClose,
  open: openProp,
  ...props
}: PortalSelectProps) {
  const labelId = label ? `${props.id ?? props.name ?? "portal-select"}-label` : undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectionReady, setSelectionReady] = useState(false);
  const readyTimerRef = useRef<number | null>(null);
  const open = openProp ?? internalOpen;

  useEffect(() => {
    return () => {
      if (readyTimerRef.current !== null) {
        window.clearTimeout(readyTimerRef.current);
      }
    };
  }, []);

  const clearReadyTimer = () => {
    if (readyTimerRef.current !== null) {
      window.clearTimeout(readyTimerRef.current);
      readyTimerRef.current = null;
    }
  };

  const handleOpen: NonNullable<SelectProps<string>["onOpen"]> = (event) => {
    setInternalOpen(true);
    setSelectionReady(false);
    clearReadyTimer();
    readyTimerRef.current = window.setTimeout(() => {
      setSelectionReady(true);
      readyTimerRef.current = null;
    }, selectionDelayMs);
    onOpen?.(event);
  };

  const handleClose: NonNullable<SelectProps<string>["onClose"]> = (event) => {
    setInternalOpen(false);
    setSelectionReady(false);
    clearReadyTimer();
    onClose?.(event);
  };

  return (
    <FormControl fullWidth={fullWidth} size={size} {...formControlProps}>
      {label ? <InputLabel id={labelId}>{label}</InputLabel> : null}
      <Select
        labelId={labelId}
        label={label}
        value={value ?? ""}
        displayEmpty={displayEmpty}
        size={size}
        open={open}
        onOpen={handleOpen}
        onClose={handleClose}
        onChange={(event) => {
          if (!selectionReady) {
            return;
          }
          onChange?.(event.target.value, event);
        }}
        MenuProps={{
          autoFocus: false,
          disableAutoFocusItem: true,
          disableScrollLock: true,
          anchorOrigin: {
            vertical: "bottom",
            horizontal: "left",
          },
          transformOrigin: {
            vertical: "top",
            horizontal: "left",
          },
          slotProps: {
            paper: {
              sx: {
                maxHeight: 280,
                mt: 0.75,
                borderRadius: "0.9rem",
                overflow: "auto",
              },
            },
          },
          ...MenuProps,
        }}
        sx={{
          borderRadius: "1rem",
          ...sx,
        }}
        {...props}
      >
        {options.map((option) => (
          <MenuItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            sx={{
              pointerEvents: selectionReady ? "auto" : "none",
              opacity: selectionReady ? 1 : 0.72,
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
