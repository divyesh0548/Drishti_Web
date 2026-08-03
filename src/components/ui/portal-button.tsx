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
              },
              "& .MuiButton-startIcon, & .MuiButton-endIcon": {
                color: "#ffffff",
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
