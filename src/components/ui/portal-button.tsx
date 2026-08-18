"use client";

import Button, { type ButtonProps } from "@mui/material/Button";
import IconButton, { type IconButtonProps } from "@mui/material/IconButton";
import { forwardRef, type ReactNode } from "react";

type PortalButtonVariant = "primary" | "secondary" | "text" | "tab";

export type PortalButtonProps = Omit<ButtonProps, "variant" | "color"> & {
  variant?: PortalButtonVariant;
  active?: boolean;
};

export const PortalButton = forwardRef<HTMLButtonElement, PortalButtonProps>(function PortalButton(
  { variant = "primary", active = false, sx, ...props },
  ref,
) {
  if (variant === "tab") {
    return (
      <Button
        ref={ref}
        variant={active ? "contained" : "outlined"}
        color="primary"
        size="small"
        sx={{
          borderRadius: "0.65rem",
          px: 2,
          py: 1,
          ...(active
            ? {
                color: "#ffffff",
                WebkitTextFillColor: "#ffffff",
                "&:hover": { color: "#ffffff", WebkitTextFillColor: "#ffffff" },
                "& .MuiButton-startIcon, & .MuiButton-endIcon": {
                  color: "#ffffff",
                },
              }
            : {
                bgcolor: (theme) => (theme.palette.mode === "dark" ? "rgba(15,23,42,0.9)" : "rgba(226,232,240,0.8)"),
                color: "text.secondary",
                borderColor: "transparent",
              }),
          ...sx,
        }}
        {...props}
      />
    );
  }

  return (
    <Button
      ref={ref}
      variant={variant === "primary" ? "contained" : variant === "secondary" ? "outlined" : "text"}
      color="primary"
      sx={{
        ...(variant === "primary"
          ? {
              color: "#ffffff",
              WebkitTextFillColor: "#ffffff",
              "&:hover": {
                color: "#ffffff",
                WebkitTextFillColor: "#ffffff",
              },
              "&.Mui-disabled": {
                color: "rgba(255,255,255,0.72)",
                WebkitTextFillColor: "rgba(255,255,255,0.72)",
                background: (theme) =>
                  theme.palette.mode === "dark"
                    ? "linear-gradient(135deg, rgba(59, 130, 246, 0.34), rgba(129, 140, 248, 0.3))"
                    : "linear-gradient(135deg, rgba(37, 99, 235, 0.5), rgba(99, 102, 241, 0.48))",
              },
              "& .MuiButton-startIcon, & .MuiButton-endIcon": {
                color: "#ffffff",
              },
            }
          : {}),
        ...(variant === "secondary"
          ? {
              borderColor: (theme) =>
                theme.palette.mode === "dark" ? "rgba(148, 163, 184, 0.28)" : "rgba(148, 163, 184, 0.32)",
              bgcolor: (theme) =>
                theme.palette.mode === "dark" ? "rgba(15, 23, 42, 0.88)" : "rgba(255, 255, 255, 0.72)",
              color: (theme) => (theme.palette.mode === "dark" ? "#e2e8f0" : "#1e293b"),
              WebkitTextFillColor: (theme) => (theme.palette.mode === "dark" ? "#e2e8f0" : "#1e293b"),
              "&:hover": {
                borderColor: (theme) =>
                  theme.palette.mode === "dark" ? "rgba(96, 165, 250, 0.42)" : "rgba(37, 99, 235, 0.28)",
                bgcolor: (theme) =>
                  theme.palette.mode === "dark" ? "rgba(30, 41, 59, 0.96)" : "rgba(255, 255, 255, 0.94)",
                color: (theme) => (theme.palette.mode === "dark" ? "#f8fafc" : "#0f172a"),
                WebkitTextFillColor: (theme) => (theme.palette.mode === "dark" ? "#f8fafc" : "#0f172a"),
              },
              "&.Mui-disabled": {
                borderColor: (theme) =>
                  theme.palette.mode === "dark" ? "rgba(148, 163, 184, 0.16)" : "rgba(148, 163, 184, 0.2)",
                bgcolor: (theme) =>
                  theme.palette.mode === "dark" ? "rgba(15, 23, 42, 0.5)" : "rgba(241, 245, 249, 0.72)",
                color: (theme) => (theme.palette.mode === "dark" ? "rgba(148, 163, 184, 0.72)" : "rgba(100, 116, 139, 0.78)"),
                WebkitTextFillColor: (theme) =>
                  theme.palette.mode === "dark" ? "rgba(148, 163, 184, 0.72)" : "rgba(100, 116, 139, 0.78)",
              },
              "& .MuiButton-startIcon, & .MuiButton-endIcon": {
                color: "inherit",
              },
            }
          : {}),
        ...sx,
      }}
      {...props}
    />
  );
});

export type PortalIconButtonProps = IconButtonProps & {
  children: ReactNode;
};

export const PortalIconButton = forwardRef<HTMLButtonElement, PortalIconButtonProps>(function PortalIconButton(
  { sx, ...props },
  ref,
) {
  return (
    <IconButton
      ref={ref}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "1rem",
        bgcolor: "background.paper",
        color: "text.primary",
        "&:hover": {
          borderColor: "primary.main",
          color: "primary.main",
          bgcolor: "background.paper",
        },
        ...sx,
      }}
      {...props}
    />
  );
});
